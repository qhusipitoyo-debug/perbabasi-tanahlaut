/**
 * Audit log: jejak aktivitas penting (login, CRUD). Khusus admin.
 */
import { db } from '../db.js';
import { sendJson } from '../helpers.js';
import { authRequired } from '../middleware.js';

export function registerAuditRoutes(router) {
  router.get('/api/audit', authRequired('admin'), (req, res, ctx) => {
    const limit = Math.min(300, Math.max(1, parseInt(ctx.query.limit, 10) || 100));
    const rows = db
      .prepare(
        `SELECT a.id, a.action, a.detail, a.created_at, u.username, u.full_name
           FROM audit_log a
           LEFT JOIN users u ON u.id = a.user_id
          ORDER BY a.id DESC
          LIMIT ?`
      )
      .all(limit);
    sendJson(res, 200, { data: rows });
  });
}
