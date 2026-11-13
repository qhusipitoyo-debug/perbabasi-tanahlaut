/**
 * Halaman Kas & Kategori: kelola akun kas (saldo terhitung) dan kategori transaksi.
 */
import { api } from '../api.js';
import { esc, fmtIDR, toast, openModal, closeModal, confirmDialog } from '../util.js';

export async function renderKas(view) {
  view.innerHTML = `
    <div class="grid-2-even">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/></svg>Kelola Kas</div>
          <button class="btn btn-primary btn-sm" id="btn-add-kas">+ Kas</button>
        </div>
        <div class="card-body kas-list" id="kas-list"><div style="color:var(--muted)">Memuat…</div></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41L11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="6.5" r="1"/></svg>Kelola Kategori &amp; Bidang</div>
        </div>
        <div class="card-body">
          <div class="grid-3">
            <div>
              <div class="col-head"><span class="stat-label" style="margin:0;color:var(--green)">PEMASUKAN</span><button class="btn btn-outline btn-sm" id="btn-add-cat-masuk">+</button></div>
              <div id="cat-masuk" style="display:flex;flex-direction:column;gap:6px"></div>
            </div>
            <div>
              <div class="col-head"><span class="stat-label" style="margin:0;color:var(--red)">PENGELUARAN</span><button class="btn btn-outline btn-sm" id="btn-add-cat-keluar">+</button></div>
              <div id="cat-keluar" style="display:flex;flex-direction:column;gap:6px"></div>
            </div>
            <div>
              <div class="col-head"><span class="stat-label" style="margin:0;color:var(--accent-strong)">BIDANG SURAT</span><button class="btn btn-outline btn-sm" id="btn-add-bidang">+</button></div>
              <div id="surat-bidang-list" style="display:flex;flex-direction:column;gap:6px"></div>
              <p style="font-size:0.72rem;color:var(--muted);margin:10px 4px 0;line-height:1.5">Bidang surat dipakai untuk mengklasifikasikan surat keluar di menu <strong>Persuratan</strong> (nomor surat tetap <code>400.4.1/001/PERBASASI-TALA/2026</code>).</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const loadKas = async () => {
    try {
      const res = await api.get('/api/kas');
      document.getElementById('kas-list').innerHTML = res.data.map((k) => `
        <div class="kas-item">
          <div class="kas-icon ${esc(k.type)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${kasIcon(k.type)}</svg></div>
          <div>
            <div class="kas-name">${esc(k.name)}</div>
            <div class="kas-type">${esc(k.type)} · saldo awal ${fmtIDR(k.opening_balance)}</div>
            <div style="font-size:0.7rem;color:var(--muted)">+${fmtIDR(k.total_masuk)} / −${fmtIDR(k.total_keluar)}</div>
          </div>
          <div class="kas-balance ${k.balance < 0 ? 'neg' : ''}">${fmtIDR(k.balance)}
            <div class="actions" style="margin-top:6px">
              <button class="icon-btn" data-edit-kas="${k.id}" title="Ubah"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="icon-btn danger" data-del-kas="${k.id}" data-name="${esc(k.name)}" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
          </div>
        </div>`).join('');

      document.querySelectorAll('[data-edit-kas]').forEach((btn) => btn.addEventListener('click', () => {
        const k = res.data.find((x) => x.id === Number(btn.dataset.editKas));
        openKasModal(k, loadKas);
      }));
      document.querySelectorAll('[data-del-kas]').forEach((btn) => btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Hapus Kas',
          message: `Hapus kas "${btn.dataset.name}"? Hanya bisa jika belum dipakai transaksi.`,
          onConfirm: async () => {
            try { await api.del(`/api/kas/${btn.dataset.delKas}`); toast('Kas terhapus'); loadKas(); }
            catch (err) { toast(err.message, 'error'); }
          },
        });
      }));
    } catch (err) {
      document.getElementById('kas-list').innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
    }
  };

  const loadKategori = async () => {
    try {
      const res = await api.get('/api/categories');
      const render = (type) => res.data.filter((c) => c.type === type).map((c) => `
        <div style="display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:6px 10px">
          <span style="font-size:0.83rem;font-weight:600;flex:1">${esc(c.name)}</span>
          <button class="icon-btn" data-edit-cat="${c.id}" title="Ubah" style="width:28px;height:28px"><svg viewBox="0 0 24 24" style="width:14px;height:14px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="icon-btn danger" data-del-cat="${c.id}" data-name="${esc(c.name)}" title="Hapus" style="width:28px;height:28px"><svg viewBox="0 0 24 24" style="width:14px;height:14px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>`).join('');
      document.getElementById('cat-masuk').innerHTML = render('masuk');
      document.getElementById('cat-keluar').innerHTML = render('keluar');

      document.querySelectorAll('[data-edit-cat]').forEach((btn) => btn.addEventListener('click', () => {
        const cat = res.data.find((c) => c.id === Number(btn.dataset.editCat));
        openKategoriModal(cat, loadKategori);
      }));
      document.querySelectorAll('[data-del-cat]').forEach((btn) => btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Hapus Kategori',
          message: `Hapus kategori "${btn.dataset.name}"?`,
          onConfirm: async () => {
            try { await api.del(`/api/categories/${btn.dataset.delCat}`); toast('Kategori terhapus'); loadKategori(); }
            catch (err) { toast(err.message, 'error'); }
          },
        });
      }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const loadKategoriFor = (type) => openKategoriModal(null, loadKategori, type);
  document.getElementById('btn-add-cat-masuk').addEventListener('click', () => loadKategoriFor('masuk'));
  document.getElementById('btn-add-cat-keluar').addEventListener('click', () => loadKategoriFor('keluar'));

  const loadBidang = async () => {
    try {
      const res = await api.get('/api/surat/bidang');
      const wrap = document.getElementById('surat-bidang-list');
      wrap.innerHTML = res.data.map((b) => `
        <div style="display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:6px 10px">
          ${b.code ? `<code style="font-size:0.7rem;background:var(--surface-3);padding:2px 8px;border-radius:6px;font-weight:700">${esc(b.code)}</code>` : ''}
          <span style="font-size:0.83rem;font-weight:600;flex:1">${esc(b.name)}</span>
          <button class="icon-btn" data-edit-bidang="${b.id}" title="Ubah" style="width:28px;height:28px"><svg viewBox="0 0 24 24" style="width:14px;height:14px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="icon-btn danger" data-del-bidang="${b.id}" data-name="${esc(b.name)}" title="Hapus" style="width:28px;height:28px"><svg viewBox="0 0 24 24" style="width:14px;height:14px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>`).join('');
      wrap.querySelectorAll('[data-edit-bidang]').forEach((btn) => btn.addEventListener('click', () => {
        const b = res.data.find((x) => x.id === Number(btn.dataset.editBidang));
        openBidangModal(b, loadBidang);
      }));
      wrap.querySelectorAll('[data-del-bidang]').forEach((btn) => btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Hapus Bidang Surat',
          message: `Hapus bidang "${btn.dataset.name}"?`,
          onConfirm: async () => {
            try { await api.del(`/api/surat/bidang/${btn.dataset.delBidang}`); toast('Bidang terhapus'); loadBidang(); }
            catch (err) { toast(err.message, 'error'); }
          },
        });
      }));
    } catch (err) { toast(err.message, 'error'); }
  };
  document.getElementById('btn-add-bidang').addEventListener('click', () => openBidangModal(null, loadBidang));

  document.getElementById('btn-add-kas').addEventListener('click', () => openKasModal(null, loadKas));

  await Promise.all([loadKas(), loadKategori(), loadBidang()]);
}

function openKasModal(k, onSaved) {
  const isEdit = Boolean(k);
  openModal({
    title: isEdit ? 'Ubah Kas' : 'Tambah Kas',
    bodyHTML: `
      <form id="kas-form" style="display:flex;flex-direction:column;gap:13px">
        <label class="field"><span class="field-label">Nama Kas</span><input id="kas-name" class="input" placeholder="cth: Bank Mandiri Perbasasi" value="${esc(k?.name || '')}" required /></label>
        <div class="form-grid">
          <label class="field"><span class="field-label">Tipe</span>
            <select id="kas-type" class="input">
              ${['tunai', 'bank', 'ewallet', 'lainnya'].map((t) => `<option value="${t}" ${k?.type === t ? 'selected' : ''}>${t === 'tunai' ? 'Kas Tunai' : t === 'bank' ? 'Rekening Bank' : t === 'ewallet' ? 'E-Wallet' : 'Lainnya'}</option>`).join('')}
            </select>
          </label>
          <label class="field"><span class="field-label">Saldo Awal (Rp)</span><input type="number" id="kas-opening" class="input" value="${esc(k?.opening_balance ?? 0)}" required /></label>
        </div>
        <label class="field"><span class="field-label">Catatan</span><input id="kas-note" class="input" value="${esc(k?.note || '')}" placeholder="cth: Rekening atas nama PERBASI Tanah Laut" /></label>
      </form>`,
    footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="kas-save">Simpan</button>`,
  });
  document.getElementById('kas-save').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('kas-name').value,
      type: document.getElementById('kas-type').value,
      opening_balance: document.getElementById('kas-opening').value,
      note: document.getElementById('kas-note').value,
    };
    try {
      if (isEdit) await api.put(`/api/kas/${k.id}`, payload); else await api.post('/api/kas', payload);
      closeModal(); toast(isEdit ? 'Kas diubah' : 'Kas ditambahkan'); onSaved();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function openKategoriModal(cat, onSaved, defaultType) {
  const isEdit = Boolean(cat);
  const presetType = cat?.type || defaultType || 'masuk';
  openModal({
    title: isEdit ? 'Ubah Kategori' : 'Tambah Kategori',
    bodyHTML: `
      <form id="cat-form" style="display:flex;flex-direction:column;gap:13px">
        <label class="field"><span class="field-label">Nama Kategori</span><input id="cat-name" class="input" placeholder="cth: Penjualan Kaos" value="${esc(cat?.name || '')}" required /></label>
        <label class="field"><span class="field-label">Tipe</span>
          <select id="cat-type" class="input">
            <option value="masuk" ${presetType === 'masuk' ? 'selected' : ''}>Pemasukan</option>
            <option value="keluar" ${presetType === 'keluar' ? 'selected' : ''}>Pengeluaran</option>
          </select>
        </label>
      </form>`,
    footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="cat-save">Simpan</button>`,
  });
  document.getElementById('cat-save').addEventListener('click', async () => {
    const payload = { name: document.getElementById('cat-name').value, type: document.getElementById('cat-type').value };
    try {
      if (isEdit) await api.put(`/api/categories/${cat.id}`, payload); else await api.post('/api/categories', payload);
      closeModal(); toast(isEdit ? 'Kategori diubah' : 'Kategori ditambahkan'); onSaved();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function openBidangModal(b, onSaved) {
  const isEdit = Boolean(b);
  openModal({
    title: isEdit ? 'Ubah Bidang Surat' : 'Tambah Bidang Surat',
    bodyHTML: `
      <form id="bidang-form" style="display:flex;flex-direction:column;gap:13px">
        <label class="field"><span class="field-label">Nama Bidang</span><input id="bidang-name" class="input" placeholder="cth: Bidang Pembinaan Usia Dini" value="${esc(b?.name || '')}" required /></label>
        <label class="field"><span class="field-label">Kode Singkat (opsional)</span><input id="bidang-code" class="input" placeholder="cth: PB" maxlength="10" value="${esc(b?.code || '')}" /></label>
      </form>`,
    footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="bidang-save">Simpan</button>`,
  });
  document.getElementById('bidang-save').addEventListener('click', async () => {
    const payload = { name: document.getElementById('bidang-name').value, code: document.getElementById('bidang-code').value };
    try {
      if (isEdit) await api.put(`/api/surat/bidang/${b.id}`, payload); else await api.post('/api/surat/bidang', payload);
      closeModal(); toast(isEdit ? 'Bidang diubah' : 'Bidang ditambahkan'); onSaved();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function kasIcon(type) {
  switch (type) {
    case 'bank': return '<path d="M3 21h18"/><path d="M5 21V10"/><path d="M9 21V10"/><path d="M13 21V10"/><path d="M17 21V10"/><polygon points="12 3 2 10 22 10"/>';
    case 'ewallet': return '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>';
    default: return '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>';
  }
}
