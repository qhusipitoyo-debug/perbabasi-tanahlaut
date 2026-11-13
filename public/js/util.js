/**
 * Utilitas UI: escaping, format Rupiah & tanggal Indonesia, toast, modal, confirm.
 */

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const fmtIDR = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const fmtNumber = (n) => new Intl.NumberFormat('id-ID').format(Number(n) || 0);

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const todayISO = () => {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const currentMonth = () => todayISO().slice(0, 7);

export const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return String(ym);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

export const debounce = (fn, ms = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

/* ─────────── Toast ─────────── */
export function toast(message, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(24px)';
    setTimeout(() => el.remove(), 250);
  }, 4200);
}

/* ─────────── Modal ─────────── */
const modalEl = () => document.getElementById('modal');
const modalTitle = () => document.getElementById('modal-title');
const modalBody = () => document.getElementById('modal-body');
const modalFooter = () => document.getElementById('modal-footer');
const modalDialog = () => document.querySelector('.modal-dialog');

export function openModal({ title, bodyHTML, footerHTML = '', wide = false }) {
  modalTitle().textContent = title;
  modalBody().innerHTML = bodyHTML;
  modalFooter().innerHTML = footerHTML;
  modalDialog().classList.toggle('wide', Boolean(wide));
  modalEl().classList.add('open');
  modalEl().setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  modalEl().classList.remove('open');
  modalEl().setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function confirmDialog({ title = 'Konfirmasi', message, confirmLabel = 'Hapus', danger = true, onConfirm }) {
  openModal({
    title,
    bodyHTML: `<p style="margin:0;line-height:1.6">${esc(message)}</p>`,
    footerHTML: `
      <button class="btn btn-outline" data-modal-close>Batal</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-yes">${esc(confirmLabel)}</button>`,
  });
  document.getElementById('confirm-yes').addEventListener('click', async () => {
    closeModal();
    await onConfirm();
  });
}

/** Bind close handlers sekali saja (backdrop & tombol [data-modal-close]) */
export function initGlobalModalHandlers() {
  document.getElementById('modal').addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

/** Angka count-up untuk stat cards */
export function animateCount(el, target, format = (v) => Math.round(v).toLocaleString('id-ID'), duration = 700) {
  const start = 0;
  const startTime = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(2, -8 * progress);
    el.textContent = format(start + (target - start) * (progress === 1 ? 1 : eased));
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
