/**
 * Iuran anggota per bulan: daftar status (lunas/belum), catat pembayaran, batalkan.
 */
import { db } from '../db.js';
import { sendJson, sendError, audit, isValidPeriod, isValidDateString, toIntAmount } from '../helpers.js';
import { authRequired } from '../middleware.js';

export function registerDuesRoutes(router) {
  router.get('/api/dues', authRequired(), (req, res, ctx) => {
    const period = isValidPeriod(ctx.query.period) ? ctx.query.period : new Date().toISOString().slice(0, 7);
    const rows = db
      .prepare(
        `SELECT m.id AS member_id, m.member_no, m.name, m.position, m.team, m.active,
                d.id AS due_id, d.amount, d.paid_date, d.note
           FROM members m
           LEFT JOIN member_dues d ON d.member_id = m.id AND d.period = ?
          WHERE m.active = 1
          ORDER BY m.name ASC`
      )
      .all(period);

    const terkumpul = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM member_dues WHERE period = ?').get(period).total;
    const lunas = rows.filter((r) => r.due_id).length;
    sendJson(res, 200, {
      period,
      data: rows,
      summary: { totalAnggota: rows.length, lunas, belum: rows.length - lunas, terkumpul },
    });
  });

  router.post('/api/dues', authRequired(), (req, res, ctx) => {
    const { member_id, period, amount, paid_date, note = '' } = ctx.body || {};
    const memberId = Number(member_id);
    const member = db.prepare('SELECT id, name FROM members WHERE id = ?').get(memberId);
    if (!member) return sendError(res, 400, 'Anggota tidak ditemukan');
    if (!isValidPeriod(period)) return sendError(res, 400, 'Periode tidak valid (format YYYY-MM)');
    const amt = toIntAmount(amount);
    if (!amt || amt <= 0) return sendError(res, 400, 'Nominal iuran harus lebih dari 0');
    const paidDate = isValidDateString(paid_date) ? paid_date : new Date().toISOString().slice(0, 10);
    try {
      const result = db
        .prepare('INSERT INTO member_dues (member_id, period, amount, paid_date, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?)')
        .run(member.id, period, amt, paidDate, String(note).slice(0, 200), ctx.user.id);
      audit(ctx.user.id, 'BAYAR_IURAN', `Iuran ${period} — ${member.name} Rp${amt}`);
      sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Anggota ini sudah tercatat membayar iuran periode tersebut');
      throw err;
    }
  });

  router.delete('/api/dues/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db
      .prepare('SELECT d.*, m.name FROM member_dues d JOIN members m ON m.id = d.member_id WHERE d.id = ?')
      .get(id);
    if (!existing) return sendError(res, 404, 'Data iuran tidak ditemukan');
    db.prepare('DELETE FROM member_dues WHERE id = ?').run(id);
    audit(ctx.user.id, 'BATAL_IURAN', `Batalkan iuran ${existing.period} — ${existing.name}`);
    sendJson(res, 200, { ok: true });
  });
}
