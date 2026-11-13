/**
 * CRUD transaksi keuangan (pemasukan / pengeluaran) dengan filter & pagination.
 */
import { db } from '../db.js';
import { sendJson, sendError, audit, isValidDateString, toIntAmount } from '../helpers.js';
import { authRequired } from '../middleware.js';

function validatePayload(body, res) {
  const type = body.type;
  if (!['masuk', 'keluar'].includes(type)) {
    sendError(res, 400, "Tipe transaksi harus 'masuk' atau 'keluar'");
    return null;
  }
  const kasId = Number(body.kas_id);
  if (!Number.isInteger(kasId) || !db.prepare('SELECT id FROM kas WHERE id = ?').get(kasId)) {
    sendError(res, 400, 'Kas tidak ditemukan');
    return null;
  }
  let categoryId = body.category_id === '' || body.category_id == null ? null : Number(body.category_id);
  if (categoryId !== null) {
    const cat = db.prepare('SELECT id, type FROM categories WHERE id = ?').get(categoryId);
    if (!cat) {
      sendError(res, 400, 'Kategori tidak ditemukan');
      return null;
    }
    if (cat.type !== type) {
      sendError(res, 400, `Kategori tidak cocok: kategori ini untuk transaksi '${cat.type === 'masuk' ? 'pemasukan' : 'pengeluaran'}'`);
      return null;
    }
  }
  const amount = toIntAmount(body.amount);
  if (!amount || amount <= 0) {
    sendError(res, 400, 'Nominal harus angka lebih dari 0');
    return null;
  }
  if (!isValidDateString(body.date)) {
    sendError(res, 400, 'Tanggal tidak valid (format YYYY-MM-DD)');
    return null;
  }
  return {
    type,
    kasId,
    categoryId,
    amount,
    date: body.date,
    ref_no: String(body.ref_no || '').slice(0, 60),
    note: String(body.note || '').slice(0, 300),
  };
}

export function registerTransactionRoutes(router) {
  router.get('/api/transactions', authRequired(), (req, res, ctx) => {
    const { page = '1', limit = '10', search = '', type = '', kas_id = '', category_id = '', from = '', to = '' } = ctx.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const where = [];
    const params = [];
    if (type === 'masuk' || type === 'keluar') { where.push('t.type = ?'); params.push(type); }
    if (kas_id) { where.push('t.kas_id = ?'); params.push(Number(kas_id)); }
    if (category_id) { where.push('t.category_id = ?'); params.push(Number(category_id)); }
    if (isValidDateString(from)) { where.push('t.date >= ?'); params.push(from); }
    if (isValidDateString(to)) { where.push('t.date <= ?'); params.push(to); }
    if (search.trim()) {
      where.push('(t.note LIKE ? OR t.ref_no LIKE ? OR c.name LIKE ? OR k.name LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM transactions t LEFT JOIN categories c ON c.id = t.category_id JOIN kas k ON k.id = t.kas_id ${whereSql}`)
      .get(...params).n;

    const rows = db
      .prepare(
        `SELECT t.*, k.name AS kas_name, c.name AS category_name
           FROM transactions t
           JOIN kas k ON k.id = t.kas_id
           LEFT JOIN categories c ON c.id = t.category_id
           ${whereSql}
          ORDER BY t.date DESC, t.id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limitNum, (pageNum - 1) * limitNum);

    const totals = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN t.type = 'masuk'  THEN t.amount END), 0) AS total_masuk,
           COALESCE(SUM(CASE WHEN t.type = 'keluar' THEN t.amount END), 0) AS total_keluar
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
           JOIN kas k ON k.id = t.kas_id ${whereSql}`
      )
      .get(...params);

    sendJson(res, 200, {
      data: rows,
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
      totals,
    });
  });

  router.post('/api/transactions', authRequired(), (req, res, ctx) => {
    const v = validatePayload(ctx.body || {}, res);
    if (!v) return;
    const result = db
      .prepare('INSERT INTO transactions (kas_id, category_id, type, amount, date, ref_no, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(v.kasId, v.categoryId, v.type, v.amount, v.date, v.ref_no, v.note, ctx.user.id);
    audit(ctx.user.id, 'CREATE_TRANSAKSI', `Transaksi ${v.type} Rp${v.amount} (${v.date})`);
    sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  });

  router.put('/api/transactions/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Transaksi tidak ditemukan');
    const v = validatePayload(ctx.body || {}, res);
    if (!v) return;
    db.prepare('UPDATE transactions SET kas_id = ?, category_id = ?, type = ?, amount = ?, date = ?, ref_no = ?, note = ? WHERE id = ?')
      .run(v.kasId, v.categoryId, v.type, v.amount, v.date, v.ref_no, v.note, id);
    audit(ctx.user.id, 'UPDATE_TRANSAKSI', `Ubah transaksi #${id} (${v.type} Rp${v.amount})`);
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/transactions/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Transaksi tidak ditemukan');
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    audit(ctx.user.id, 'DELETE_TRANSAKSI', `Hapus transaksi #${id} (${existing.type} Rp${existing.amount}, ${existing.date})`);
    sendJson(res, 200, { ok: true });
  });
}
