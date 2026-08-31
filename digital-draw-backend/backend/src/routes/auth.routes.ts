import { Router } from 'express';
import { body } from 'express-validator';
import {
  register, login, verifyEmail, refreshToken, logout,
  forgotPassword, resetPassword, setup2FA, verify2FA,
  disable2FA, getMe, updateProfile, changePassword, topUpBalance,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { verifyRecaptcha } from '../services/recaptcha.service';
import { AppError } from '../middleware/error';

const router = Router();

async function recaptchaMiddleware(req: any, _res: any, next: any) {
  const token = req.body.recaptcha_token;
  if (!token) return next(new AppError('reCAPTCHA verification required', 400));
  const valid = await verifyRecaptcha(token);
  if (!valid) return next(new AppError('reCAPTCHA verification failed', 400));
  next();
}

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').trim().notEmpty(),
  body('role').isIn(['participant', 'organizer']),
  body('recaptcha_token').notEmpty(),
  validateRequest,
  recaptchaMiddleware,
], register);

router.post('/verify-email', [
  body('token').notEmpty(),
  validateRequest,
], verifyEmail);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('recaptcha_token').notEmpty(),
  validateRequest,
  recaptchaMiddleware,
], login);

router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
  validateRequest,
], forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  validateRequest,
], resetPassword);

// 2FA routes (organizer + admin only)
router.post('/2fa/setup', authenticate, authorize('organizer', 'admin'), setup2FA);
router.post('/2fa/verify', authenticate, authorize('organizer', 'admin'), verify2FA);
router.post('/2fa/disable', authenticate, authorize('organizer', 'admin'), disable2FA);

// Password
router.post('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }),
  validateRequest,
], changePassword);

// Profile
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateProfile);

// Balance
router.post('/topup', authenticate, topUpBalance);

export default router;
