/**
 * Halaman Pengaturan — tab: Organisasi · Keamanan · Pengguna (admin) · Audit Log (admin) · Backup (admin)
 */
import { api, authStore } from '../api.js';
import { esc, fmtIDR, toast, openModal, closeModal, confirmDialog } from '../util.js';

export async function renderPengaturan(view) {
  const user = authStore.getUser();
  const isAdmin = user?.role === 'admin';

  view.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>Pengaturan</div>
      </div>
      <div class="card-body">
        <div class="tabs" id="settings-tabs">
          <button class="tab-btn active" data-tab="tab-org">Organisasi</button>
          <button class="tab-btn" data-tab="tab-security">Keamanan</button>
          ${isAdmin ? '<button class="tab-btn" data-tab="tab-users">Pengguna</button><button class="tab-btn" data-tab="tab-audit">Audit Log</button><button class="tab-btn" data-tab="tab-backup">Backup</button>' : ''}
        </div>
        <div id="settings-panels" style="padding-top:16px"></div>
      </div>
    </div>`;

  const panels = document.getElementById('settings-panels');
  const tabs = document.querySelectorAll('#settings-tabs .tab-btn');

  const showTab = (name) => {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    if (name === 'tab-org') renderOrgTab(panels);
    else if (name === 'tab-security') renderSecurityTab(panels);
    else if (name === 'tab-users') renderUsersTab(panels);
    else if (name === 'tab-audit') renderAuditTab(panels);
    else if (name === 'tab-backup') renderBackupTab(panels);
  };
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  showTab('tab-org');
}

/* ───── TAB: Organisasi ───── */
async function renderOrgTab(panels) {
  panels.innerHTML = '<div style="color:var(--muted)">Memuat…</div>';
  let data = {};
  try { ({ data } = await api.get('/api/settings')); } catch (err) { panels.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`; return; }

  panels.innerHTML = `
    <form id="org-form" style="display:flex;flex-direction:column;gap:13px;max-width:640px">
      <label class="field"><span class="field-label">Nama Organisasi</span><input id="set-org_name" class="input" value="${esc(data.org_name)}" /></label>
      <label class="field"><span class="field-label">Tagline</span><input id="set-org_tagline" class="input" value="${esc(data.org_tagline)}" /></label>
      <label class="field"><span class="field-label">Alamat</span><textarea id="set-org_address" class="input">${esc(data.org_address)}</textarea></label>
      <div class="form-grid">
        <label class="field"><span class="field-label">Telepon</span><input id="set-org_phone" class="input" value="${esc(data.org_phone)}" /></label>
        <label class="field"><span class="field-label">Email</span><input id="set-org_email" type="email" class="input" value="${esc(data.org_email)}" /></label>
      </div>
      <label class="field"><span class="field-label">Nominal Iuran Default (Rp / bulan)</span><input id="set-iuran_default" type="number" min="0" class="input" value="${esc(data.iuran_default || '50000')}" /></label>
      <div class="form-grid">
        <label class="field"><span class="field-label">Kode Klasifikasi Surat</span><input id="set-surat_kode" class="input" value="${esc(data.surat_kode || '400.4.1')}" /></label>
        <label class="field"><span class="field-label">Kode Organisasi di Nomor Surat</span><input id="set-surat_org" class="input" value="${esc(data.surat_org || 'PERBASASI-TALA')}" /></label>
      </div>
      <label class="field"><span class="field-label">Pejabat Penandatangan (Tampil di Kop Surat)</span><input id="set-surat_ketua" class="input" value="${esc(data.surat_ketua || 'Ketua Perbasasi Tanah Laut')}" /></label>
      <div class="alert" style="background:var(--blue-soft);color:var(--blue);border:1px solid rgba(37,99,235,0.3)">Format nomor: <strong>${esc(data.surat_kode || '400.4.1')}/001/${esc(data.surat_org || 'PERBASASI-TALA')}/tahun</strong> — urut 3 digit, reset tiap tahun.</div>
      <div><button type="button" class="btn btn-primary" id="org-save">Simpan Pengaturan</button></div>
    </form>`;

  document.getElementById('org-save').addEventListener('click', async () => {
    const payload = {};
    for (const key of ['org_name', 'org_tagline', 'org_address', 'org_phone', 'org_email', 'iuran_default', 'surat_kode', 'surat_org', 'surat_ketua']) {
      payload[key] = document.getElementById(`set-${key}`).value;
    }
    try {
      await api.put('/api/settings', payload);
      toast('Pengaturan organisasi tersimpan');
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ───── TAB: Keamanan ───── */
function renderSecurityTab(panels) {
  const user = authStore.getUser();
  panels.innerHTML = `
    <div style="max-width:480px;display:flex;flex-direction:column;gap:13px">
      <div class="card card-pad" style="background:var(--surface-2)">
        <strong>${esc(user?.name || '—')}</strong><br />
        <span style="font-size:0.8rem;color:var(--muted)">@${esc(user?.username || '—')} · role <strong>${esc(user?.role || '—')}</strong></span>
      </div>
      <form id="pw-form" style="display:flex;flex-direction:column;gap:13px">
        <h4 style="margin:0">Ganti Password</h4>
        <label class="field"><span class="field-label">Password Lama</span><input id="pw-old" type="password" class="input" autocomplete="current-password" required /></label>
        <label class="field"><span class="field-label">Password Baru</span><input id="pw-new" type="password" class="input" autocomplete="new-password" placeholder="Minimal 6 karakter" required /></label>
        <label class="field"><span class="field-label">Ulangi Password Baru</span><input id="pw-confirm" type="password" class="input" autocomplete="new-password" required /></label>
        <div><button type="button" class="btn btn-primary" id="pw-save">Ubah Password</button></div>
      </form>
    </div>`;

  document.getElementById('pw-save').addEventListener('click', async () => {
    const oldPassword = document.getElementById('pw-old').value;
    const newPassword = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    if (newPassword !== confirm) return toast('Konfirmasi password tidak cocok', 'error');
    try {
      await api.post('/api/auth/change-password', { oldPassword, newPassword });
      document.getElementById('pw-old').value = document.getElementById('pw-new').value = document.getElementById('pw-confirm').value = '';
      toast('Password berhasil diubah');
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ───── TAB: Pengguna (admin) ───── */
async function renderUsersTab(panels) {
  panels.innerHTML = '<div style="color:var(--muted)">Memuat…</div>';
  let res;
  try { res = await api.get('/api/users'); } catch (err) { panels.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`; return; }
  const current = authStore.getUser();

  panels.innerHTML = `
    <div style="margin-bottom:12px;display:flex;justify-content:flex-end"><button class="btn btn-primary" id="user-add">+ Pengguna Baru</button></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Pengguna</th><th>Role</th><th>Status</th><th>Dibuat</th><th class="actions">Aksi</th></tr></thead>
        <tbody>
          ${res.data.map((u) => `
            <tr>
              <td><strong>${esc(u.full_name)}</strong><div style="font-size:0.72rem;color:var(--muted)">@${esc(u.username)}</div></td>
              <td><span class="badge badge-${esc(u.role)}">${esc(u.role.toUpperCase())}</span></td>
              <td><span class="badge ${u.active ? 'badge-aktif' : 'badge-nonaktif'}">${u.active ? 'AKTIF' : 'NONAKTIF'}</span></td>
              <td>${esc((u.created_at || '').slice(0, 10))}</td>
              <td class="actions">
                <button class="icon-btn" data-reset="${u.id}" data-name="${esc(u.username)}" title="Reset password"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
                <button class="icon-btn" data-edit-user="${u.id}" title="Ubah"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.getElementById('user-add').addEventListener('click', () => openUserModal(null, () => renderUsersTab(panels)));
  panels.querySelectorAll('[data-reset]').forEach((btn) => btn.addEventListener('click', () => {
    openModal({
      title: `Reset Password — ${btn.dataset.name}`,
      bodyHTML: `<label class="field"><span class="field-label">Password Baru</span><input id="reset-pw" type="password" class="input" placeholder="Minimal 6 karakter" /></label>`,
      footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="reset-save">Reset</button>`,
    });
    document.getElementById('reset-save').addEventListener('click', async () => {
      try {
        await api.post(`/api/users/${btn.dataset.reset}/reset-password`, { newPassword: document.getElementById('reset-pw').value });
        closeModal(); toast('Password direset');
      } catch (err) { toast(err.message, 'error'); }
    });
  }));
  panels.querySelectorAll('[data-edit-user]').forEach((btn) => btn.addEventListener('click', () => {
    openUserModal(res.data.find((u) => u.id === Number(btn.dataset.editUser)), () => renderUsersTab(panels));
  }));
}

function openUserModal(u, onSaved) {
  const isEdit = Boolean(u);
  openModal({
    title: isEdit ? 'Ubah Pengguna' : 'Pengguna Baru',
    bodyHTML: `
      <form id="user-form" style="display:flex;flex-direction:column;gap:13px">
        ${isEdit ? '' : '<label class="field"><span class="field-label">Username</span><input id="u-username" class="input" placeholder="cth: bendahara2" required /></label>'}
        ${isEdit ? '' : '<label class="field"><span class="field-label">Password Awal</span><input id="u-password" type="password" class="input" placeholder="Minimal 6 karakter" required /></label>'}
        <label class="field"><span class="field-label">Nama Lengkap</span><input id="u-fullname" class="input" value="${esc(u?.full_name || '')}" required /></label>
        <div class="form-grid">
          <label class="field"><span class="field-label">Role</span>
            <select id="u-role" class="input">
              <option value="bendahara" ${u?.role !== 'admin' ? 'selected' : ''}>Bendahara</option>
              <option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </label>
          <label class="field"><span class="field-label">Status</span>
            <select id="u-active" class="input">
              <option value="1" ${u?.active !== 0 ? 'selected' : ''}>Aktif</option>
              <option value="0" ${u?.active === 0 ? 'selected' : ''}>Nonaktif</option>
            </select>
          </label>
        </div>
      </form>`,
    footerHTML: `<button class="btn btn-outline" data-modal-close>Batal</button><button class="btn btn-primary" id="user-save">Simpan</button>`,
  });
  document.getElementById('user-save').addEventListener('click', async () => {
    try {
      if (isEdit) {
        await api.put(`/api/users/${u.id}`, {
          full_name: document.getElementById('u-fullname').value,
          role: document.getElementById('u-role').value,
          active: document.getElementById('u-active').value === '1',
        });
      } else {
        await api.post('/api/users', {
          username: document.getElementById('u-username').value,
          password: document.getElementById('u-password').value,
          full_name: document.getElementById('u-fullname').value,
          role: document.getElementById('u-role').value,
        });
      }
      closeModal(); toast(isEdit ? 'Pengguna diubah' : 'Pengguna ditambahkan'); onSaved();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ───── TAB: Audit Log (admin) ───── */
async function renderAuditTab(panels) {
  panels.innerHTML = '<div style="color:var(--muted)">Memuat…</div>';
  try {
    const res = await api.get('/api/audit?limit=100');
    panels.innerHTML = `
      <p style="margin-top:0;font-size:0.82rem;color:var(--muted)">100 aktivitas terakhir — login, perubahan data, backup.</p>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody>
            ${res.data.length === 0 ? '<tr class="empty-row"><td colspan="4">Belum ada aktivitas</td></tr>' : res.data.map((a) => `
              <tr>
                <td style="white-space:nowrap;font-variant-numeric:tabular-nums">${esc(a.created_at)}</td>
                <td>${esc(a.username || 'sistem')}</td>
                <td><code style="font-size:0.72rem;background:var(--surface-3);padding:2px 6px;border-radius:6px">${esc(a.action)}</code></td>
                <td>${esc(a.detail)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { panels.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`; }
}

/* ───── TAB: Backup (admin) ───── */
function renderBackupTab(panels) {
  panels.innerHTML = `
    <div style="max-width:560px;display:flex;flex-direction:column;gap:14px">
      <div class="card card-pad" style="background:var(--surface-2)">
        <h4 style="margin:0 0 6px">Unduh Backup Database</h4>
        <p style="margin:0;font-size:0.85rem;color:var(--muted);line-height:1.6">Mengunduh salinan penuh database SQLite (<code>.db</code>) berisi seluruh data: transaksi, iuran, anggota, pengguna &amp; pengaturan. Simpan file ini di tempat aman (Google Drive / flashdisk) secara rutin.</p>
      </div>
      <div><button class="btn btn-dark" id="backup-download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Unduh Backup Sekarang</button></div>
    </div>`;
  document.getElementById('backup-download').addEventListener('click', async () => {
    try { await api.download('/api/backup', 'backup-perbasasi.db'); toast('Backup terunduh'); }
    catch (err) { toast(err.message, 'error'); }
  });
}
