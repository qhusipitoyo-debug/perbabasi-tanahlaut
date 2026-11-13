/**
 * CRUD kategori pemasukan / pengeluaran.
 */
import { db } from '../db.js';
import { sendJson, sendError, audit } from '../helpers.js';
import { authRequired } from '../middleware.js';

export function registerCategoryRoutes(router) {
  router.get('/api/categories', authRequired(), (req, res, ctx) => {
    const { type } = ctx.query;
    const rows = type === 'masuk' || type === 'keluar'
      ? db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type)
      : db.prepare('SELECT * FROM categories ORDER BY type, name').all();
    sendJson(res, 200, { data: rows });
  });

  router.post('/api/categories', authRequired(), (req, res, ctx) => {
    const { name, type } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama kategori wajib diisi');
    if (!['masuk', 'keluar'].includes(type)) return sendError(res, 400, "Tipe harus 'masuk' atau 'keluar'");
    try {
      const result = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)').run(String(name).trim(), type);
      audit(ctx.user.id, 'CREATE_KATEGORI', `Tambah kategori "${name}" (${type})`);
      sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Kategori sudah ada');
      throw err;
    }
  });

  router.put('/api/categories/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Kategori tidak ditemukan');
    const { name, type } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama kategori wajib diisi');
    if (!['masuk', 'keluar'].includes(type)) return sendError(res, 400, "Tipe harus 'masuk' atau 'keluar'");
    try {
      db.prepare('UPDATE categories SET name = ?, type = ? WHERE id = ?').run(String(name).trim(), type, id);
      audit(ctx.user.id, 'UPDATE_KATEGORI', `Ubah kategori #${id} menjadi "${name}"`);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Kategori sudah ada');
      throw err;
    }
  });

  router.delete('/api/categories/:id', authRequired('admin'), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Kategori tidak ditemukan');
    const used = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?').get(id).n;
    if (used > 0) return sendError(res, 409, `Kategori dipakai ${used} transaksi. Transaksi akan kehilangan kategori jika dihapus paksa — gunakan edit sebagai gantinya.`);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    audit(ctx.user.id, 'DELETE_KATEGORI', `Hapus kategori "${existing.name}"`);
    sendJson(res, 200, { ok: true });
  });
}
