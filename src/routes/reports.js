/**
 * Laporan: arus kas per periode (JSON untuk cetak) + export CSV.
 */
import { db } from '../db.js';
import { sendJson, sendError, toCsv, sendCsv, isValidDateString, isValidPeriod } from '../helpers.js';
import { authRequired } from '../middleware.js';

function queryCashflow(from, to) {
  const rows = db
    .prepare(
      `SELECT t.id, t.date, t.type, t.amount, t.ref_no, t.note,
              k.name AS kas_name, c.name AS category_name
         FROM transactions t
         JOIN kas k ON k.id = t.kas_id
         LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.date >= ? AND t.date <= ?
        ORDER BY t.date ASC, t.id ASC`
    )
    .all(from, to);
  const masuk = rows.filter((r) => r.type === 'masuk').reduce((s, r) => s + r.amount, 0);
  const keluar = rows.filter((r) => r.type === 'keluar').reduce((s, r) => s + r.amount, 0);
  return { rows, summary: { masuk, keluar, selisih: masuk - keluar, jumlah: rows.length } };
}

export function registerReportRoutes(router) {
  const parseRange = (query) => {
    const today = new Date();
    const defTo = today.toISOString().slice(0, 10);
    const defFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const from = isValidDateString(query.from) ? query.from : defFrom;
    const to = isValidDateString(query.to) ? query.to : defTo;
    return { from, to };
  };

  router.get('/api/reports/cashflow', authRequired(), (req, res, ctx) => {
    const { from, to } = parseRange(ctx.query);
    const { rows, summary } = queryCashflow(from, to);
    sendJson(res, 200, { from, to, summary, data: rows });
  });

  router.get('/api/reports/cashflow.csv', authRequired(), (req, res, ctx) => {
    const { from, to } = parseRange(ctx.query);
    const { rows, summary } = queryCashflow(from, to);
    const headers = ['Tanggal', 'Tipe', 'Kas', 'Kategori', 'No. Bukti', 'Keterangan', 'Nominal'];
    const body = rows.map((r) => [
      r.date,
      r.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
      r.kas_name,
      r.category_name || '-',
      r.ref_no || '-',
      r.note || '-',
      r.amount,
    ]);
    body.push([]);
    body.push(['', '', '', '', '', 'TOTAL PEMASUKAN', summary.masuk]);
    body.push(['', '', '', '', '', 'TOTAL PENGELUARAN', summary.keluar]);
    body.push(['', '', '', '', '', 'SELISIH', summary.selisih]);
    sendCsv(res, `laporan-arus-kas_${from}_sd_${to}.csv`, toCsv(headers, body));
  });

  router.get('/api/reports/dues.csv', authRequired(), (req, res, ctx) => {
    const period = isValidPeriod(ctx.query.period) ? ctx.query.period : new Date().toISOString().slice(0, 7);
    const rows = db
      .prepare(
        `SELECT m.member_no, m.name, m.team, m.position,
                d.amount, d.paid_date, d.note
           FROM members m
           LEFT JOIN member_dues d ON d.member_id = m.id AND d.period = ?
          WHERE m.active = 1
          ORDER BY m.name ASC`
      )
      .all(period);
    const headers = ['No. Anggota', 'Nama', 'Tim/Kelompok', 'Posisi/Jabatan', 'Status', 'Nominal', 'Tanggal Bayar', 'Catatan'];
    const body = rows.map((r) => [
      r.member_no || '-',
      r.name,
      r.team || '-',
      r.position || '-',
      r.amount ? 'LUNAS' : 'BELUM BAYAR',
      r.amount || 0,
      r.paid_date || '-',
      r.note || '',
    ]);
    sendCsv(res, `laporan-iuran_${period}.csv`, toCsv(headers, body));
  });
}
