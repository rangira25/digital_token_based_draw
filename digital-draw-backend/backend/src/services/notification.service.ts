import { query } from '../config/database';
import { NotificationType } from '../types';

export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, unknown> = {}
): Promise<void> => {
  await query(
    `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, JSON.stringify(data)]
  );
};

export const createBulkNotifications = async (
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, unknown> = {}
): Promise<void> => {
  if (userIds.length === 0) return;
  const values = userIds
    .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
    .join(', ');
  const params = userIds.flatMap((id) => [
    id,
    type,
    title,
    message,
    JSON.stringify(data),
  ]);
  await query(
    `INSERT INTO notifications (user_id, type, title, message, data) VALUES ${values}`,
    params
  );
};
