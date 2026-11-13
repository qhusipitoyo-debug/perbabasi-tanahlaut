/**
 * PERBASI Tanah Laut — Aplikasi Bendahara
 * Entry point frontend: tema, autentikasi, hash router, sidebar, logout.
 */
import { api, authStore } from './api.js';
import { initGlobalModalHandlers, toast, esc } from './util.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderTransaksi } from './pages/transaksi.js';
import { renderKas } from './pages/kas.js';
import { renderAnggota } from './pages/anggota.js';
import { renderIuran } from './pages/iuran.js';
import { renderPersuratan } from './pages/persuratan.js';
import { renderLaporan } from './pages/laporan.js';
import { renderPengaturan } from './pages/pengaturan.js';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  transaksi: 'Transaksi',
  kas: 'Kas & Kategori',
  anggota: 'Data Anggota',
  iuran: 'Iuran Anggota',
  persuratan: 'Persuratan',
  laporan: 'Laporan Arus Kas',
  pengaturan: 'Pengaturan',
};

const PAGE_RENDERERS = {
  dashboard: renderDashboard,
  transaksi: renderTransaksi,
  kas: renderKas,
  anggota: renderAnggota,
  iuran: renderIuran,
  persuratan: renderPersuratan,
  laporan: renderLaporan,
  pengaturan: renderPengaturan,
};

const loginScreen = document.getElementById('screen-login');
const appScreen = document.getElementById('screen-app');
const view = document.getElementById('view');

/* ─────────── Tema gelap/terang ─────────── */
const THEME_KEY = 'ptl_theme';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent('ptl:themechange', { detail: { theme } }));
}
applyTheme(localStorage.getItem(THEME_KEY) || 'light');

document.getElementById('btn-theme').addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

/* ─────────── Tampilkan layar ─────────── */
function showLogin() {
  loginScreen.classList.add('screen-visible');
  appScreen.classList.remove('screen-visible');
}
function showApp() {
  loginScreen.classList.remove('screen-visible');
  appScreen.classList.add('screen-visible');
}

function fillUserUI(user) {
  const initials = (user?.name || 'P').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Bendahara';
  for (const id of ['sidebar-user-name', 'topbar-user-name']) document.getElementById(id).textContent = user?.name || '—';
  for (const id of ['sidebar-user-role', 'topbar-user-role']) document.getElementById(id).textContent = roleLabel;
  for (const id of ['sidebar-avatar', 'topbar-avatar']) document.getElementById(id).textContent = initials || 'P';
}

/* ─────────── Login / Logout ─────────── */
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginSubmit = document.getElementById('login-submit');
const loginSpinner = loginSubmit.querySelector('.btn-spinner');
const loginLabel = loginSubmit.querySelector('.btn-label');

document.getElementById('toggle-password').addEventListener('click', () => {
  const input = document.getElementById('login-password');
  input.type = input.type === 'password' ? 'text' : 'password';
});
document.getElementById('login-year').textContent = new Date().getFullYear();

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.classList.add('hidden');
  loginSubmit.disabled = true;
  loginSpinner.classList.remove('hidden');
  loginLabel.textContent = 'Memproses…';

  try {
    const data = await api.post('/api/auth/login', {
      username: document.getElementById('login-username').value.trim(),
      password: document.getElementById('login-password').value,
    });
    authStore.setToken(data.token);
    authStore.setUser(data.user);
    fillUserUI(data.user);
    showApp();
    if (window.location.hash.length <= 2) window.location.hash = '#/dashboard';
    route();
    toast(`Selamat datang, ${data.user.name}!`);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  } finally {
    loginSubmit.disabled = false;
    loginSpinner.classList.add('hidden');
    loginLabel.textContent = 'Masuk';
  }
});

function logout() {
  authStore.clear();
  window.location.hash = '';
  showLogin();
  toast('Anda telah keluar');
}
document.getElementById('btn-logout-sidebar').addEventListener('click', logout);
window.addEventListener('ptl:unauthorized', () => {
  showLogin();
  loginError.textContent = 'Sesi berakhir. Silakan login kembali.';
  loginError.classList.remove('hidden');
});

/* ─────────── Sidebar mobile ─────────── */
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); };
document.getElementById('btn-burger').addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('visible'); });
document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

/* ─────────── Hash router ─────────── */
const topbarTitle = document.getElementById('topbar-title');
const topbarDate = document.getElementById('topbar-date');
topbarDate.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function currentPage() {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return PAGE_RENDERERS[hash] ? hash : 'dashboard';
}

async function route() {
  const page = currentPage();
  topbarTitle.textContent = PAGE_TITLES[page];
  document.querySelectorAll('.nav-item[data-page]').forEach((btn) => btn.classList.toggle('active', btn.dataset.page === page));
  closeSidebar();
  view.setAttribute('aria-busy', 'true');
  try {
    await PAGE_RENDERERS[page](view);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card card-pad"><p class="alert alert-error">${esc(err.message || 'Gagal memuat halaman')}</p></div>`;
  } finally {
    view.removeAttribute('aria-busy');
  }
}

document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => { window.location.hash = `#/${btn.dataset.page}`; });
});
window.addEventListener('hashchange', route);

/* ─────────── Service Worker (PWA) ─────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW gagal terdaftar:', err));
  });
}

/* ─────────── Bootstrap ─────────── */
initGlobalModalHandlers();

(async function init() {
  const token = authStore.getToken();
  if (!token) return showLogin();
  fillUserUI(authStore.getUser()); // optimistik
  try {
    const { user } = await api.get('/api/auth/me'); // token masih valid?
    authStore.setUser(user);
    fillUserUI(user);
    showApp();
    route();
  } catch {
    authStore.clear();
    showLogin();
  }
})();
