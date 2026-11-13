/**
 * Halaman Transaksi: filter, tabel berpaginasi, CRUD lewat modal,
 * ringkasan total sesuai filter, ekspor CSV.
 */
import { api } from '../api.js';
import { esc, fmtIDR, fmtDate, todayISO, toast, openModal, closeModal, confirmDialog, debounce } from '../util.js';

const state = {
  page: 1,
  filters: { search: '', type: '', kas_id: '', category_id: '', from: '', to: '' },
};

export async function renderTransaksi(view) {
  view.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>Manajemen Transaksi</div>
        <button class="btn btn-primary" id="btn-add-trx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Tambah Transaksi</button>
      </div>

      <div class="card-body">
        <div class="toolbar" style="margin-bottom:12px">
          <input type="text" id="f-search" class="input search-input" placeholder="Cari keterangan / no bukti / kategori…" value="${esc(state.filters.search)}" />
          <select id="f-type" class="input">
            <option value="">Semua tipe</option>
            <option value="masuk" ${state.filters.type === 'masuk' ? 'selected' : ''}>Pemasukan</option>
            <option value="keluar" ${state.filters.type === 'keluar' ? 'selected' : ''}>Pengeluaran</option>
          </select>
          <select id="f-kas" class="input"><option value="">Semua kas</option></select>
          <select id="f-kategori" class="input"><option value="">Semua kategori</option></select>
          <input type="date" id="f-from" class="input" value="${esc(state.filters.from)}" title="Dari tanggal" />
          <input type="date" id="f-to" class="input" value="${esc(state.filters.to)}" title="Sampai tanggal" />
          <button class="btn btn-outline btn-sm" id="btn-export-csv" title="Unduh CSV sesuai periode filter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>CSV</button>
        </div>

        <div class="report-summary" id="trx-summary"></div>

        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Keterangan</th><th>Kas</th><th class="num">Nominal</th><th class="actions">Aksi</th></tr></thead>
            <tbody id="trx-tbody"><tr class="empty-row"><td colspan="7">Memuat…</td></tr></tbody>
          </table>
        </div>
        <div class="pagination">
          <span id="trx-pageinfo">—</span>
          <button id="trx-prev" aria-label="Halaman sebelumnya">‹</button>
          <button id="trx-next" aria-label="Halaman berikutnya">›</button>
        </div>
      </div>
    </div>`;

  const [kasList, catList] = await Promise.all([api.get('/api/kas'), api.get('/api/categories')]);
  const kasSelect = document.getElementById('f-kas');
  kasSelect.innerHTML += kasList.data.map((k) => `<option value="${k.id}" ${String(state.filters.kas_id) === String(k.id) ? 'selected' : ''}>${esc(k.name)}</option>`).join('');
  const catSelect = document.getElementById('f-kategori');
  catSelect.innerHTML += catList.data.map((c) => `<option value="${c.id}" ${String(state.filters.category_id) === String(c.id) ? 'selected' : ''}>${esc(c.name)} (${c.type === 'masuk' ? 'masuk' : 'keluar'})</option>`).join('');

  const reload = async () => {
    const params = new URLSearchParams({ page: String(state.page), limit: '10' });
    for (const [k, v] of Object.entries(state.filters)) if (v) params.set(k, v);
    try {
      const res = await api.get(`/api/transactions?${params}`);
      renderTable(res);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const renderTable = (res) => {
    const tbody = document.getElementById('trx-tbody');
    tbody.innerHTML = res.data.length === 0
      ? '<tr class="empty-row"><td colspan="7">Tidak ada transaksi sesuai filter</td></tr>'
      : res.data.map((t) => `
        <tr>
          <td>${fmtDate(t.date)}<div style="font-size:0.68rem;color:var(--muted)">${esc(t.ref_no || '')}</div></td>
          <td><span class="badge badge-${t.type}">${t.type === 'masuk' ? 'MASUK' : 'KELUAR'}</span></td>
          <td>${esc(t.category_name || '—')}</td>
          <td style="max-width:260px">${esc(t.note || '—')}</td>
          <td>${esc(t.kas_name)}</td>
          <td class="num ${t.type === 'masuk' ? 'pos' : 'neg'}" style="font-weight:700">${t.type === 'masuk' ? '+' : '−'} ${fmtIDR(t.amount)}</td>
          <td class="actions">
            <button class="icon-btn" data-edit="${t.id}" title="Ubah"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="icon-btn danger" data-del="${t.id}" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </td>
        </tr>`).join('');

    document.getElementById('trx-summary').innerHTML = `
      <div class="rs-item"><div class="rs-label">Total Pemasukan</div><div class="rs-value" style="color:var(--green)">${fmtIDR(res.totals.total_masuk)}</div></div>
      <div class="rs-item"><div class="rs-label">Total Pengeluaran</div><div class="rs-value" style="color:var(--red)">${fmtIDR(res.totals.total_keluar)}</div></div>
      <div class="rs-item"><div class="rs-label">Selisih (sesuai filter)</div><div class="rs-value">${fmtIDR(res.totals.total_masuk - res.totals.total_keluar)}</div></div>`;

    document.getElementById('trx-pageinfo').textContent = `Halaman ${res.page} dari ${res.pages} · ${res.total} transaksi`;
    document.getElementById('trx-prev').disabled = res.page <= 1;
    document.getElementById('trx-next').disabled = res.page >= res.pages;

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openTrxModal(Number(btn.dataset.edit), res.data.find((t) => t.id === Number(btn.dataset.edit)), kasList.data, catList.data, reload));
    });
    tbody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const trx = res.data.find((t) => t.id === Number(btn.dataset.del));
        confirmDialog({
          title: 'Hapus Transaksi',
          message: `Hapus transaksi ${trx?.type === 'masuk' ? 'pemasukan' : 'pengeluaran'} ${fmtIDR(trx?.amount)} (${trx?.date})? Tindakan ini tidak bisa dibatalkan.`,
          confirmLabel: 'Hapus',
          onConfirm: async () => {
            try {
              await api.del(`/api/transactions/${btn.dataset.del}`);
              toast('Transaksi terhapus');
              await reload();
            } catch (err) { toast(err.message, 'error'); }
          },
        });
      });
    });
  };

  document.getElementById('btn-add-trx').addEventListener('click', () => openTrxModal(null, null, kasList.data, catList.data, reload));
  document.getElementById('f-search').addEventListener('input', debounce((e) => { state.filters.search = e.target.value; state.page = 1; reload(); }, 350));
  for (const [id, key] of [['f-type', 'type'], ['f-kas', 'kas_id'], ['f-kategori', 'category_id'], ['f-from', 'from'], ['f-to', 'to']]) {
    document.getElementById(id).addEventListener('change', (e) => { state.filters[key] = e.target.value; state.page = 1; reload(); });
  }
  document.getElementById('trx-prev').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; reload(); } });
  document.getElementById('trx-next').addEventListener('click', () => { state.page += 1; reload(); });
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const { from, to } = state.filters;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.download(`/api/reports/cashflow.csv?${params}`, 'laporan-arus-kas.csv').catch((err) => toast(err.message, 'error'));
  });

  await reload();
}

async function openTrxModal(id, existing, kasList, catList, onSaved) {
  const isEdit = Boolean(id);
  const trx = existing || { type: 'keluar', kas_id: kasList[0]?.id || '', category_id: '', amount: '', date: todayISO(), ref_no: '', note: '' };

  const categoryOptions = (type) => catList.filter((c) => c.type === type).map((c) => `<option value="${c.id}" ${String(trx.category_id) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  openModal({
    title: isEdit ? 'Ubah Transaksi' : 'Tambah Transaksi',
    bodyHTML: `
      <form id="trx-form" class="form-grid">
        <label class="field full"><span class="field-label">Tipe</span>
          <div class="pill-toggle" id="trx-type-toggle">
            <button type="button" data-type="masuk" class="${trx.type === 'masuk' ? 'active' : ''}">Pemasukan</button>
            <button type="button" data-type="keluar" class="${trx.type === 'keluar' ? 'active' : ''}">Pengeluaran</button>
          </div>
        </label>
        <label class="field"><span class="field-label">Nominal (Rp)</span><input type="number" min="1" step="1" id="trx-amount" class="input" placeholder="150000" value="${esc(trx.amount)}" required /></label>
        <label class="field"><span class="field-label">Tanggal</span><input type="date" id="trx-date" class="input" value="${esc(trx.date)}" required /></label>
        <label class="field"><span class="field-label">Kas</span>
          <select id="trx-kas" class="input" required>${kasList.map((k) => `<option value="${k.id}" ${String(trx.kas_id) === String(k.id) ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
        </label>
        <label class="field"><span class="field-label">Kategori</span><select id="trx-kategori" class="input">${categoryOptions(trx.type)}</select></label>
        <label class="field"><span class="field-label">No. Bukti (opsional)</span><input type="text" id="trx-ref" class="input" placeholder="cth: IU-2026-011" value="${esc(trx.ref_no || '')}" /></label>
        <label class="field full"><span class="field-label">Keterangan</span><textarea id="trx-note" class="input" placeholder="Uraian transaksi…">${esc(trx.note || '')}</textarea></label>
      </form>`,
    footerHTML: `
      <button class="btn btn-outline" data-modal-close>Batal</button>
      <button class="btn btn-primary" id="trx-save">${isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>`,
  });

  let currentType = trx.type;
  const toggleWrap = document.getElementById('trx-type-toggle');
  const kategoriSelect = document.getElementById('trx-kategori');
  toggleWrap.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      toggleWrap.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      kategoriSelect.innerHTML = categoryOptions(currentType);
    });
  });

  document.getElementById('trx-save').addEventListener('click', async () => {
    const payload = {
      type: currentType,
      kas_id: Number(document.getElementById('trx-kas').value),
      category_id: document.getElementById('trx-kategori').value || null,
      amount: document.getElementById('trx-amount').value,
      date: document.getElementById('trx-date').value,
      ref_no: document.getElementById('trx-ref').value,
      note: document.getElementById('trx-note').value,
    };
    try {
      if (isEdit) await api.put(`/api/transactions/${id}`, payload);
      else await api.post('/api/transactions', payload);
      closeModal();
      toast(isEdit ? 'Transaksi berhasil diubah' : 'Transaksi tersimpan');
      await onSaved();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
