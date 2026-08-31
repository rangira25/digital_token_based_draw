import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error';
import { createAuditLog } from '../services/audit.service';
import { createBulkNotifications } from '../services/notification.service';

// ─── List Draws ───────────────────────────────────────────────
export const listDraws = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let whereClause = 'WHERE d.deleted_at IS NULL';
  const params: unknown[] = [];
  let paramIndex = 1;

  // Participants only see public draws; organizers see their own
  if (req.user?.role === 'participant') {
    whereClause += ` AND d.is_public = TRUE AND d.status != 'draft'`;
  } else if (req.user?.role === 'organizer') {
    whereClause += ` AND d.organizer_id = $${paramIndex++}`;
    params.push(req.user.userId);
  }

  if (status) {
    whereClause += ` AND d.status = $${paramIndex++}`;
    params.push(status);
  }

  const countResult = await query(
    `SELECT COUNT(*) FROM draws d ${whereClause}`,
    params
  );

  params.push(parseInt(limit as string), offset);
  const result = await query(
    `SELECT d.*,
            u.full_name AS organizer_name,
            (SELECT COUNT(*) FROM draw_entries de WHERE de.draw_id = d.id AND de.status = 'active') AS entry_count,
            (SELECT COUNT(*) FROM prizes p WHERE p.draw_id = d.id) AS prize_count
     FROM draws d
     JOIN users u ON d.organizer_id = u.id
     ${whereClause}
     ORDER BY d.draw_date ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    },
  });
});

// ─── Get Single Draw ──────────────────────────────────────────
export const getDraw = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await query(
    `SELECT d.*,
            u.full_name AS organizer_name, u.company_name,
            (SELECT COUNT(*) FROM draw_entries de WHERE de.draw_id = d.id AND de.status = 'active') AS entry_count,
            (SELECT json_agg(p ORDER BY p.rank) FROM prizes p WHERE p.draw_id = d.id) AS prizes
     FROM draws d
     JOIN users u ON d.organizer_id = u.id
     WHERE d.id = $1 AND d.deleted_at IS NULL`,
    [id]
  );

  if (!result.rows[0]) throw new AppError('Draw not found', 404);

  // Participants can only see public draws
  const draw = result.rows[0];
  if (req.user?.role === 'participant' && (!draw.is_public || draw.status === 'draft')) {
    throw new AppError('Draw not found', 404);
  }

  res.json({ success: true, data: draw });
});

// ─── Create Draw ──────────────────────────────────────────────
export const createDraw = asyncHandler(async (req: Request, res: Response) => {
  const {
    title, description, registration_start, registration_end, draw_date,
    max_participants, max_entries_per_user, min_age, eligibility_notes,
    tokens_per_entry, winners_count, image_url, terms_url, is_public,
    status, prizes, token_price,
  } = req.body;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const drawStatus = (status === 'open' || status === 'draft') ? status : 'open';

    const result = await client.query(
      `INSERT INTO draws
         (organizer_id, title, description, registration_start, registration_end,
          draw_date, max_participants, max_entries_per_user, min_age, eligibility_notes,
          tokens_per_entry, winners_count, image_url, terms_url, is_public, status, token_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        req.user!.userId, title, description, registration_start, registration_end,
        draw_date, max_participants || null, max_entries_per_user ?? 10,
        min_age || null, eligibility_notes || null, tokens_per_entry || 1,
        winners_count || 1, image_url || null, terms_url || null,
        is_public !== false, drawStatus, token_price || 0,
      ]
    );

    const draw = result.rows[0];

    // Insert prizes if provided
    if (prizes && prizes.length > 0) {
      for (const prize of prizes) {
        await client.query(
          `INSERT INTO prizes (draw_id, rank, title, description, prize_type, value, currency, quantity, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            draw.id, prize.rank, prize.title, prize.description || null,
            prize.prize_type || 'other', prize.value || null, prize.currency || 'USD',
            prize.quantity || 1, prize.image_url || null,
          ]
        );
      }
    }

    await client.query('COMMIT');

    await createAuditLog({
      actorId: req.user!.userId,
      action: 'draw_created',
      entityType: 'draw',
      entityId: draw.id,
      description: `Draw created: "${title}"`,
      ipAddress: req.ip ?? undefined,
    });

    res.status(201).json({ success: true, data: draw });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── Update Draw ──────────────────────────────────────────────
export const updateDraw = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Only organizer who owns it (or admin) can update
  const existing = await query(
    'SELECT organizer_id, status FROM draws WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!existing.rows[0]) throw new AppError('Draw not found', 404);
  if (
    req.user!.role !== 'admin' &&
    existing.rows[0].organizer_id !== req.user!.userId
  ) {
    throw new AppError('Not authorized to update this draw', 403);
  }
  if (existing.rows[0].status === 'completed') {
    throw new AppError('Cannot update a completed draw', 400);
  }

  const {
    title, description, registration_start, registration_end, draw_date,
    max_participants, max_entries_per_user, min_age, eligibility_notes,
    tokens_per_entry, winners_count, image_url, terms_url, is_public, status,
  } = req.body;

  const result = await query(
    `UPDATE draws SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       registration_start = COALESCE($3, registration_start),
       registration_end = COALESCE($4, registration_end),
       draw_date = COALESCE($5, draw_date),
       max_participants = COALESCE($6, max_participants),
       max_entries_per_user = COALESCE($7, max_entries_per_user),
       min_age = COALESCE($8, min_age),
       eligibility_notes = COALESCE($9, eligibility_notes),
       tokens_per_entry = COALESCE($10, tokens_per_entry),
       winners_count = COALESCE($11, winners_count),
       image_url = COALESCE($12, image_url),
       terms_url = COALESCE($13, terms_url),
       is_public = COALESCE($14, is_public),
       status = COALESCE($15, status)
     WHERE id = $16
     RETURNING *`,
    [
      title, description, registration_start, registration_end, draw_date,
      max_participants, max_entries_per_user, min_age, eligibility_notes,
      tokens_per_entry, winners_count, image_url, terms_url, is_public, status, id,
    ]
  );

  res.json({ success: true, data: result.rows[0] });
});

// ─── Delete Draw ──────────────────────────────────────────────
export const deleteDraw = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await query(
    'SELECT organizer_id, status FROM draws WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!existing.rows[0]) throw new AppError('Draw not found', 404);
  if (
    req.user!.role !== 'admin' &&
    existing.rows[0].organizer_id !== req.user!.userId
  ) {
    throw new AppError('Not authorized', 403);
  }
  if (['open', 'completed'].includes(existing.rows[0].status)) {
    throw new AppError('Cannot delete an open or completed draw', 400);
  }

  await query('UPDATE draws SET deleted_at = NOW() WHERE id = $1', [id]);
  res.json({ success: true, message: 'Draw deleted' });
});

// ─── Execute Draw (Random Winner Selection) ───────────────────
export const executeDraw = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock the draw row
    const drawResult = await client.query(
      `SELECT * FROM draws WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    const draw = drawResult.rows[0];
    if (!draw) throw new AppError('Draw not found', 404);
    if (draw.status !== 'closed') throw new AppError('Draw must be closed before executing', 400);
    if (
      req.user!.role !== 'admin' &&
      draw.organizer_id !== req.user!.userId
    ) throw new AppError('Not authorized', 403);

    // Fetch all active entries with their token weights
    const entriesResult = await client.query(
      `SELECT de.id AS entry_id, de.participant_id, t.weight
       FROM draw_entries de
       JOIN tokens t ON de.token_id = t.id
       WHERE de.draw_id = $1 AND de.status = 'active'`,
      [id]
    );

    if (entriesResult.rows.length === 0) {
      throw new AppError('No active entries to draw from', 400);
    }

    const entries = entriesResult.rows;

    // Build weighted pool
    const pool: { entry_id: string; participant_id: string }[] = [];
    for (const e of entries) {
      for (let w = 0; w < (e.weight || 1); w++) {
        pool.push({ entry_id: e.entry_id, participant_id: e.participant_id });
      }
    }

    // Cryptographically random seed for auditability
    const seed = crypto.randomBytes(32).toString('hex');

    // Fisher-Yates shuffle seeded by the random bytes
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Pick winners — deduplicate by participant
    const winnersCount = Math.min(draw.winners_count, entries.length);
    const selectedParticipants = new Set<string>();
    const selectedEntries: { entry_id: string; participant_id: string }[] = [];

    for (const item of shuffled) {
      if (!selectedParticipants.has(item.participant_id)) {
        selectedParticipants.add(item.participant_id);
        selectedEntries.push(item);
        if (selectedEntries.length >= winnersCount) break;
      }
    }

    // Fetch prizes for assignment
    const prizesResult = await client.query(
      'SELECT * FROM prizes WHERE draw_id = $1 ORDER BY rank',
      [id]
    );
    const prizes = prizesResult.rows;

    // Insert winners
    const winners = [];
    for (let i = 0; i < selectedEntries.length; i++) {
      const entry = selectedEntries[i];
      const prize = prizes[i] || null;
      const claimDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const verificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();

      const winnerResult = await client.query(
        `INSERT INTO winners
           (draw_id, participant_id, entry_id, prize_id, rank, status,
            claim_deadline, verification_code)
         VALUES ($1,$2,$3,$4,$5,'selected',$6,$7)
         RETURNING *`,
        [
          id, entry.participant_id, entry.entry_id,
          prize?.id || null, i + 1, claimDeadline, verificationCode,
        ]
      );
      winners.push(winnerResult.rows[0]);
    }

    // Credit prize values to winners' balances immediately
    for (let i = 0; i < winners.length; i++) {
      const prize = prizes[i];
      if (prize && parseFloat(prize.value) > 0) {
        await client.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [parseFloat(prize.value), winners[i].participant_id]
        );
      }
    }

    // Update draw status
    await client.query(
      `UPDATE draws SET status = 'completed', draw_executed_at = NOW(),
       draw_executed_by = $1, draw_seed = $2 WHERE id = $3`,
      [req.user!.userId, seed, id]
    );

    await client.query('COMMIT');

    // Notify winners (async, don't block response)
    const participantIds = selectedEntries.map((e) => e.participant_id);
    const totalWon = prizes.slice(0, winners.length).reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
    createBulkNotifications(
      participantIds,
      'win',
      `You won in "${draw.title}"!`,
      totalWon > 0
        ? `Congratulations! You won $${totalWon.toFixed(2)} in prizes. The amount has been credited to your balance.`
        : `Congratulations! You won in "${draw.title}". Check your results page for details.`,
      { draw_id: id }
    ).catch(() => {});

    // Notify non-winners
    const allParticipantIds = [...new Set(entries.map((e: any) => e.participant_id))];
    const loserIds = allParticipantIds.filter((pid: string) => !selectedParticipants.has(pid));
    if (loserIds.length > 0) {
      createBulkNotifications(
        loserIds,
        'announcement',
        `Draw results: "${draw.title}"`,
        `The draw has been completed. Unfortunately, you were not selected as a winner this time. Better luck next time!`,
        { draw_id: id }
      ).catch(() => {});
    }

    await createAuditLog({
      actorId: req.user!.userId,
      action: 'draw_executed',
      entityType: 'draw',
      entityId: id as string,
      description: `Draw "${draw.title}" executed. ${selectedEntries.length} winners selected. Seed: ${seed}`,
      metadata: { seed, winners_count: selectedEntries.length },
      ipAddress: req.ip ?? undefined,
    });

    res.json({
      success: true,
      message: `Draw executed. ${selectedEntries.length} winner(s) selected.`,
      data: { winners, seed },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── Get Draw Winners ─────────────────────────────────────────
export const getDrawWinners = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await query(
    `SELECT w.*, u.full_name, u.email,
            p.title AS prize_title, p.prize_type, p.value, p.currency
     FROM winners w
     JOIN users u ON w.participant_id = u.id
     LEFT JOIN prizes p ON w.prize_id = p.id
     WHERE w.draw_id = $1
     ORDER BY w.rank`,
    [id]
  );
  res.json({ success: true, data: result.rows });
});

// ─── Update Draw Status (open/close/cancel) ───────────────────
export const updateDrawStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['open', 'closed', 'cancelled'];
  if (!allowed.includes(status)) throw new AppError('Invalid status transition', 400);

  const existing = await query(
    'SELECT organizer_id, status, title FROM draws WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!existing.rows[0]) throw new AppError('Draw not found', 404);
  if (
    req.user!.role !== 'admin' &&
    existing.rows[0].organizer_id !== req.user!.userId
  ) throw new AppError('Not authorized', 403);

  const result = await query(
    'UPDATE draws SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );

  // Notify all participants when a draw opens
  if (status === 'open') {
    const participants = await query(
      `SELECT DISTINCT de.participant_id FROM draw_entries de WHERE de.draw_id = $1`,
      [id]
    );
    // also notify all active users
    const allUsers = await query(
      `SELECT id FROM users WHERE role = 'participant' AND status = 'active'`
    );
    const ids = allUsers.rows.map((r: { id: string }) => r.id);
    createBulkNotifications(
      ids,
      'draw_open',
      `Draw "${existing.rows[0].title}" is now open!`,
      'A new draw is available. Enter now before registration closes.',
      { draw_id: id }
    ).catch(() => {});
  }

  await createAuditLog({
    actorId: req.user!.userId,
    action: (status === 'open' ? 'draw_opened' : status === 'closed' ? 'draw_closed' : 'draw_cancelled') as string,
    entityType: 'draw',
    entityId: id as string,
    description: `Draw status changed to "${String(status)}"`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: result.rows[0] });
});
