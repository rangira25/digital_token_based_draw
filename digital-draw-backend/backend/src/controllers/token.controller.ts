import { Request, Response } from 'express';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error';
import { createAuditLog } from '../services/audit.service';
import { generateTokenCode } from '../utils/tokens';

// ─── Issue Tokens (Organizer → Pool) ──────────────────────────
export const issueTokens = asyncHandler(async (req: Request, res: Response) => {
  const { draw_id, quantity = 1, weight = 1 } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Validate draw exists and is open
    const drawResult = await client.query(
      `SELECT id, status, registration_end FROM draws WHERE id = $1 AND deleted_at IS NULL`,
      [draw_id]
    );
    const draw = drawResult.rows[0];
    if (!draw) throw new AppError('Draw not found', 404);
    if (draw.status !== 'open') throw new AppError('Draw is not open for token issuance', 400);
    if (draw.registration_end && new Date(draw.registration_end) < new Date()) {
      throw new AppError('Registration has ended for this draw; tokens can no longer be issued', 400);
    }

    // Issue tokens into the pool (no participant assigned, status = 'available')
    const issuedTokens = [];
    for (let i = 0; i < quantity; i++) {
      const tokenCode = generateTokenCode();
      const tokenResult = await client.query(
        `INSERT INTO tokens (draw_id, participant_id, token_code, issued_by, weight, status)
         VALUES ($1, NULL, $2, $3, $4, 'available')
         RETURNING *`,
        [draw_id, tokenCode, req.user!.userId, weight]
      );
      issuedTokens.push(tokenResult.rows[0]);
    }

    // Update total_token_pool on draw
    await client.query(
      'UPDATE draws SET total_token_pool = COALESCE(total_token_pool, 0) + $1 WHERE id = $2',
      [quantity, draw_id]
    );

    await client.query('COMMIT');

    await createAuditLog({
      actorId: req.user!.userId,
      action: 'token_issued',
      entityType: 'draw',
      entityId: draw_id,
      description: `${quantity} token(s) added to pool for draw`,
      metadata: { quantity, draw_id },
      ipAddress: req.ip ?? undefined,
    });

    res.status(201).json({
      success: true,
      message: `${quantity} token(s) added to pool successfully`,
      data: issuedTokens,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── Request Token (Participant claims from pool) ──────────────
export const requestToken = asyncHandler(async (req: Request, res: Response) => {
  const { draw_id, quantity = 1 } = req.body;
  const participantId = req.user!.userId;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const drawResult = await client.query(
      `SELECT id, status, max_entries_per_user, token_price, registration_start, registration_end
       FROM draws WHERE id = $1 AND deleted_at IS NULL`,
      [draw_id]
    );
    const draw = drawResult.rows[0];
    if (!draw) throw new AppError('Draw not found', 404);
    if (draw.status !== 'open') throw new AppError('Draw is not open for token requests', 400);
    if (draw.registration_end && new Date(draw.registration_end) < new Date()) {
      throw new AppError('Registration has ended for this draw; token purchase is no longer available', 400);
    }

    // Check token price and user balance
    const price = parseFloat(draw.token_price) || 0;
    const totalCost = price * quantity;
    if (totalCost > 0) {
      const userResult = await client.query(
        'SELECT balance FROM users WHERE id = $1',
        [participantId]
      );
      const userBalance = parseFloat(userResult.rows[0]?.balance) || 0;
      if (userBalance < totalCost) {
        throw new AppError(
          `Insufficient balance. Required: $${totalCost.toFixed(2)}, Available: $${userBalance.toFixed(2)}`,
          400
        );
      }
    }

    // Check how many tokens this participant already has for this draw
    const existingCount = await client.query(
      `SELECT COUNT(*) FROM tokens
       WHERE draw_id = $1 AND participant_id = $2 AND status IN ('issued', 'used')`,
      [draw_id, participantId]
    );
    const totalAfter = parseInt(existingCount.rows[0].count) + quantity;
    if (totalAfter > draw.max_entries_per_user) {
      throw new AppError(
        `You already have ${existingCount.rows[0].count} token(s). ` +
        `Max per draw: ${draw.max_entries_per_user}`,
        400
      );
    }

    // Check available tokens in pool
    const availableResult = await client.query(
      `SELECT id, token_code, weight FROM tokens
       WHERE draw_id = $1 AND status = 'available'
       ORDER BY issued_at ASC
       LIMIT $2 FOR UPDATE`,
      [draw_id, quantity]
    );

    if (availableResult.rows.length < quantity) {
      throw new AppError(
        `Only ${availableResult.rows.length} token(s) available in pool. Requested ${quantity}.`,
        400
      );
    }

    // Deduct balance before claiming tokens
    if (totalCost > 0) {
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [totalCost, participantId]
      );
    }

    // Claim tokens from pool — assign to participant
    const claimedTokens = [];
    for (const token of availableResult.rows) {
      const result = await client.query(
        `UPDATE tokens
         SET participant_id = $1, status = 'issued', issued_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [participantId, token.id]
      );
      claimedTokens.push(result.rows[0]);
    }

    await client.query('COMMIT');

    await createAuditLog({
      actorId: participantId,
      action: 'token_issued',
      entityType: 'token',
      entityId: draw_id,
      description: `${quantity} token(s) claimed from pool for draw. Cost: $${totalCost.toFixed(2)}`,
      metadata: { quantity, cost: totalCost, draw_id },
      ipAddress: req.ip ?? undefined,
    });

    res.status(201).json({
      success: true,
      message: `${quantity} token(s) claimed successfully`,
      data: claimedTokens,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── Validate Token ───────────────────────────────────────────
export const validateToken = asyncHandler(async (req: Request, res: Response) => {
  const { token_code } = req.params;

  const result = await query(
    `SELECT t.*, d.title AS draw_title, d.status AS draw_status, d.draw_date,
            u.full_name AS participant_name, u.email AS participant_email,
            de.id AS entry_id, de.status AS entry_status,
            w.id AS winner_id, w.rank AS winner_rank, w.status AS winner_status,
            w.claim_deadline, w.verification_code,
            p.title AS prize_title, p.prize_type, p.value AS prize_value
     FROM tokens t
     JOIN draws d ON t.draw_id = d.id
     JOIN users u ON t.participant_id = u.id
     LEFT JOIN draw_entries de ON de.token_id = t.id
     LEFT JOIN winners w ON w.entry_id = de.id
     LEFT JOIN prizes p ON w.prize_id = p.id
     WHERE t.token_code = $1`,
    [token_code]
  );

  if (!result.rows[0]) throw new AppError('Token not found', 404);

  const token = result.rows[0];

  let result_status = 'pending';
  if (token.winner_id) {
    result_status = token.winner_status === 'claimed' ? 'claimed' : 'won';
  } else if (token.entry_id && token.draw_status === 'completed') {
    result_status = 'lost';
  } else if (token.entry_id) {
    result_status = 'entered';
  }

  const validity = {
    valid: token.status === 'issued',
    status: token.status,
    draw_status: token.draw_status,
    expires_at: token.expires_at,
    result: result_status,
    winner_rank: token.winner_rank || null,
    prize_title: token.prize_title || null,
    prize_value: token.prize_value || null,
    claim_deadline: token.claim_deadline || null,
    verification_code: token.verification_code || null,
    reason:
      token.status === 'used' ? 'Token already used' :
      token.status === 'expired' ? 'Token expired' :
      token.status === 'revoked' ? 'Token revoked' :
      'Token is valid',
  };

  res.json({ success: true, data: { token, validity } });
});

// ─── Submit Entry (use a token) ───────────────────────────────
export const submitEntry = asyncHandler(async (req: Request, res: Response) => {
  const { token_code } = req.body;
  const participantId = req.user!.userId;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock and fetch token
    const tokenResult = await client.query(
      `SELECT t.*, d.status AS draw_status, d.registration_end
       FROM tokens t
       JOIN draws d ON t.draw_id = d.id
       WHERE t.token_code = $1 AND t.participant_id = $2
       FOR UPDATE`,
      [token_code, participantId]
    );

    const token = tokenResult.rows[0];
    if (!token) throw new AppError('Token not found or does not belong to you', 404);
    if (token.status !== 'issued') throw new AppError(`Token is ${token.status}`, 400);
    if (token.draw_status !== 'open') throw new AppError('Draw is not open for entries', 400);
    if (new Date(token.registration_end) < new Date()) {
      throw new AppError('Registration period has ended', 400);
    }

    // Create entry
    const entryResult = await client.query(
      `INSERT INTO draw_entries (draw_id, participant_id, token_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [token.draw_id, participantId, token.id, req.ip, req.headers['user-agent'] as string | undefined]
    );

    // Mark token as used
    await client.query(
      `UPDATE tokens SET status = 'used', used_at = NOW() WHERE id = $1`,
      [token.id]
    );

    await client.query('COMMIT');

    await createAuditLog({
      actorId: participantId,
      action: 'entry_submitted',
      entityType: 'draw',
      entityId: token.draw_id,
      description: `Entry submitted with token ${token_code}`,
      ipAddress: req.ip ?? undefined,
    });

    res.status(201).json({ success: true, data: entryResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── Get Draw Tokens (Organizer) ──────────────────────────────
export const getDrawTokens = asyncHandler(async (req: Request, res: Response) => {
  const { drawId } = req.params;
  const { status, page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  const params: unknown[] = [drawId];
  let where = 'WHERE t.draw_id = $1';
  if (status) {
    where += ` AND t.status = $${params.length + 1}`;
    params.push(status);
  }

  const result = await query(
    `SELECT t.*,
            u.full_name AS participant_name, u.email AS participant_email,
            CASE WHEN t.participant_id IS NULL THEN NULL ELSE u.full_name END AS holder_name
     FROM tokens t
     LEFT JOIN users u ON t.participant_id = u.id
     ${where}
     ORDER BY t.issued_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, parseInt(limit as string), offset]
  );

  // Also get pool summary
  const poolResult = await query(
    `SELECT COUNT(*) AS available_count FROM tokens WHERE draw_id = $1 AND status = 'available'`,
    [drawId]
  );

  res.json({
    success: true,
    data: result.rows,
    pool: { available: parseInt(poolResult.rows[0].available_count) },
  });
});

// ─── Revoke Token ─────────────────────────────────────────────
export const revokeToken = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE tokens SET status = 'revoked' WHERE id = $1 OR token_code = $1 RETURNING *`,
    [id]
  );
  if (!result.rows[0]) throw new AppError('Token not found', 404);

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'token_revoked',
    entityType: 'token',
    entityId: id as string,
    description: `Token revoked: ${result.rows[0].token_code}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Token revoked' });
});

// ─── My Tokens (Participant) ──────────────────────────────────
export const getMyTokens = asyncHandler(async (req: Request, res: Response) => {
  const { draw_id } = req.query;
  const params: unknown[] = [req.user!.userId];
  let where = 'WHERE t.participant_id = $1';
  if (draw_id) {
    where += ` AND t.draw_id = $2`;
    params.push(draw_id);
  }

  const result = await query(
    `SELECT t.*, d.title AS draw_title, d.status AS draw_status, d.draw_date
     FROM tokens t
     JOIN draws d ON t.draw_id = d.id
     ${where}
     ORDER BY t.issued_at DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

// ─── Get Pool Info (how many available for a draw) ────────────
export const getPoolInfo = asyncHandler(async (req: Request, res: Response) => {
  const { drawId } = req.params;

  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'available') AS available,
       COUNT(*) FILTER (WHERE status = 'issued') AS claimed,
       COUNT(*) FILTER (WHERE status = 'used') AS used,
       COUNT(*) AS total
     FROM tokens WHERE draw_id = $1`,
    [drawId]
  );

  res.json({ success: true, data: result.rows[0] });
});

// ─── My Entries (Participant) ─────────────────────────────────
export const getMyEntries = asyncHandler(async (req: Request, res: Response) => {
  const result = await query(
    `SELECT de.*, d.title AS draw_title, d.status AS draw_status, d.draw_date,
            t.token_code,
            w.id AS winner_id, w.rank AS winner_rank, w.status AS winner_status,
            w.prize_id, w.verification_code, w.claim_deadline,
            p.title AS prize_title, p.value AS prize_value,
            p.currency AS prize_currency, p.prize_type
     FROM draw_entries de
     JOIN draws d ON de.draw_id = d.id
     JOIN tokens t ON de.token_id = t.id
     LEFT JOIN winners w ON w.entry_id = de.id
     LEFT JOIN prizes p ON w.prize_id = p.id
     WHERE de.participant_id = $1
     ORDER BY de.submitted_at DESC`,
    [req.user!.userId]
  );

  res.json({ success: true, data: result.rows });
});
