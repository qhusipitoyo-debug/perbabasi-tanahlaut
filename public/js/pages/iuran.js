/**
 * Halaman Iuran: daftar status iuran anggota per periode bulan,
 * catat pembayaran, batalkan, export CSV.
 */
import { api } from '../api.js';
import { esc, fmtIDR, fmtDate, currentMonth, monthLabel, toast, openModal, closeModal, confirmDialog } from '../util.js';

export async function renderIuran(view) {
  const period = currentMonth();
  view.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/><path d="M12 7.5v9"/></svg>Iuran Anggota</div>
        <button class="btn btn-outline btn-sm" id="dues-csv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export CSV</button>
      </div>
      <div class="card-body">
        <div class="toolbar" style="margin-bottom:14px">
          <label class="field" style="gap:4px"><span class="field-label">Periode</span><input type="month" id="dues-period" class="input" value="${period}" /></label>
          <span class="spacer"></span>
          <span id="dues-period-label" style="font-weight:700;color:var(--muted)">${esc(monthLabel(period))}</span>
        </div>

        <div class="report-summary" id="dues-summary" style="grid-template-columns:repeat(4,1fr)"></div>
        <div class="progress" style="margin:14px 0 4px"><div id="dues-progress" style="width:0%"></div></div>
        <div id="dues-progress-label" style="font-size:0.78rem;color:var(--muted);margin-bottom:14px"></div>

        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>No.</th><th>Nama</th><th>Tim / Kelompok</th><th>Status</th><th>Tanggal Bayar</th><th class="num">Nominal</th><th class="actions">Aksi</th></tr></thead>
            <tbody id="dues-tbody"><tr class="empty-row"><td colspan="7">Memuat…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const state = { period };

  const reload = async () => {
    try {
      const res = await api.get(`/api/dues?period=${encodeURIComponent(state.period)}`);
      const s = res.summary;
      const pct = s.totalAnggota ? Math.round((s.lunas / s.totalAnggota) * 100) : 0;

      document.getElementById('dues-period-label').textContent = monthLabel(state.period);
      document.getElementById('dues-summary').innerHTML = `
        <div class="rs-item"><div class="rs-label">Total Anggota</div><div class="rs-value">${s.totalAnggota}</div></div>
        <div class="rs-item"><div class="rs-label">Lunas</div><div class="rs-value" style="color:var(--green)">${s.lunas}</div></div>
        <div class="rs-item"><div class="rs-label">Belum Bayar</div><div class="rs-value" style="color:var(--red)">${s.belum}</div></div>
        <div class="rs-item"><div class="rs-label">Terkumpul</div><div class="rs-value">${fmtIDR(s.terkumpul)}</div></div>`;
      document.getElementById('dues-progress').style.width = `${pct}%`;
      document.getElementById('dues-progress-label').textContent = `${pct}% anggota sudah lunas bulan ini`;

      const tbody = document.getElementById('dues-tbody');
      tbody.innerHTML = res.data.length === 0
        ? '<tr class="empty-row"><td colspan="7">Belum ada anggota aktif</td></tr>'
        : res.data.map((r) => `
          <tr>
            <td>${esc(r.member_no || '—')}</td>
            <td><strong>${esc(r.name)}</strong><div style="font-size:0.7rem;color:var(--muted)">${esc(r.position || '')}</div></td>
            <td>${esc(r.team || '—')}</td>
            <td><span class="badge ${r.due_id ? 'badge-lunas' : 'badge-belum'}">${r.due_id ? 'LUNAS' : 'BELUM'}</span></td>
            <td>${r.paid_date ? fmtDate(r.paid_date) : '—'}</td>
            <td class="num">${r.amount ? fmtIDR(r.amount) : '—'}</td>
            <td class="actions">
              ${r.due_id
                ? `<button class="btn btn-danger btn-sm" data-undo="${r.due_id}" data-name="${esc(r.name)}">Batalkan</button>`
                : `<button class="btn btn-primary btn-sm" data-pay="${r.member_id}" data-name="${esc(r.name)}">Catat Bayar</button>`}
            </td>
          </tr>`).join('');

      tbody.querySelectorAll('[data-pay]').forEach((btn) => btn.addEventListener('click', async () => {
        let defaultAmount = 50000;
        try { defaultAmount = Number((await api.get('/api/settings')).data.iuran_default) || 50000; } catch { /* pakai default */ }
        openModal({
          title: `Catat Iuran — ${btn.dataset.name}`,
          bodyHTML: `
            <form id="pay-form" style="display:flex;flex-direction:column;gap:13px">
              <label class="field"><span class="field-label">Periode</span><input id="pay-period" type="month" class="input" value="${esc(state.period)}" /></label>
              <label class="field"><span class="field-label">Nominal (Rp)</span><input id="pay-amount" type="number" min="1" class="input" value="${defaultAmount}" required /></label>
              <label class="field"><span class="field-label">Tanggal Bayar</span><input id="pay-date" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}" required /></label>
              <label class="field"><span class="field-label">Catatan</span><input id="pay-note" class="input" placeholder="cth: transfer BRI a.n. Bendahara" /></label>
            </form>`,
          footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="pay-save">Simpan Pembayaran</button>`,
        });
        document.getElementById('pay-save').addEventListener('click', async () => {
          try {
            await api.post('/api/dues', {
              member_id: Number(btn.dataset.pay),
              period: document.getElementById('pay-period').value,
              amount: document.getElementById('pay-amount').value,
              paid_date: document.getElementById('pay-date').value,
              note: document.getElementById('pay-note').value,
            });
            closeModal(); toast('Iuran tercatat lunas'); reload();
          } catch (err) { toast(err.message, 'error'); }
        });
      }));

      tbody.querySelectorAll('[data-undo]').forEach((btn) => btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Batalkan Iuran',
          message: `Batalkan catatan pembayaran iuran ${btn.dataset.name} periode ${monthLabel(state.period)}?`,
          confirmLabel: 'Batalkan',
          onConfirm: async () => {
            try { await api.del(`/api/dues/${btn.dataset.undo}`); toast('Catatan iuran dihapus'); reload(); }
            catch (err) { toast(err.message, 'error'); }
          },
        });
      }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  document.getElementById('dues-period').addEventListener('change', (e) => { state.period = e.target.value || currentMonth(); reload(); });
  document.getElementById('dues-csv').addEventListener('click', () => {
    api.download(`/api/reports/dues.csv?period=${encodeURIComponent(state.period)}`, `laporan-iuran_${state.period}.csv`).catch((err) => toast(err.message, 'error'));
  });

  await reload();
}
