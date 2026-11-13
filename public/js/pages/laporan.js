/**
 * Halaman Laporan: arus kas per periode — bisa dicetak (print CSS) & diunduh CSV.
 */
import { api } from '../api.js';
import { esc, fmtIDR, fmtDate, todayISO, toast } from '../util.js';

export async function renderLaporan(view) {
  const today = todayISO();
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  view.innerHTML = `
    <div class="card" id="report-card">
      <div class="brand-block">
        <img src="/icons/logo.png" alt="Logo Perbasasi Tanah Laut" />
        <div>
          <h1>PERBASI TANAH LAUT</h1>
          <p>Perserikatan Baseball Softball Seluruh Indonesia — Pengurus Kabupaten Tanah Laut</p>
          <p>Laporan Arus Kas Resmi</p>
        </div>
      </div>

      <div class="card-header no-print">
        <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Laporan Arus Kas</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" id="report-csv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>CSV</button>
          <button class="btn btn-dark btn-sm" id="report-print"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>Cetak</button>
        </div>
      </div>

      <div class="card-body">
        <div class="toolbar no-print" style="margin-bottom:14px">
          <label class="field" style="gap:4px"><span class="field-label">Dari</span><input type="date" id="rp-from" class="input" value="${firstOfMonth}" /></label>
          <label class="field" style="gap:4px"><span class="field-label">Sampai</span><input type="date" id="rp-to" class="input" value="${today}" /></label>
          <button class="btn btn-primary" id="rp-apply" style="align-self:flex-end">Tampilkan</button>
        </div>

        <div class="print-only" id="report-period-line" style="margin-bottom:10px;font-size:10pt;color:#333"></div>

        <div class="report-summary" id="report-summary"></div>

        <div class="table-wrap" style="margin-top:12px">
          <table class="table">
            <thead><tr><th>Tanggal</th><th>No. Bukti</th><th>Uraian</th><th>Kas</th><th class="num">Pemasukan</th><th class="num">Pengeluaran</th></tr></thead>
            <tbody id="report-tbody"><tr class="empty-row"><td colspan="6">Memuat…</td></tr></tbody>
            <tfoot id="report-tfoot"></tfoot>
          </table>
        </div>
        <p class="print-only" style="margin-top:26px;font-size:9pt;color:#444">Dicetak pada <span id="report-printed-at"></span> · Aplikasi Bendahara PERBASI Tanah Laut</p>
      </div>
    </div>`;

  const state = { from: firstOfMonth, to: today };

  const reload = async () => {
    try {
      const res = await api.get(`/api/reports/cashflow?from=${state.from}&to=${state.to}`);
      const { summary, data } = res;

      document.getElementById('report-period-line').textContent = `Periode: ${fmtDate(state.from)} s.d. ${fmtDate(state.to)} · Jumlah transaksi: ${summary.jumlah}`;
      document.getElementById('report-printed-at').textContent = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

      document.getElementById('report-summary').innerHTML = `
        <div class="rs-item"><div class="rs-label">Pemasukan</div><div class="rs-value" style="color:var(--green)">${fmtIDR(summary.masuk)}</div></div>
        <div class="rs-item"><div class="rs-label">Pengeluaran</div><div class="rs-value" style="color:var(--red)">${fmtIDR(summary.keluar)}</div></div>
        <div class="rs-item"><div class="rs-label">Selisih</div><div class="rs-value">${fmtIDR(summary.selisih)}</div></div>`;

      const tbody = document.getElementById('report-tbody');
      tbody.innerHTML = data.length === 0
        ? '<tr class="empty-row"><td colspan="6">Tidak ada transaksi pada periode ini</td></tr>'
        : data.map((t) => `
          <tr>
            <td>${fmtDate(t.date)}</td>
            <td>${esc(t.ref_no || '—')}</td>
            <td>${esc(t.note || t.category_name || '—')}<div style="font-size:0.68rem;color:var(--muted)">${esc(t.category_name || '')}</div></td>
            <td>${esc(t.kas_name)}</td>
            <td class="num">${t.type === 'masuk' ? fmtIDR(t.amount) : ''}</td>
            <td class="num">${t.type === 'keluar' ? fmtIDR(t.amount) : ''}</td>
          </tr>`).join('');

      document.getElementById('report-tfoot').innerHTML = `
        <tr style="font-weight:800;border-top:2px solid var(--border)">
          <td colspan="4">TOTAL PERIODE</td>
          <td class="num">${fmtIDR(summary.masuk)}</td>
          <td class="num">${fmtIDR(summary.keluar)}</td>
        </tr>
        <tr style="font-weight:800">
          <td colspan="4">SELISIH (PEMASUKAN − PENGELUARAN)</td>
          <td class="num" colspan="2">${fmtIDR(summary.selisih)}</td>
        </tr>`;
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  document.getElementById('rp-apply').addEventListener('click', () => {
    state.from = document.getElementById('rp-from').value || firstOfMonth;
    state.to = document.getElementById('rp-to').value || today;
    reload();
  });
  document.getElementById('rp-from').addEventListener('change', () => document.getElementById('rp-apply').click());
  document.getElementById('rp-to').addEventListener('change', () => document.getElementById('rp-apply').click());
  document.getElementById('report-print').addEventListener('click', () => window.print());
  document.getElementById('report-csv').addEventListener('click', () => {
    api.download(`/api/reports/cashflow.csv?from=${state.from}&to=${state.to}`, `laporan-arus-kas_${state.from}_sd_${state.to}.csv`).catch((err) => toast(err.message, 'error'));
  });

  await reload();
}
