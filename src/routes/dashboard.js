/**
 * Dashboard: ringkasan saldo, statistik bulan berjalan, tren 6 bulan,
 * pengeluaran per kategori, saldo per kas & transaksi terbaru.
 */
import { db, kasBalances } from '../db.js';
import { sendJson } from '../helpers.js';
import { authRequired } from '../middleware.js';

export function registerDashboardRoutes(router) {
  router.get('/api/dashboard/summary', authRequired(), (req, res) => {
    const balances = kasBalances();
    const saldoTotal = balances.reduce((sum, k) => sum + k.balance, 0);

    const ym = new Date().toISOString().slice(0, 7);
    const month = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'masuk'  THEN amount END), 0) AS masuk,
           COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount END), 0) AS keluar
         FROM transactions
         WHERE strftime('%Y-%m', date) = ?`
      )
      .get(ym);

    // Tren 6 bulan terakhir
    const chart6 = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN type = 'masuk'  THEN amount END), 0) AS masuk,
             COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount END), 0) AS keluar
           FROM transactions WHERE strftime('%Y-%m', date) = ?`
        )
        .get(key);
      chart6.push({
        month: key,
        label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        masuk: row.masuk,
        keluar: row.keluar,
      });
    }

    const kategoriKeluar = db
      .prepare(
        `SELECT c.name, SUM(t.amount) AS total
           FROM transactions t JOIN categories c ON c.id = t.category_id
          WHERE t.type = 'keluar' AND strftime('%Y-%m', t.date) = ?
          GROUP BY c.id
          ORDER BY total DESC
          LIMIT 6`
      )
      .all(ym);

    const terbaru = db
      .prepare(
        `SELECT t.id, t.type, t.amount, t.date, t.ref_no, t.note,
                k.name AS kas_name, c.name AS category_name
           FROM transactions t
           JOIN kas k ON k.id = t.kas_id
           LEFT JOIN categories c ON c.id = t.category_id
          ORDER BY t.date DESC, t.id DESC
          LIMIT 8`
      )
      .all();

    const totalAnggota = db.prepare('SELECT COUNT(*) AS n FROM members WHERE active = 1').get().n;
    const iuranTerkumpul = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM member_dues WHERE strftime(\'%Y-%m\', paid_date) = ?')
      .get(ym).total;

    sendJson(res, 200, {
      saldoTotal,
      bulanIni: { masuk: month.masuk, keluar: month.keluar, selisih: month.masuk - month.keluar, periode: ym },
      chart6,
      kategoriKeluar,
      saldoPerKas: balances,
      transaksiTerbaru: terbaru,
      totalAnggota,
      iuranTerkumpul,
    });
  });
}
