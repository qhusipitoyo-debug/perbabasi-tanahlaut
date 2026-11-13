/**
 * CRUD akun / dompet kas (tunai, bank, e-wallet) beserta saldo terhitung.
 */
import { db, kasBalances } from '../db.js';
import { sendJson, sendError, audit, toIntAmount } from '../helpers.js';
import { authRequired } from '../middleware.js';

const VALID_TYPES = ['tunai', 'bank', 'ewallet', 'lainnya'];

export function registerKasRoutes(router) {
  router.get('/api/kas', authRequired(), (req, res) => {
    sendJson(res, 200, { data: kasBalances() });
  });

  router.post('/api/kas', authRequired('admin', 'bendahara'), (req, res, ctx) => {
    const { name, type = 'tunai', opening_balance = 0, note = '' } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama kas wajib diisi');
    if (!VALID_TYPES.includes(type)) return sendError(res, 400, 'Tipe kas tidak valid');
    const opening = toIntAmount(opening_balance);
    if (opening === null) return sendError(res, 400, 'Saldo awal harus berupa angka');
    try {
      const result = db
        .prepare('INSERT INTO kas (name, type, opening_balance, note) VALUES (?, ?, ?, ?)')
        .run(String(name).trim(), type, opening, String(note).slice(0, 200));
      audit(ctx.user.id, 'CREATE_KAS', `Tambah kas "${name}"`);
      sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Nama kas sudah dipakai');
      throw err;
    }
  });

  router.put('/api/kas/:id', authRequired('admin', 'bendahara'), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM kas WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Kas tidak ditemukan');
    const { name, type, opening_balance, note = '' } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama kas wajib diisi');
    if (!VALID_TYPES.includes(type)) return sendError(res, 400, 'Tipe kas tidak valid');
    const opening = toIntAmount(opening_balance);
    if (opening === null) return sendError(res, 400, 'Saldo awal harus berupa angka');
    try {
      db.prepare('UPDATE kas SET name = ?, type = ?, opening_balance = ?, note = ? WHERE id = ?')
        .run(String(name).trim(), type, opening, String(note).slice(0, 200), id);
      audit(ctx.user.id, 'UPDATE_KAS', `Ubah kas #${id} "${name}"`);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Nama kas sudah dipakai');
      throw err;
    }
  });

  router.delete('/api/kas/:id', authRequired('admin'), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM kas WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Kas tidak ditemukan');
    const used = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE kas_id = ?').get(id).n;
    if (used > 0) return sendError(res, 409, `Kas tidak bisa dihapus karena dipakai ${used} transaksi`);
    db.prepare('DELETE FROM kas WHERE id = ?').run(id);
    audit(ctx.user.id, 'DELETE_KAS', `Hapus kas "${existing.name}"`);
    sendJson(res, 200, { ok: true });
  });
}
