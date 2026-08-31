import { query } from '../config/database';

interface AuditParams {
  actorId?: string | undefined;
  action: string;
  entityType?: string | undefined;
  entityId?: string | undefined;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export const createAuditLog = async (params: AuditParams): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, description, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.actorId || null,
        params.action,
        params.entityType || null,
        params.entityId || null,
        params.description,
        JSON.stringify(params.metadata || {}),
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );
  } catch (err) {
    // Audit failures should never crash the app
    console.error('[AuditLog] Failed to write audit log:', err);
  }
};
