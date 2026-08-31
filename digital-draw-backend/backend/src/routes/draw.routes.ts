import { Router } from 'express';
import { body } from 'express-validator';
import {
  listDraws, getDraw, createDraw, updateDraw, deleteDraw,
  executeDraw, getDrawWinners, updateDrawStatus,
} from '../controllers/draw.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';

const router = Router();

// Public / optional auth
router.get('/', optionalAuth, listDraws);
router.get('/:id', optionalAuth, getDraw);
router.get('/:id/winners', optionalAuth, getDrawWinners);

// Organizer / Admin only
router.post('/', authenticate, authorize('organizer', 'admin'), [
  body('title').trim().notEmpty(),
  body('registration_start').isISO8601(),
  body('registration_end').isISO8601(),
  body('draw_date').isISO8601(),
  validateRequest,
], createDraw);

router.patch('/:id', authenticate, authorize('organizer', 'admin'), updateDraw);
router.delete('/:id', authenticate, authorize('organizer', 'admin'), deleteDraw);

router.post('/:id/execute', authenticate, authorize('organizer', 'admin'), executeDraw);
router.patch('/:id/status', authenticate, authorize('organizer', 'admin'), [
  body('status').isIn(['open', 'closed', 'cancelled']),
  validateRequest,
], updateDrawStatus);

export default router;
