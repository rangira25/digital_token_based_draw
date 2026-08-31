import { Router } from 'express';
import {
  issueTokens, requestToken, validateToken, submitEntry, getDrawTokens,
  revokeToken, getMyTokens, getMyEntries, getPoolInfo,
} from '../controllers/token.controller';
import {
  getWinners, claimPrize, updateWinnerStatus,
  getMyNotifications, markNotificationRead, markAllNotificationsRead,
  sendBroadcast, getAnalytics, getAuditLogs,
  adminListUsers, adminUpdateUser, adminDeleteUser, adminAddBalance,
} from '../controllers/misc.controller';
import { authenticate, authorize } from '../middleware/auth';

// ─── Token Routes ─────────────────────────────────────────────
export const tokenRouter = Router();
tokenRouter.post('/issue', authenticate, authorize('organizer', 'admin'), issueTokens);
tokenRouter.post('/request', authenticate, authorize('participant'), requestToken);
tokenRouter.get('/validate/:token_code', authenticate, validateToken);
tokenRouter.post('/submit-entry', authenticate, authorize('participant'), submitEntry);
tokenRouter.get('/draw/:drawId', authenticate, authorize('organizer', 'admin'), getDrawTokens);
tokenRouter.get('/pool/:drawId', authenticate, getPoolInfo);
tokenRouter.patch('/:id/revoke', authenticate, authorize('organizer', 'admin'), revokeToken);
tokenRouter.get('/my/tokens', authenticate, authorize('participant'), getMyTokens);
tokenRouter.get('/my/entries', authenticate, authorize('participant'), getMyEntries);

// ─── Winner Routes ────────────────────────────────────────────
export const winnerRouter = Router();
winnerRouter.get('/', authenticate, authorize('organizer', 'admin'), getWinners);
winnerRouter.post('/:id/claim', authenticate, claimPrize);
winnerRouter.patch('/:id/status', authenticate, authorize('organizer', 'admin'), updateWinnerStatus);

// ─── Notification Routes ──────────────────────────────────────
export const notificationRouter = Router();
notificationRouter.get('/', authenticate, getMyNotifications);
notificationRouter.post('/send', authenticate, authorize('organizer', 'admin'), sendBroadcast);
notificationRouter.post('/:id/read', authenticate, markNotificationRead);
notificationRouter.patch('/:id/read', authenticate, markNotificationRead);
notificationRouter.post('/read-all', authenticate, markAllNotificationsRead);
notificationRouter.patch('/read-all', authenticate, markAllNotificationsRead);

// ─── Analytics Routes ─────────────────────────────────────────
export const analyticsRouter = Router();
analyticsRouter.get('/', authenticate, authorize('organizer', 'admin'), getAnalytics);

// ─── Audit Routes ─────────────────────────────────────────────
export const auditRouter = Router();
auditRouter.get('/', authenticate, authorize('organizer', 'admin'), getAuditLogs);

// ─── Admin Routes ─────────────────────────────────────────────
export const adminRouter = Router();
adminRouter.get('/users', authenticate, authorize('admin', 'organizer'), adminListUsers);
adminRouter.patch('/users/:id', authenticate, authorize('admin'), adminUpdateUser);
adminRouter.delete('/users/:id', authenticate, authorize('admin'), adminDeleteUser);
adminRouter.post('/balance/:id', authenticate, authorize('admin'), adminAddBalance);
