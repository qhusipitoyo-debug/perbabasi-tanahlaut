/**
 * Kelola pengguna (khusus admin): daftar, tambah, ubah, aktif/nonaktif, reset password.
 */
import { db } from '../db.js';
import { hashPassword } from '../auth.js';
import { sendJson, sendError, audit } from '../helpers.js';
import { authRequired } from '../middleware.js';

export function registerUserRoutes(router) {
  router.get('/api/users', authRequired('admin'), (req, res) => {
    const rows = db.prepare('SELECT id, username, full_name, role, active, created_at FROM users ORDER BY id').all();
    sendJson(res, 200, { data: rows });
  });

  router.post('/api/users', authRequired('admin'), (req, res, ctx) => {
    const { username, password, full_name, role = 'bendahara' } = ctx.body || {};
    if (!username || !String(username).trim()) return sendError(res, 400, 'Username wajib diisi');
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(String(username).trim())) {
      return sendError(res, 400, 'Username 3–40 karakter: huruf, angka, titik, strip, underscore');
    }
    if (!password || String(password).length < 6) return sendError(res, 400, 'Password minimal 6 karakter');
    if (!full_name || !String(full_name).trim()) return sendError(res, 400, 'Nama lengkap wajib diisi');
    if (!['admin', 'bendahara'].includes(role)) return sendError(res, 400, 'Role tidak valid');
    try {
      const result = db
        .prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
        .run(String(username).trim(), hashPassword(password), String(full_name).trim(), role);
      audit(ctx.user.id, 'CREATE_USER', `Tambah user "${username}" (${role})`);
      sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Username sudah dipakai');
      throw err;
    }
  });

  router.put('/api/users/:id', authRequired('admin'), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Pengguna tidak ditemukan');
    const { full_name, role, active } = ctx.body || {};
    if (!full_name || !String(full_name).trim()) return sendError(res, 400, 'Nama lengkap wajib diisi');
    if (!['admin', 'bendahara'].includes(role)) return sendError(res, 400, 'Role tidak valid');

    // Jangan biarkan admin terakhir dinonaktifkan / diturunkan rolenya
    const isSelf = id === ctx.user.id;
    const willDemote = existing.role === 'admin' && role !== 'admin';
    const willDeactivate = existing.active && !active;
    if (willDemote || willDeactivate) {
      const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
      if (adminCount <= 1) return sendError(res, 409, 'Minimal harus ada 1 admin aktif');
    }

    db.prepare('UPDATE users SET full_name = ?, role = ?, active = ? WHERE id = ?')
      .run(String(full_name).trim(), role, active ? 1 : 0, id);
    audit(ctx.user.id, 'UPDATE_USER', `Ubah user #${id} (${role}${active ? '' : ', nonaktif'})`);
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/users/:id/reset-password', authRequired('admin'), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Pengguna tidak ditemukan');
    const { newPassword } = ctx.body || {};
    if (!newPassword || String(newPassword).length < 6) return sendError(res, 400, 'Password baru minimal 6 karakter');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), id);
    audit(ctx.user.id, 'RESET_PASSWORD', `Reset password user "${existing.username}"`);
    sendJson(res, 200, { ok: true });
  });
}
