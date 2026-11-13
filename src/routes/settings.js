/**
 * Pengaturan organisasi: nama, tagline, alamat, kontak, nominal iuran default.
 * GET bersifat publik (dipakai layar login), PUT hanya untuk pengguna login.
 */
import { db } from '../db.js';
import { sendJson, sendError, audit, toIntAmount } from '../helpers.js';
import { authRequired } from '../middleware.js';

const PUBLIC_KEYS = ['org_name', 'org_tagline', 'org_address', 'org_phone', 'org_email', 'iuran_default', 'surat_kode', 'surat_org', 'surat_ketua'];

function getSettingsMap() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function registerSettingsRoutes(router) {
  router.get('/api/settings', (req, res) => {
    const all = getSettingsMap();
    const out = {};
    for (const key of PUBLIC_KEYS) out[key] = all[key] ?? '';
    sendJson(res, 200, { data: out });
  });

  router.put('/api/settings', authRequired(), (req, res, ctx) => {
    const body = ctx.body || {};
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const key of PUBLIC_KEYS) {
      if (body[key] === undefined) continue;
      let value = String(body[key]).slice(0, 300);
      if (key === 'iuran_default') {
        const n = toIntAmount(value);
        if (n === null || n < 0) return sendError(res, 400, 'Nominal iuran default harus berupa angka');
        value = String(n);
      }
      upsert.run(key, value);
    }
    audit(ctx.user.id, 'UPDATE_SETTINGS', 'Mengubah pengaturan organisasi');
    sendJson(res, 200, { ok: true, data: getSettingsMap() });
  });
}
