import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error';
import { createAuditLog } from '../services/audit.service';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';
import { generateSecureToken } from '../utils/tokens';

const signAccessToken = (userId: string, email: string, role: string) =>
  jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

const signRefreshToken = (userId: string) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  } as jwt.SignOptions);

// ─── Register ────────────────────────────────────────────────
export const register = asyncHandler(async (req: Request, res: Response) => {
  const {
    email, password, role, full_name, phone, national_id,
    company_name, organizer_license,
  } = req.body;

  // Check duplicate
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows[0]) throw new AppError('Email already registered', 409);

  const password_hash = await bcrypt.hash(password, 12);
  const emailToken = generateSecureToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO users
       (email, password_hash, role, full_name, phone, national_id,
        company_name, organizer_license, email_verify_token, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
     RETURNING id, email, role, full_name, status`,
    [
      email.toLowerCase(), password_hash, role || 'participant',
      full_name, phone || null, national_id || null,
      company_name || null, organizer_license || null, emailToken,
    ]
  );

  const user = result.rows[0];

  await sendVerificationEmail(user.email, user.full_name, emailToken).catch(() => {});

  await createAuditLog({
    actorId: user.id,
    action: 'user_registered',
    entityType: 'user',
    entityId: user.id,
    description: `New ${role} account registered: ${email}`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: { id: user.id, email: user.email, role: user.role },
  });
});

// ─── Verify Email ─────────────────────────────────────────────
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) throw new AppError('Verification token required', 400);

  const result = await query(
    `UPDATE users
     SET email_verified = TRUE, email_verified_at = NOW(),
         status = 'active', email_verify_token = NULL
     WHERE email_verify_token = $1 AND email_verified = FALSE
     RETURNING id, email`,
    [token]
  );

  if (!result.rows[0]) throw new AppError('Invalid or expired verification token', 400);

  await createAuditLog({
    actorId: result.rows[0].id,
    action: 'email_verified',
    entityType: 'user',
    entityId: result.rows[0].id,
    description: `Email verified for ${result.rows[0].email}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Email verified successfully' });
});

// ─── Login ────────────────────────────────────────────────────
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, totp_code } = req.body;

  const result = await query(
    `SELECT id, email, password_hash, role, status, full_name,
            phone, national_id, profile_image_url, company_name,
            organizer_license, totp_enabled, totp_secret,
            login_attempts, locked_until, email_verified, created_at,
            balance
     FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  // Generic error to prevent user enumeration
  if (!user) throw new AppError('Invalid credentials', 401);

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError('Account temporarily locked due to failed login attempts', 423);
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = user.login_attempts + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await query(
      'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
      [attempts, lockUntil, user.id]
    );
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.email_verified) {
    throw new AppError('Please verify your email before logging in', 403);
  }

  if (user.status === 'suspended' || user.status === 'banned') {
    throw new AppError('Your account has been suspended', 403);
  }

  // 2FA check for organizers
  if (user.totp_enabled) {
    if (!totp_code) {
      res.status(200).json({ success: true, requires2FA: true });
      return;
    }
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: totp_code,
      window: 1,
    });
    if (!verified) throw new AppError('Invalid 2FA code', 401);
  }

  // Reset login attempts, update last login
  await query(
    `UPDATE users SET login_attempts = 0, locked_until = NULL,
     last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`,
    [req.ip, user.id]
  );

  const accessToken = signAccessToken(user.id, user.email, user.role);
  const refreshToken = signRefreshToken(user.id);

  const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, refreshToken, refreshExpiry, req.ip, req.headers['user-agent'] as string | undefined]
  );

  await createAuditLog({
    actorId: user.id,
    action: 'user_login',
    entityType: 'user',
    entityId: user.id,
    description: `User logged in: ${user.email}`,
    ipAddress: req.ip ?? undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
        national_id: user.national_id,
        profile_image_url: user.profile_image_url,
        company_name: user.company_name,
        organizer_license: user.organizer_license,
        created_at: user.created_at,
        totp_enabled: user.totp_enabled,
        balance: user.balance,
      },
    },
  });
});

// ─── Refresh Token ────────────────────────────────────────────
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;
  if (!token) throw new AppError('Refresh token required', 400);

  const stored = await query(
    `SELECT rt.*, u.email, u.role, u.status
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW()`,
    [token]
  );

  if (!stored.rows[0]) throw new AppError('Invalid or expired refresh token', 401);
  const row = stored.rows[0];

  if (row.status === 'suspended' || row.status === 'banned') {
    throw new AppError('Account suspended', 403);
  }

  // Rotate refresh token
  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [row.id]);
  const newRefresh = signRefreshToken(row.user_id);
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
    [row.user_id, newRefresh, expiry]
  );

  const accessToken = signAccessToken(row.user_id, row.email, row.role);

  res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
});

// ─── Logout ───────────────────────────────────────────────────
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;
  if (token) {
    await query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [token]);
  }
  await createAuditLog({
    actorId: req.user?.userId,
    action: 'user_logout',
    entityType: 'user',
    entityId: req.user?.userId,
    description: `User logged out`,
    ipAddress: req.ip ?? undefined,
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// ─── Forgot Password ──────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await query(
    'SELECT id, full_name FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email.toLowerCase()]
  );

  // Always return success to prevent enumeration
  if (result.rows[0]) {
    const token = generateSecureToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [token, expiry, result.rows[0].id]
    );
    await sendPasswordResetEmail(email, result.rows[0].full_name, token).catch(() => {});
  }

  res.json({ success: true, message: 'If that email exists, a reset link has been sent' });
});

// ─── Reset Password ───────────────────────────────────────────
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError('Token and password required', 400);

  const result = await query(
    `SELECT id FROM users
     WHERE password_reset_token = $1
       AND password_reset_expires > NOW()
       AND deleted_at IS NULL`,
    [token]
  );

  if (!result.rows[0]) throw new AppError('Invalid or expired reset token', 400);

  const hash = await bcrypt.hash(password, 12);
  await query(
    `UPDATE users
     SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL
     WHERE id = $2`,
    [hash, result.rows[0].id]
  );

  // Revoke all refresh tokens
  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [result.rows[0].id]);

  await createAuditLog({
    actorId: result.rows[0].id,
    action: 'password_reset',
    entityType: 'user',
    entityId: result.rows[0].id,
    description: 'Password reset completed',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Password reset successful' });
});

// ─── Setup TOTP (2FA) ─────────────────────────────────────────
export const setup2FA = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userResult = await query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];

  const secret = speakeasy.generateSecret({
    name: `${process.env.TOTP_APP_NAME || 'DigitalDraw'} (${user.email})`,
    length: 20,
  });

  // Store secret temporarily (not enabled yet until verified)
  await query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret.base32, userId]);

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

  res.json({
    success: true,
    data: { secret: secret.base32, qrCode: qrCodeUrl },
  });
});

// ─── Verify & Enable 2FA ──────────────────────────────────────
export const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { totp_code } = req.body;

  const result = await query('SELECT totp_secret FROM users WHERE id = $1', [userId]);
  const { totp_secret } = result.rows[0];

  if (!totp_secret) throw new AppError('2FA setup not initiated', 400);

  const verified = speakeasy.totp.verify({
    secret: totp_secret,
    encoding: 'base32',
    token: totp_code,
    window: 1,
  });
  if (!verified) throw new AppError('Invalid 2FA code', 400);

  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );

  await query(
    'UPDATE users SET totp_enabled = TRUE, backup_codes = $1 WHERE id = $2',
    [backupCodes, userId]
  );

  await createAuditLog({
    actorId: userId,
    action: '2fa_enabled',
    entityType: 'user',
    entityId: userId,
    description: '2FA enabled for account',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: { backupCodes } });
});

// ─── Disable 2FA ──────────────────────────────────────────────
export const disable2FA = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { password } = req.body;

  const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) throw new AppError('Incorrect password', 401);

  await query(
    'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, backup_codes = NULL WHERE id = $1',
    [userId]
  );

  await createAuditLog({
    actorId: userId,
    action: '2fa_disabled',
    entityType: 'user',
    entityId: userId,
    description: '2FA disabled for account',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: '2FA disabled' });
});

// ─── Get Current User ─────────────────────────────────────────
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const result = await query(
    `SELECT id, email, role, status, full_name, phone, national_id,
            profile_image_url, company_name, organizer_license,
            email_verified, phone_verified, identity_verified,
            totp_enabled, last_login_at, created_at, balance
     FROM users WHERE id = $1`,
    [req.user!.userId]
  );
  if (!result.rows[0]) throw new AppError('User not found', 404);
  res.json({ success: true, data: result.rows[0] });
});

// ─── Change Password ──────────────────────────────────────────
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    throw new AppError('Current password and new password are required', 400);
  }
  if (new_password.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const user = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user!.userId]
  );
  if (!user.rows[0]) throw new AppError('User not found', 404);

  const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
  if (!valid) throw new AppError('Current password is incorrect', 400);

  const hash = await bcrypt.hash(new_password, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.userId]);

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'password_changed',
    entityType: 'user',
    entityId: req.user!.userId,
    description: 'Password changed',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Password updated' });
});

// ─── Update Profile ───────────────────────────────────────────
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { full_name, phone, company_name } = req.body;
  const result = await query(
    `UPDATE users SET full_name = COALESCE($1, full_name),
                      phone = COALESCE($2, phone),
                      company_name = COALESCE($3, company_name)
     WHERE id = $4
     RETURNING id, email, full_name, phone, company_name, role`,
    [full_name, phone, company_name, req.user!.userId]
  );
  res.json({ success: true, data: result.rows[0] });
});

// ─── Top Up Balance ───────────────────────────────────────────
export const topUpBalance = asyncHandler(async (req: Request, res: Response) => {
  const { amount, phone } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new AppError('Valid positive amount is required', 400);
  }

  const result = await query(
    'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING id, full_name, balance',
    [parseFloat(amount), req.user!.userId]
  );

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'balance_topup',
    entityType: 'user',
    entityId: req.user!.userId,
    description: `Self top-up of $${parseFloat(amount).toFixed(2)}${phone ? ` via ${phone}` : ''}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: result.rows[0], message: `$${parseFloat(amount).toFixed(2)} added to your balance` });
});
