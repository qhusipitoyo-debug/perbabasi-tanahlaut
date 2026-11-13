/**
 * Halaman Anggota: daftar atlet/pelatih/pengurus dengan pencarian & CRUD.
 */
import { api } from '../api.js';
import { esc, fmtDate, toast, openModal, closeModal, confirmDialog, debounce } from '../util.js';

export async function renderAnggota(view) {
  view.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Data Anggota</div>
        <button class="btn btn-primary" id="btn-add-member"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Tambah Anggota</button>
      </div>
      <div class="card-body">
        <div class="toolbar" style="margin-bottom:12px">
          <input type="text" id="member-search" class="input search-input" placeholder="Cari nama / no anggota / tim…" />
          <select id="member-active" class="input">
            <option value="">Semua status</option>
            <option value="1">Aktif saja</option>
            <option value="0">Nonaktif saja</option>
          </select>
          <span class="spacer"></span>
          <span id="member-count" style="font-size:0.82rem;color:var(--muted)">—</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>No.</th><th>Nama</th><th>Posisi / Jabatan</th><th>Tim / Kelompok</th><th>Telepon</th><th>Status</th><th class="actions">Aksi</th></tr></thead>
            <tbody id="member-tbody"><tr class="empty-row"><td colspan="7">Memuat…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const state = { search: '', active: '' };

  const reload = async () => {
    const params = new URLSearchParams({ limit: '200' });
    if (state.search) params.set('search', state.search);
    if (state.active !== '') params.set('active', state.active);
    try {
      const res = await api.get(`/api/members?${params}`);
      document.getElementById('member-count').textContent = `${res.total} anggota`;
      const tbody = document.getElementById('member-tbody');
      tbody.innerHTML = res.data.length === 0
        ? '<tr class="empty-row"><td colspan="7">Belum ada anggota. Klik “Tambah Anggota”.</td></tr>'
        : res.data.map((m) => `
          <tr>
            <td>${esc(m.member_no || '—')}</td>
            <td><strong>${esc(m.name)}</strong><div style="font-size:0.7rem;color:var(--muted)">sejak ${fmtDate(m.joined_at)}</div></td>
            <td>${esc(m.position || '—')}</td>
            <td>${esc(m.team || '—')}</td>
            <td>${esc(m.phone || '—')}</td>
            <td><span class="badge ${m.active ? 'badge-aktif' : 'badge-nonaktif'}">${m.active ? 'AKTIF' : 'NONAKTIF'}</span></td>
            <td class="actions">
              <button class="icon-btn" data-edit="${m.id}" title="Ubah"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="icon-btn danger" data-del="${m.id}" data-name="${esc(m.name)}" title="Hapus (admin)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </td>
          </tr>`).join('');

      tbody.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
        openMemberModal(res.data.find((m) => m.id === Number(btn.dataset.edit)), reload);
      }));
      tbody.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Hapus Anggota',
          message: `Hapus anggota "${btn.dataset.name}"? Riwayat iuran ikut terhapus.`,
          onConfirm: async () => {
            try { await api.del(`/api/members/${btn.dataset.del}`); toast('Anggota terhapus'); reload(); }
            catch (err) { toast(err.message, 'error'); }
          },
        });
      }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  document.getElementById('btn-add-member').addEventListener('click', () => openMemberModal(null, reload));
  document.getElementById('member-search').addEventListener('input', debounce((e) => { state.search = e.target.value; reload(); }, 300));
  document.getElementById('member-active').addEventListener('change', (e) => { state.active = e.target.value; reload(); });

  await reload();
}

function openMemberModal(m, onSaved) {
  const isEdit = Boolean(m);
  openModal({
    title: isEdit ? 'Ubah Anggota' : 'Tambah Anggota',
    bodyHTML: `
      <form id="member-form" class="form-grid">
        <label class="field"><span class="field-label">No. Anggota</span><input id="m-no" class="input" placeholder="PB-007" value="${esc(m?.member_no || '')}" /></label>
        <label class="field"><span class="field-label">Tanggal Bergabung</span><input type="date" id="m-joined" class="input" value="${esc(m?.joined_at || new Date().toISOString().slice(0, 10))}" /></label>
        <label class="field full"><span class="field-label">Nama Lengkap *</span><input id="m-name" class="input" placeholder="Nama lengkap" value="${esc(m?.name || '')}" required /></label>
        <label class="field"><span class="field-label">Posisi / Jabatan</span><input id="m-position" class="input" placeholder="cth: Guard / Pelatih" value="${esc(m?.position || '')}" /></label>
        <label class="field"><span class="field-label">Tim / Kelompok</span><input id="m-team" class="input" placeholder="cth: Tim Putra Elite" value="${esc(m?.team || '')}" /></label>
        <label class="field"><span class="field-label">Telepon</span><input id="m-phone" class="input" placeholder="08xx-xxxx-xxxx" value="${esc(m?.phone || '')}" /></label>
        <label class="field"><span class="field-label">Status</span>
          <select id="m-active" class="input">
            <option value="1" ${m?.active !== 0 ? 'selected' : ''}>Aktif</option>
            <option value="0" ${m?.active === 0 ? 'selected' : ''}>Nonaktif</option>
          </select>
        </label>
      </form>`,
    footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="member-save">Simpan</button>`,
  });
  document.getElementById('member-save').addEventListener('click', async () => {
    const payload = {
      member_no: document.getElementById('m-no').value,
      name: document.getElementById('m-name').value,
      position: document.getElementById('m-position').value,
      team: document.getElementById('m-team').value,
      phone: document.getElementById('m-phone').value,
      joined_at: document.getElementById('m-joined').value,
      active: document.getElementById('m-active').value === '1',
    };
    try {
      if (isEdit) await api.put(`/api/members/${m.id}`, payload); else await api.post('/api/members', payload);
      closeModal(); toast(isEdit ? 'Data anggota diubah' : 'Anggota ditambahkan'); onSaved();
    } catch (err) { toast(err.message, 'error'); }
  });
}
