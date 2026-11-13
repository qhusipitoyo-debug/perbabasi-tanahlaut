/**
 * Halaman Dashboard: stat cards, grafik 6 bulan, donut kategori,
 * saldo per kas dan transaksi terbaru.
 */
import { api } from '../api.js';
import { esc, fmtIDR, fmtDate, animateCount, toast } from '../util.js';
import { renderCashflowChart, renderDonutChart, donutLegend } from '../charts.js';

export async function renderDashboard(view) {
  view.innerHTML = `<div class="card card-pad" style="text-align:center;color:var(--muted)">Memuat dashboard…</div>`;

  let data;
  try {
    data = await api.get('/api/dashboard/summary');
  } catch (err) {
    view.innerHTML = `<div class="card card-pad"><p class="alert alert-error">${esc(err.message)}</p></div>`;
    return;
  }

  const { saldoTotal, bulanIni, chart6, kategoriKeluar, saldoPerKas, transaksiTerbaru, totalAnggota, iuranTerkumpul } = data;
  const selisihPositif = bulanIni.selisih >= 0;

  view.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/></svg></div>
        <div class="stat-label">Saldo Total</div>
        <div class="stat-value" id="stat-saldo">Rp 0</div>
        <div class="stat-meta">Gabungan semua kas &amp; rekening</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
        <div class="stat-label">Pemasukan Bulan Ini</div>
        <div class="stat-value pos" id="stat-masuk">Rp 0</div>
        <div class="stat-meta">Periode ${esc(bulanIni.periode)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg></div>
        <div class="stat-label">Pengeluaran Bulan Ini</div>
        <div class="stat-value neg" id="stat-keluar">Rp 0</div>
        <div class="stat-meta">Periode ${esc(bulanIni.periode)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/><path d="M12 7.5v9"/></svg></div>
        <div class="stat-label">Iuran Terkumpul</div>
        <div class="stat-value" id="stat-iuran">Rp 0</div>
        <div class="stat-meta">${esc(String(totalAnggota))} anggota aktif · selisih <strong class="${selisihPositif ? 'pos' : 'neg'}">${selisihPositif ? '+' : '−'}${fmtIDR(Math.abs(bulanIni.selisih))}</strong></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Arus Kas 6 Bulan Terakhir</div>
          <div class="legend">
            <span class="legend-item"><span class="legend-dot" style="background:#16a34a"></span>Pemasukan</span>
            <span class="legend-item"><span class="legend-dot" style="background:#ef4444"></span>Pengeluaran</span>
          </div>
        </div>
        <div class="card-body"><canvas id="chart-cashflow" style="width:100%;height:230px" role="img" aria-label="Grafik arus kas 6 bulan"></canvas></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 2l-10 10"/><path d="M16 2h6v6"/></svg>Pengeluaran per Kategori (bulan ini)</div>
        </div>
        <div class="card-body">
          <canvas id="chart-donut" style="width:100%;height:170px" role="img" aria-label="Diagram pengeluaran per kategori"></canvas>
          <div class="legend" id="donut-legend" style="margin-top:12px">${donutLegend(kategoriKeluar)}</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>Transaksi Terbaru</div>
          <button class="btn btn-outline btn-sm" id="goto-transaksi">Lihat semua →</button></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Kas</th><th class="num">Nominal</th></tr></thead>
            <tbody>
              ${transaksiTerbaru.length === 0 ? '<tr class="empty-row"><td colspan="4">Belum ada transaksi</td></tr>' : transaksiTerbaru.map((t) => `
                <tr>
                  <td>${fmtDate(t.date)}<div style="font-size:0.7rem;color:var(--muted)">${esc(t.ref_no || '')}</div></td>
                  <td><span class="badge badge-${t.type}">${t.type === 'masuk' ? 'MASUK' : 'KELUAR'}</span> ${esc(t.note || t.category_name || '—')}</td>
                  <td>${esc(t.kas_name)}</td>
                  <td class="num ${t.type === 'masuk' ? 'pos' : 'neg'}" style="font-weight:700">${t.type === 'masuk' ? '+' : '−'} ${fmtIDR(t.amount)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/></svg>Saldo per Kas</div></div>
        <div class="card-body kas-list">
          ${saldoPerKas.map((k) => `
            <div class="kas-item">
              <div class="kas-icon ${esc(k.type)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${kasIcon(k.type)}</svg></div>
              <div><div class="kas-name">${esc(k.name)}</div><div class="kas-type">${esc(k.type)}</div></div>
              <div class="kas-balance ${k.balance < 0 ? 'neg' : ''}">${fmtIDR(k.balance)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  // Animasi angka
  animateCount(document.getElementById('stat-saldo'), saldoTotal, fmtIDR);
  animateCount(document.getElementById('stat-masuk'), bulanIni.masuk, fmtIDR);
  animateCount(document.getElementById('stat-keluar'), bulanIni.keluar, fmtIDR);
  animateCount(document.getElementById('stat-iuran'), iuranTerkumpul, fmtIDR);

  const drawCharts = () => {
    renderCashflowChart(document.getElementById('chart-cashflow'), chart6);
    renderDonutChart(document.getElementById('chart-donut'), kategoriKeluar);
  };
  drawCharts();
  const onTheme = () => drawCharts();
  window.addEventListener('ptl:themechange', onTheme, { once: false });
  window.addEventListener('resize', drawCharts, { passive: true });

  document.getElementById('goto-transaksi').addEventListener('click', () => { window.location.hash = '#/transaksi'; });
}

function kasIcon(type) {
  switch (type) {
    case 'bank': return '<path d="M3 21h18"/><path d="M5 21V10"/><path d="M9 21V10"/><path d="M13 21V10"/><path d="M17 21V10"/><polygon points="12 3 2 10 22 10"/>';
    case 'ewallet': return '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>';
    default: return '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>';
  }
}
