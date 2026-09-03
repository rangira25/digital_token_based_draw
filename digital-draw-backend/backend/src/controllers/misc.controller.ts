import { Request, Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error';
import { createAuditLog } from '../services/audit.service';
import { createBulkNotifications } from '../services/notification.service';

// ============================================================
// WINNERS
// ============================================================

export const getWinners = asyncHandler(async (req: Request, res: Response) => {
  const { draw_id, status, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (draw_id) { where += ` AND w.draw_id = $${params.length + 1}`; params.push(draw_id); }
  if (status) { where += ` AND w.status = $${params.length + 1}`; params.push(status); }

  // Organizer filter
  if (req.user!.role === 'organizer') {
    where += ` AND d.organizer_id = $${params.length + 1}`;
    params.push(req.user!.userId);
  }

  const result = await query(
    `SELECT w.*,
            jsonb_build_object('name', u.full_name, 'email', u.email) AS users,
            jsonb_build_object('title', d.title, 'organizer_name', COALESCE(o.full_name, '')) AS draws,
            CASE WHEN p.id IS NOT NULL THEN
              jsonb_build_object('title', p.title, 'prize_type', p.prize_type, 'value', p.value, 'currency', p.currency)
            ELSE NULL END AS prize
     FROM winners w
     JOIN users u ON w.participant_id = u.id
     JOIN draws d ON w.draw_id = d.id
     LEFT JOIN users o ON d.organizer_id = o.id
     LEFT JOIN prizes p ON w.prize_id = p.id
     ${where}
     ORDER BY w.selected_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, parseInt(limit as string), offset]
  );

  res.json({ success: true, data: result.rows });
});

export const claimPrize = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { verification_code } = req.body;

  const result = await query(
    `SELECT w.*, u.id AS user_id, p.value AS prize_value, p.currency AS prize_currency
     FROM winners w
     JOIN users u ON w.participant_id = u.id
     LEFT JOIN prizes p ON w.prize_id = p.id
     WHERE w.id = $1`,
    [id]
  );
  const winner = result.rows[0];
  if (!winner) throw new AppError('Winner record not found', 404);
  if (winner.user_id !== req.user!.userId && req.user!.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }
  if (winner.status === 'claimed') throw new AppError('Prize already claimed', 400);
  if (winner.status === 'forfeited') throw new AppError('Prize was forfeited', 400);
  if (new Date(winner.claim_deadline) < new Date()) {
    await query('UPDATE winners SET status = $1 WHERE id = $2', ['forfeited', id]);
    throw new AppError('Claim deadline has passed', 400);
  }
  if (winner.verification_code && winner.verification_code !== verification_code?.toUpperCase()) {
    throw new AppError('Invalid verification code', 400);
  }

  const updated = await query(
    `UPDATE winners SET status = 'claimed', claimed_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  // Prize value was already credited to the winner's balance when the draw was
  // executed. Claiming only marks the prize as claimed (prevents double-credit).
  const prizeValue = parseFloat(winner.prize_value) || 0;

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'prize_claimed',
    entityType: 'winner',
    entityId: id as string,
    description: `Prize claimed by ${winner.user_id}${prizeValue > 0 ? `, value: $${prizeValue.toFixed(2)}` : ''}`,
    ipAddress: req.ip ?? undefined,
  });

  // Notify the winner of successful claim
  createBulkNotifications(
    [winner.user_id],
    'confirmation',
    'Prize Claimed!',
    prizeValue > 0
      ? `Your prize of $${prizeValue.toFixed(2)} has been credited to your balance.`
      : `Your prize has been successfully claimed. Check your results page for details.`,
    { draw_id: winner.draw_id }
  ).catch(() => {});

  res.json({ success: true, data: updated.rows[0] });
});

export const updateWinnerStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, claim_notes } = req.body;
  const allowed = ['notified', 'claimed', 'forfeited'];
  if (!allowed.includes(status)) throw new AppError('Invalid status', 400);

  const result = await query(
    `UPDATE winners SET status = $1, claim_notes = COALESCE($2, claim_notes),
     notified_at = CASE WHEN $1 = 'notified' THEN NOW() ELSE notified_at END
     WHERE id = $3 RETURNING *`,
    [status, claim_notes || null, id]
  );
  if (!result.rows[0]) throw new AppError('Winner not found', 404);
  res.json({ success: true, data: result.rows[0] });
});

// ============================================================
// NOTIFICATIONS
// ============================================================

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { type, read, page = '1', limit = '30' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const params: unknown[] = [req.user!.userId];
  let where = 'WHERE n.user_id = $1';

  if (type) { where += ` AND n.type = $${params.length + 1}`; params.push(type); }
  if (read !== undefined) { where += ` AND n.read = $${params.length + 1}`; params.push(read === 'true'); }

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT n.*, d.title AS draw_title
       FROM notifications n
       LEFT JOIN draws d ON (n.data->>'draw_id')::uuid = d.id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), offset]
    ),
    query(`SELECT COUNT(*) FROM notifications n ${where}`, params),
  ]);

  const unreadCount = await query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE',
    [req.user!.userId]
  );

  // Add action_url and channel to each notification
  const data = dataResult.rows.map((n: any) => {
    const drawId = n.data?.draw_id;
    let actionUrl: string | null = null;
    if (n.type === 'win' && drawId) {
      actionUrl = '/dashboard/participant/results';
    } else if (n.type === 'draw' && drawId) {
      actionUrl = '/dashboard/participant/draws';
    } else if (n.type === 'reminder' && drawId) {
      actionUrl = '/dashboard/participant/results';
    } else if (n.type === 'confirmation' && drawId) {
      actionUrl = '/dashboard/participant/entries';
    }
    return {
      ...n,
      action_url: actionUrl,
      channel: 'in-app',
    };
  });

  res.json({
    success: true,
    data,
    unread_count: parseInt(unreadCount.rows[0].count),
    pagination: {
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    },
  });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(
    'UPDATE notifications SET read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2',
    [id, req.user!.userId]
  );
  res.json({ success: true, message: 'Marked as read' });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  await query(
    'UPDATE notifications SET read = TRUE, read_at = NOW() WHERE user_id = $1 AND read = FALSE',
    [req.user!.userId]
  );
  res.json({ success: true, message: 'All notifications marked as read' });
});

// ─── Send Broadcast ──────────────────────────────────────────
export const sendBroadcast = asyncHandler(async (req: Request, res: Response) => {
  const { subject, body, type, audience, draw_id } = req.body;
  if (!subject || !body) throw new AppError('Subject and body are required', 400);
  const msgType = type || 'announcement';

  let userIds: string[] = [];
  if (audience === 'draw' && draw_id) {
    const participants = await query(
      `SELECT DISTINCT de.participant_id AS id FROM draw_entries de WHERE de.draw_id = $1 AND de.status = 'active'`,
      [draw_id]
    );
    userIds = participants.rows.map((r: { id: string }) => r.id);
  } else if (audience === 'winners' && draw_id) {
    const winners = await query(
      'SELECT DISTINCT participant_id AS id FROM winners WHERE draw_id = $1',
      [draw_id]
    );
    userIds = winners.rows.map((r: { id: string }) => r.id);
  } else {
    const users = await query("SELECT id FROM users WHERE status = 'active'");
    userIds = users.rows.map((r: { id: string }) => r.id);
  }

  const { createBulkNotifications } = await import('../services/notification.service');
  await createBulkNotifications(userIds, msgType as any, subject, body, { draw_id });

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'broadcast_sent',
    entityType: 'notification',
    entityId: draw_id || 'all',
    description: `Broadcast sent: "${subject}" to ${userIds.length} users`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: `Broadcast sent to ${userIds.length} users` });
});

// ============================================================
// ANALYTICS
// ============================================================

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const isAdmin = req.user!.role === 'admin';

  const [drawStats, entryStats, winnerStats, tokenStats, recentActivity] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') AS active_draws,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_draws,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft_draws,
        COUNT(*) AS total_draws
      FROM draws d
      WHERE deleted_at IS NULL
      ${isAdmin ? '' : 'AND d.organizer_id = $1'}`,
      isAdmin ? [] : [organizerId]
    ),
    query(`
      SELECT
        COUNT(de.*) AS total_entries,
        COUNT(DISTINCT de.participant_id) AS unique_participants
      FROM draw_entries de
      JOIN draws d ON de.draw_id = d.id
      WHERE de.status = 'active'
      ${isAdmin ? '' : 'AND d.organizer_id = $1'}`,
      isAdmin ? [] : [organizerId]
    ),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE w.status = 'claimed') AS claimed_prizes,
        COUNT(*) FILTER (WHERE w.status = 'selected') AS pending_claims,
        COUNT(*) AS total_winners
      FROM winners w
      JOIN draws d ON w.draw_id = d.id
      ${isAdmin ? '' : 'WHERE d.organizer_id = $1'}`,
      isAdmin ? [] : [organizerId]
    ),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE t.status = 'issued') AS active_tokens,
        COUNT(*) FILTER (WHERE t.status = 'used') AS used_tokens,
        COUNT(*) AS total_tokens
      FROM tokens t
      JOIN draws d ON t.draw_id = d.id
      ${isAdmin ? '' : 'WHERE d.organizer_id = $1'}`,
      isAdmin ? [] : [organizerId]
    ),
    query(`
      SELECT d.title, d.status, d.draw_date,
             COUNT(de.id) AS entry_count
      FROM draws d
      LEFT JOIN draw_entries de ON d.id = de.draw_id AND de.status = 'active'
      WHERE d.deleted_at IS NULL
      ${isAdmin ? '' : 'AND d.organizer_id = $1'}
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 5`,
      isAdmin ? [] : [organizerId]
    ),
  ]);

  // Entry trend: last 30 days (with unique participants per day)
  const trendResult = await query(`
    SELECT DATE_TRUNC('day', de.submitted_at) AS day,
           COUNT(*) AS entries,
           COUNT(DISTINCT de.participant_id) AS unique_participants
    FROM draw_entries de
    JOIN draws d ON de.draw_id = d.id
    WHERE de.submitted_at >= NOW() - INTERVAL '30 days'
    ${isAdmin ? '' : 'AND d.organizer_id = $1'}
    GROUP BY day ORDER BY day`,
    isAdmin ? [] : [organizerId]
  );

  // Top draws by participation (top 8)
  const topDrawsResult = await query(`
    SELECT d.title, d.status, d.draw_date, d.max_participants,
           COUNT(de.id) AS entry_count,
           COUNT(DISTINCT de.participant_id) AS unique_participants,
           d.token_price
    FROM draws d
    LEFT JOIN draw_entries de ON d.id = de.draw_id AND de.status = 'active'
    WHERE d.deleted_at IS NULL AND d.status IN ('open','completed')
    ${isAdmin ? '' : 'AND d.organizer_id = $1'}
    GROUP BY d.id
    ORDER BY entry_count DESC
    LIMIT 8`,
    isAdmin ? [] : [organizerId]
  );

  res.json({
    success: true,
    data: {
      draws: drawStats.rows[0],
      entries: entryStats.rows[0],
      winners: winnerStats.rows[0],
      tokens: tokenStats.rows[0],
      recent_draws: recentActivity.rows,
      top_draws: topDrawsResult.rows,
      entry_trend: trendResult.rows,
    },
  });
});

// ============================================================
// AUDIT LOGS
// ============================================================

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { action, entity_type, actor_id, from_date, to_date, page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (action) { where += ` AND al.action = $${params.length + 1}`; params.push(action); }
  if (entity_type) { where += ` AND al.entity_type = $${params.length + 1}`; params.push(entity_type); }
  if (actor_id) { where += ` AND al.actor_id = $${params.length + 1}`; params.push(actor_id); }
  if (from_date) { where += ` AND al.created_at >= $${params.length + 1}`; params.push(from_date); }
  if (to_date) { where += ` AND al.created_at <= $${params.length + 1}`; params.push(to_date); }

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT al.*, u.full_name AS actor_name, u.email AS actor_email
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), offset]
    ),
    query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params),
  ]);

  res.json({
    success: true,
    data: dataResult.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    },
  });
});

// ============================================================
// ADMIN - USER MANAGEMENT
// ============================================================

export const adminListUsers = asyncHandler(async (req: Request, res: Response) => {
  const { role, status, search, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const params: unknown[] = [];
  let where = 'WHERE deleted_at IS NULL';

  if (role) { where += ` AND role = $${params.length + 1}`; params.push(role); }
  if (status) { where += ` AND status = $${params.length + 1}`; params.push(status); }
  if (search) {
    where += ` AND (full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
    params.push(`%${search}%`);
  }

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT id, email, role, status, full_name, phone, email_verified,
              totp_enabled, last_login_at, created_at, login_attempts
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), offset]
    ),
    query(`SELECT COUNT(*) FROM users ${where}`, params),
  ]);

  res.json({
    success: true,
    data: dataResult.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    },
  });
});

export const adminUpdateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, role, identity_verified } = req.body;

  const result = await query(
    `UPDATE users
     SET status = COALESCE($1, status),
         role = COALESCE($2, role),
         identity_verified = COALESCE($3, identity_verified)
     WHERE id = $4 AND deleted_at IS NULL
     RETURNING id, email, role, status, full_name, identity_verified`,
    [status || null, role || null, identity_verified ?? null, id]
  );
  if (!result.rows[0]) throw new AppError('User not found', 404);

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'admin_action',
    entityType: 'user',
    entityId: id as string,
    description: `Admin updated user ${id}: ${JSON.stringify({ status, role })}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: result.rows[0] });
});

export const adminDeleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [id]);
  await createAuditLog({
    actorId: req.user!.userId,
    action: 'admin_action',
    entityType: 'user',
    entityId: id as string,
    description: `Admin soft-deleted user ${id}`,
    ipAddress: req.ip ?? undefined,
  });
  res.json({ success: true, message: 'User deleted' });
});

export const adminAddBalance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, description } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new AppError('Valid positive amount is required', 400);
  }

  const user = await query('SELECT id, full_name, balance FROM users WHERE id = $1', [id]);
  if (!user.rows[0]) throw new AppError('User not found', 404);

  const result = await query(
    'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING id, full_name, balance',
    [parseFloat(amount), id]
  );

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'admin_action',
    entityType: 'user',
    entityId: id as string,
    description: `Admin added $${parseFloat(amount).toFixed(2)} to ${user.rows[0].full_name} balance${description ? ': ' + description : ''}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: result.rows[0] });
});
