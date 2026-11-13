/**
 * Halaman Persuratan: arsip surat keluar PERBASI Tanah Laut.
 * - Generator nomor otomatis (preview besar + salin + langsung pakai)
 * - Arsip: tabel, filter, cetak (kop surat resmi), export CSV
 * - Form tambah/ubah dengan bidang, sifat, lampiran, isi (untuk dicetak)
 */
import { api } from '../api.js';
import { esc, fmtDate, todayISO, toast, openModal, closeModal, confirmDialog, debounce } from '../util.js';

const state = {
  page: 1,
  filters: { search: '', bidang_id: '', sifat: '', tahun: '' },
  bidang: [],
  nextNomor: null,
};

const SIFAT_BADGE = { BIASA: 'badge-nonaktif', PENTING: 'badge-admin', SEGERA: 'badge-bendahara', RAHASIA: 'badge-keluar' };

export async function renderPersuratan(view) {
  view.innerHTML = `
    <div class="card" style="background:var(--sidebar-grad);border:none;color:#e2e8f0">
      <div class="card-body" style="display:flex;align-items:center;gap:22px;flex-wrap:wrap">
        <div style="flex:1;min-width:260px">
          <div class="stat-label" style="color:#fdba74">GENERATOR NOMOR SURAT</div>
          <div id="next-nomor-display" style="font-size:clamp(1.2rem,2.2vw,1.7rem);font-weight:800;letter-spacing:0.01em;color:#fff;margin:8px 0 2px;font-variant-numeric:tabular-nums">—</div>
          <div style="font-size:0.78rem;color:#fdba74">Format: <code style="background:rgba(255,255,255,0.12);padding:1px 6px;border-radius:6px"><span id="next-kode">400.4.1</span>/001/<span id="next-org">PERBASASI-TALA</span>/<span id="next-year">2026</span></code> · urut per tahun, reset tiap tahun baru</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:stretch">
          <select id="next-year-select" class="input" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.25);color:#fff"></select>
          <button class="btn btn-outline btn-sm" id="btn-copy-nomor" style="color:#fff;border-color:rgba(255,255,255,0.3)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Salin Nomor</button>
          <button class="btn btn-primary btn-sm" id="btn-add-from-generator"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Buat Surat Nomor Ini</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Arsip Surat Keluar</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" id="surat-csv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>CSV</button>
          <button class="btn btn-primary" id="btn-add-surat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Buat Surat Baru</button>
        </div>
      </div>

      <div class="card-body">
        <div class="toolbar" style="margin-bottom:12px">
          <input type="text" id="sf-search" class="input search-input" placeholder="Cari nomor / perihal / tujuan…" value="${esc(state.filters.search)}" />
          <select id="sf-bidang" class="input"><option value="">Semua bidang</option></select>
          <select id="sf-sifat" class="input">
            <option value="">Semua sifat</option>
            <option value="BIASA">Biasa</option><option value="PENTING">Penting</option><option value="SEGERA">Segera</option><option value="RAHASIA">Rahasia</option>
          </select>
          <select id="sf-tahun" class="input"><option value="">Semua tahun</option></select>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nomor Surat</th><th>Tanggal</th><th>Perihal</th><th>Tujuan</th><th>Bidang</th><th>Sifat</th><th class="actions">Aksi</th></tr></thead>
            <tbody id="surat-tbody"><tr class="empty-row"><td colspan="7">Memuat…</td></tr></tbody>
          </table>
        </div>
        <div class="pagination">
          <span id="surat-pageinfo">—</span>
          <button id="surat-prev" aria-label="Halaman sebelumnya">‹</button>
          <button id="surat-next" aria-label="Halaman berikutnya">›</button>
        </div>
      </div>
    </div>`;

  // Tahun filter & generator
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);
  const sfTahun = document.getElementById('sf-tahun');
  sfTahun.innerHTML += yearOptions.map((y) => `<option value="${y}" ${String(state.filters.tahun) === String(y) ? 'selected' : ''}>${y}</option>`).join('');
  const nextYearSelect = document.getElementById('next-year-select');
  nextYearSelect.innerHTML = yearOptions.map((y) => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>Tahun ${y}</option>`).join('');

  state.bidang = (await api.get('/api/surat/bidang')).data;
  const bidangOptions = state.bidang.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  document.getElementById('sf-bidang').innerHTML += state.bidang.map((b) => `<option value="${b.id}" ${String(state.filters.bidang_id) === String(b.id) ? 'selected' : ''}>${esc(b.name)}</option>`).join('');

  const reloadNext = async () => {
    try {
      const year = document.getElementById('next-year-select').value;
      state.nextNomor = await api.get(`/api/surat/next?year=${year}`);
      document.getElementById('next-nomor-display').textContent = state.nextNomor.nomor;
      document.getElementById('next-kode').textContent = state.nextNomor.kode;
      document.getElementById('next-org').textContent = state.nextNomor.org;
      document.getElementById('next-year').textContent = state.nextNomor.year;
    } catch (err) { document.getElementById('next-nomor-display').textContent = 'Gagal memuat'; }
  };

  const reload = async () => {
    const params = new URLSearchParams({ page: String(state.page), limit: '10' });
    for (const [k, v] of Object.entries(state.filters)) if (v) params.set(k, v);
    try {
      const res = await api.get(`/api/surat?${params}`);
      const tbody = document.getElementById('surat-tbody');
      tbody.innerHTML = res.data.length === 0
        ? '<tr class="empty-row"><td colspan="7">Belum ada surat. Klik “Buat Surat Baru”.</td></tr>'
        : res.data.map((s) => `
          <tr>
            <td><strong style="font-variant-numeric:tabular-nums;font-size:0.8rem">${esc(s.nomor)}</strong></td>
            <td>${fmtDate(s.tanggal)}</td>
            <td style="max-width:220px">${esc(s.perihal)}${s.lampiran ? `<div style="font-size:0.68rem;color:var(--muted)">Lampiran: ${esc(s.lampiran)}</div>` : ''}</td>
            <td>${esc(s.tujuan)}</td>
            <td>${esc(s.bidang_name || '—')}</td>
            <td><span class="badge ${SIFAT_BADGE[s.sifat] || 'badge-nonaktif'}">${esc(s.sifat)}</span></td>
            <td class="actions">
              <button class="icon-btn" data-print="${s.id}" title="Cetak surat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg></button>
              <button class="icon-btn" data-edit="${s.id}" title="Ubah"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="icon-btn danger" data-del="${s.id}" data-nomor="${esc(s.nomor)}" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </td>
          </tr>`).join('');

      document.getElementById('surat-pageinfo').textContent = `Halaman ${res.page} dari ${res.pages} · ${res.total} surat`;
      document.getElementById('surat-prev').disabled = res.page <= 1;
      document.getElementById('surat-next').disabled = res.page >= res.pages;

      tbody.querySelectorAll('[data-print]').forEach((btn) => btn.addEventListener('click', () => cetakSurat(res.data.find((s) => s.id === Number(btn.dataset.print)), state.nextNomor?.ketua)));
      tbody.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openSuratModal(res.data.find((s) => s.id === Number(btn.dataset.edit)), bidangOptions, reload)));
      tbody.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Hapus Surat',
          message: `Hapus surat ${btn.dataset.nomor}? Tindakan tidak bisa dibatalkan.`,
          onConfirm: async () => {
            try { await api.del(`/api/surat/${btn.dataset.del}`); toast('Surat terhapus'); reload(); reloadNext(); }
            catch (err) { toast(err.message, 'error'); }
          },
        });
      }));
    } catch (err) { toast(err.message, 'error'); }
  };

  document.getElementById('next-year-select').addEventListener('change', reloadNext);
  document.getElementById('btn-copy-nomor').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.nextNomor?.nomor || ''); toast('Nomor tersalin ke clipboard'); }
    catch { toast('Gagal menyalin — salin manual dari tampilan', 'error'); }
  });
  document.getElementById('btn-add-from-generator').addEventListener('click', () => openSuratModal(null, bidangOptions, () => { reload(); reloadNext(); }));
  document.getElementById('btn-add-surat').addEventListener('click', () => openSuratModal(null, bidangOptions, () => { reload(); reloadNext(); }));
  document.getElementById('sf-search').addEventListener('input', debounce((e) => { state.filters.search = e.target.value; state.page = 1; reload(); }, 300));
  for (const [id, key] of [['sf-bidang', 'bidang_id'], ['sf-sifat', 'sifat'], ['sf-tahun', 'tahun']]) {
    document.getElementById(id).addEventListener('change', (e) => { state.filters[key] = e.target.value; state.page = 1; reload(); });
  }
  document.getElementById('surat-prev').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; reload(); } });
  document.getElementById('surat-next').addEventListener('click', () => { state.page += 1; reload(); });
  document.getElementById('surat-csv').addEventListener('click', () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state.filters)) if (v) params.set(k, v);
    api.download(`/api/surat/export.csv?${params}`, 'arsip-surat.csv').catch((err) => toast(err.message, 'error'));
  });

  await reloadNext();
  await reload();
}

/* ─────────── Modal tambah / ubah surat ─────────── */
function openSuratModal(surat, bidangOptions, onSaved) {
  const isEdit = Boolean(surat);
  const s = surat || { tanggal: todayISO(), sifat: 'BIASA', lampiran: '', keterangan: '', isi: '' };
  openModal({
    title: isEdit ? `Ubah Surat — ${surat.nomor}` : 'Buat Surat Baru',
    wide: true,
    bodyHTML: `
      <form id="surat-form" class="form-grid">
        ${isEdit ? `<div class="field full" style="background:var(--surface-2);border:1px dashed var(--border);border-radius:10px;padding:10px 14px"><span class="field-label">Nomor Surat</span><div style="font-weight:800;letter-spacing:0.02em;font-variant-numeric:tabular-nums">${esc(surat.nomor)}</div><label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.82rem;color:var(--muted)"><input type="checkbox" id="sf-regenerate" /> Buat ulang nomor (urut tercepat di tahun surat)</label></div>` : '<div class="field full" style="background:var(--surface-2);border:1px dashed var(--border);border-radius:10px;padding:10px 14px;font-size:0.8rem;color:var(--muted)">Nomor surat akan <strong>dibuat otomatis oleh server</strong> saat disimpan (format <code>400.4.1/XXX/PERBASASI-TALA/tahun</code>).</div>'}
        <label class="field"><span class="field-label">Tanggal Surat *</span><input type="date" id="sf-tanggal" class="input" value="${esc(s.tanggal)}" required /></label>
        <label class="field"><span class="field-label">Sifat</span>
          <select id="sf-sifat-input" class="input">
            ${['BIASA', 'PENTING', 'SEGERA', 'RAHASIA'].map((x) => `<option value="${x}" ${s.sifat === x ? 'selected' : ''}>${x.charAt(0) + x.slice(1).toLowerCase()}</option>`).join('')}
          </select>
        </label>
        <label class="field full"><span class="field-label">Perihal *</span><input id="sf-perihal" class="input" placeholder="cth: Undangan Latihan Bersama" value="${esc(s.perihal || '')}" required /></label>
        <label class="field full"><span class="field-label">Ditujukan Kepada (Yth.) *</span><input id="sf-tujuan" class="input" placeholder="cth: Segenap Pelatih &amp; Atlet PERBASI Tanah Laut" value="${esc(s.tujuan || '')}" required /></label>
        <label class="field"><span class="field-label">Bidang</span><select id="sf-bidang-input" class="input"><option value="">— Tanpa bidang —</option>${bidangOptions}</select></label>
        <label class="field"><span class="field-label">Lampiran</span><input id="sf-lampiran" class="input" placeholder="cth: 1 berkas" value="${esc(s.lampiran || '')}" /></label>
        <label class="field full"><span class="field-label">Keterangan / Catatan (untuk arsip internal)</span><input id="sf-keterangan" class="input" value="${esc(s.keterangan || '')}" placeholder="cth: distribusi lewat WhatsApp grup resmi" /></label>
        <label class="field full"><span class="field-label">Isi Surat (ditampilkan saat dicetak)</span><textarea id="sf-isi" class="input" style="min-height:120px" placeholder="Dengan hormat,&#10;Sehubungan dengan…">${esc(s.isi || '')}</textarea></label>
      </form>`,
    footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="surat-save">${isEdit ? 'Simpan Perubahan' : 'Simpan &amp; Terbitkan Nomor'}</button>`,
  });

  if (isEdit) {
    const bidangSel = document.getElementById('sf-bidang-input');
    if (surat.bidang_id) bidangSel.value = String(surat.bidang_id);
  }

  document.getElementById('surat-save').addEventListener('click', async () => {
    const payload = {
      tanggal: document.getElementById('sf-tanggal').value,
      sifat: document.getElementById('sf-sifat-input').value,
      perihal: document.getElementById('sf-perihal').value,
      tujuan: document.getElementById('sf-tujuan').value,
      bidang_id: document.getElementById('sf-bidang-input').value || null,
      lampiran: document.getElementById('sf-lampiran').value,
      keterangan: document.getElementById('sf-keterangan').value,
      isi: document.getElementById('sf-isi').value,
      regenerate_number: isEdit ? document.getElementById('sf-regenerate')?.checked : undefined,
    };
    try {
      if (isEdit) {
        const res = await api.put(`/api/surat/${surat.id}`, payload);
        closeModal(); toast(`Tersimpan — nomor: ${res.nomor}`);
      } else {
        const res = await api.post('/api/surat', payload);
        closeModal(); toast(`Surat terbit dengan nomor ${res.nomor}`);
      }
      await onSaved();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ─────────── Cetak surat (kop resmi) ke jendela baru ─────────── */
async function cetakSurat(s, ketuaFallback) {
  if (!s) return;
  let settings = { org_name: 'PERBASI TANAH LAUT', org_tagline: 'Perserikatan Baseball Softball Seluruh Indonesia — Pengurus Kabupaten Tanah Laut', org_address: '', org_phone: '', org_email: '', surat_ketua: ketuaFallback || 'Ketua Perbasasi Tanah Laut' };
  try {
    const { data } = await api.get('/api/settings');
    settings = { ...settings, ...data };
  } catch { /* pakai default */ }

  const tanggalPanjang = new Date(`${s.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const isiHTML = s.isi
    ? esc(s.isi).replace(/\n/g, '<br>')
    : 'Dengan hormat,<br><br>Sehubungan dengan perihal tersebut di atas, bersama ini disampaikan hal-hal sebagai berikut:<br><br>1. ....................................................................<br>2. ....................................................................<br>3. ....................................................................<br><br>Demikian surat ini disampaikan. Atas perhatian dan kerja samanya disampaikan terima kasih.';

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Surat ${esc(s.nomor)}</title>
<style>
  @page { size: A4; margin: 1.6cm 2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#111; font-size: 12pt; line-height: 1.5; }
  .kop { display: flex; align-items: center; gap: 16px; border-bottom: 3px double #111; padding-bottom: 10px; }
  .kop img { width: 88px; height: 88px; object-fit: contain; }
  .kop-text { text-align: center; flex: 1; }
  .kop-text h1 { font-size: 17pt; margin: 0; letter-spacing: 3px; }
  .kop-text .sub { font-size: 8.5pt; letter-spacing: 0.4px; text-transform: uppercase; }
  .kop-text .kontak { font-size: 7.5pt; color: #333; margin-top: 2px; }
  .meta { margin: 18px 0 0; display: grid; grid-template-columns: 110px 1fr; row-gap: 4px; font-size: 11.5pt; }
  .tanggal { text-align: right; margin: 14px 0 0; }
  .tujuan { margin-top: 14px; }
  .isi { margin-top: 12px; text-align: justify; }
  .ttd { margin-top: 34px; display: flex; justify-content: flex-end; }
  .ttd-inner { text-align: center; width: 280px; }
  .ttd-inner .nama { margin-top: 64px; font-weight: 700; text-decoration: underline; }
  .ttd-inner .jabatan { font-size: 10pt; }
  .foot { position: fixed; bottom: 0.4cm; left: 0; right: 0; text-align: center; font-size: 7pt; color: #666; border-top: 1px solid #ccc; padding-top: 4px; }
</style></head><body>
  <div class="kop">
    <img src="${window.location.origin}/icons/logo.png" alt="Logo PERBASI Tanah Laut">
    <div class="kop-text">
      <h1>PERBASI TANAH LAUT</h1>
      <div class="sub">${esc(settings.org_tagline)}</div>
      <div class="kontak">${esc(settings.org_address)}${settings.org_phone ? ' · ' + esc(settings.org_phone) : ''}${settings.org_email ? ' · ' + esc(settings.org_email) : ''}</div>
    </div>
  </div>

  <div class="meta">
    <div>Nomor</div><div>: ${esc(s.nomor)}</div>
    <div>Lampiran</div><div>: ${esc(s.lampiran || '—')}</div>
    <div>Perihal</div><div>: <strong>${esc(s.perihal)}</strong></div>
    ${s.sifat !== 'BIASA' ? `<div>Sifat</div><div>: <strong>${esc(s.sifat)}</strong></div>` : ''}
  </div>

  <p class="tanggal">Pelaihari, ${esc(tanggalPanjang)}</p>

  <p class="tujuan">Kepada Yth.<br><strong>${esc(s.tujuan)}</strong><br>di Tempat</p>

  <div class="isi">${isiHTML}</div>

  <div class="ttd">
    <div class="ttd-inner">
      <div>Hormat kami,</div>
      <div>${esc(settings.surat_ketua)}</div>
      <div class="nama">( ................................... )</div>
      <div class="jabatan">${esc(settings.surat_ketua)}</div>
    </div>
  </div>

  <div class="foot">${esc(s.nomor)} · Dicetak dari Aplikasi Bendahara PERBASI Tanah Laut · ${new Date().toLocaleString('id-ID')}</div>
  <script>window.onload = function () { window.print(); };<\/script>
</body></html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) { toast('Popup diblokir browser. Izinkan popup untuk mencetak.', 'error'); return; }
  printWindow.document.write(html);
  printWindow.document.close();
}
