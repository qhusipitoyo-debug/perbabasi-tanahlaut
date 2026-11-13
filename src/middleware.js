/**
 * Middleware autentikasi & otorisasi berbasis JWT.
 */
import { verifyJwt } from './auth.js';
import { config } from './config.js';
import { db } from './db.js';
import { sendError } from './helpers.js';

export function authRequired(...roles) {
  return (req, res, ctx) => {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      sendError(res, 401, 'Akses ditolak: token tidak ditemukan. Silakan login.');
      return;
    }
    let payload;
    try {
      payload = verifyJwt(match[1], config.jwtSecret);
    } catch (err) {
      sendError(res, 401, err.message || 'Token tidak valid');
      return;
    }
    // Pastikan user masih ada & aktif (agar akun nonaktif langsung terkunci)
    const user = db.prepare('SELECT id, username, full_name, role, active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.active) {
      sendError(res, 401, 'Akun tidak aktif atau sudah dihapus.');
      return;
    }
    ctx.user = { id: user.id, username: user.username, name: user.full_name, role: user.role };
    if (roles.length > 0 && !roles.includes(user.role)) {
      sendError(res, 403, `Akses ditolak: menu ini khusus role ${roles.join(' / ')}.`);
      return;
    }
  };
}
