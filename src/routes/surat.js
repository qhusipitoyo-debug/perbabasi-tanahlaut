/**
 * Persuratan: arsip surat keluar PERBASI Tanah Laut dengan penomoran otomatis.
 * Format nomor: {kode}/{urut-3-digit}/{org}/{tahun} — contoh: 400.4.1/001/PERBASASI-TALA/2026
 * Urut berjalan per tahun, reset tiap tahun baru. Kode & org code bisa diubah di Pengaturan.
 */
import { db } from '../db.js';
import { sendJson, sendError, audit, toCsv, sendCsv, isValidDateString } from '../helpers.js';
import { authRequired } from '../middleware.js';

const VALID_SIFAT = ['BIASA', 'PENTING', 'SEGERA', 'RAHASIA'];

function suratSettings() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('surat_kode','surat_org','surat_ketua')").all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    kode: (map.surat_kode || '400.4.1').trim() || '400.4.1',
    org: (map.surat_org || 'PERBASASI-TALA').trim() || 'PERBASASI-TALA',
    ketua: map.surat_ketua || 'Ketua Perbasasi Tanah Laut',
  };
}

export function buildNomor(kode, org, seq, year) {
  return `${kode}/${String(seq).padStart(3, '0')}/${org}/${year}`;
}

function nextSeq(year) {
  const row = db.prepare('SELECT COALESCE(MAX(number_seq), 0) AS max_seq FROM surat WHERE number_year = ?').get(year);
  return row.max_seq + 1;
}

function validatePayload(body, res) {
  const { tanggal, perihal, tujuan, bidang_id, lampiran = '', sifat = 'BIASA', keterangan = '', isi = '' } = body || {};
  if (!isValidDateString(tanggal)) {
    sendError(res, 400, 'Tanggal surat tidak valid (YYYY-MM-DD)');
    return null;
  }
  if (!perihal || !String(perihal).trim()) {
    sendError(res, 400, 'Perihal surat wajib diisi');
    return null;
  }
  if (!tujuan || !String(tujuan).trim()) {
    sendError(res, 400, 'Tujuan surat (Yth.) wajib diisi');
    return null;
  }
  let bidId = null;
  if (bidang_id !== '' && bidang_id != null) {
    const found = db.prepare('SELECT id FROM surat_bidang WHERE id = ?').get(Number(bidang_id));
    if (!found) {
      sendError(res, 400, 'Bidang tidak ditemukan');
      return null;
    }
    bidId = found.id;
  }
  if (!VALID_SIFAT.includes(sifat)) {
    sendError(res, 400, `Sifat surat harus salah satu: ${VALID_SIFAT.join(', ')}`);
    return null;
  }
  return {
    tanggal,
    perihal: String(perihal).trim().slice(0, 300),
    tujuan: String(tujuan).trim().slice(0, 200),
    bidangId: bidId,
    lampiran: String(lampiran).slice(0, 120),
    sifat,
    keterangan: String(keterangan).slice(0, 500),
    isi: String(isi).slice(0, 20000),
  };
}

export function registerSuratRoutes(router) {
  /* ── Daftar & filter arsip surat ── */
  router.get('/api/surat', authRequired(), (req, res, ctx) => {
    const { page = '1', limit = '10', search = '', bidang_id = '', sifat = '', tahun = '' } = ctx.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const where = [];
    const params = [];
    if (bidang_id) { where.push('s.bidang_id = ?'); params.push(Number(bidang_id)); }
    if (VALID_SIFAT.includes(sifat)) { where.push('s.sifat = ?'); params.push(sifat); }
    if (/^\d{4}$/.test(tahun)) { where.push('s.number_year = ?'); params.push(Number(tahun)); }
    if (search.trim()) {
      where.push('(s.nomor LIKE ? OR s.perihal LIKE ? OR s.tujuan LIKE ? OR s.keterangan LIKE ? OR b.name LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM surat s LEFT JOIN surat_bidang b ON b.id = s.bidang_id ${whereSql}`)
      .get(...params).n;

    const rows = db
      .prepare(
        `SELECT s.*, b.name AS bidang_name, b.code AS bidang_code, u.username AS created_by_name
           FROM surat s
           LEFT JOIN surat_bidang b ON b.id = s.bidang_id
           LEFT JOIN users u ON u.id = s.created_by
           ${whereSql}
          ORDER BY s.number_year DESC, s.number_seq DESC, s.id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limitNum, (pageNum - 1) * limitNum);

    sendJson(res, 200, { data: rows, page: pageNum, limit: limitNum, total, pages: Math.max(1, Math.ceil(total / limitNum)) });
  });

  /* ── Preview nomor surat berikutnya (untuk generator) ── */
  router.get('/api/surat/next', authRequired(), (req, res, ctx) => {
    const rawYear = ctx.query.year || String(new Date().getFullYear());
    const year = /^\d{4}$/.test(rawYear) ? Number(rawYear) : new Date().getFullYear();
    const { kode, org, ketua } = suratSettings();
    const seq = nextSeq(year);
    sendJson(res, 200, { nomor: buildNomor(kode, org, seq, year), seq, year, kode, org, ketua });
  });

  /* ── Daftar bidang ── */
  router.get('/api/surat/bidang', authRequired(), (req, res) => {
    sendJson(res, 200, { data: db.prepare('SELECT * FROM surat_bidang ORDER BY sort_order, id').all() });
  });

  /* ── Tambah bidang baru ── */
  router.post('/api/surat/bidang', authRequired(), (req, res, ctx) => {
    const { name, code = '' } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama bidang wajib diisi');
    try {
      const result = db
        .prepare('INSERT INTO surat_bidang (name, code, sort_order) VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM surat_bidang), 1))')
        .run(String(name).trim(), String(code).trim().slice(0, 10));
      audit(ctx.user.id, 'CREATE_BIDANG', `Tambah bidang surat "${name.trim()}"`);
      sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Bidang sudah ada');
      throw err;
    }
  });

  /* ── Ubah bidang ── */
  router.put('/api/surat/bidang/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM surat_bidang WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Bidang tidak ditemukan');
    const { name, code = '' } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama bidang wajib diisi');
    try {
      db.prepare('UPDATE surat_bidang SET name = ?, code = ? WHERE id = ?').run(String(name).trim(), String(code).trim().slice(0, 10), id);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Bidang sudah ada');
      throw err;
    }
  });

  /* ── Hapus bidang ── */
  router.delete('/api/surat/bidang/:id', authRequired('admin'), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM surat_bidang WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Bidang tidak ditemukan');
    const used = db.prepare('SELECT COUNT(*) AS n FROM surat WHERE bidang_id = ?').get(id).n;
    if (used > 0) return sendError(res, 409, `Bidang dipakai ${used} surat. Ubah bidang pada surat terkait terlebih dahulu.`);
    db.prepare('DELETE FROM surat_bidang WHERE id = ?').run(id);
    audit(ctx.user.id, 'DELETE_BIDANG', `Hapus bidang surat "${existing.name}"`);
    sendJson(res, 200, { ok: true });
  });

  /* ── Buat surat baru (nomor otomatis, aman dari race condition) ── */
  router.post('/api/surat', authRequired(), (req, res, ctx) => {
    const v = validatePayload(ctx.body, res);
    if (!v) return;
    const year = Number(v.tanggal.slice(0, 4));
    const { kode, org } = suratSettings();

    db.exec('BEGIN IMMEDIATE');
    try {
      const seq = nextSeq(year);
      const nomor = buildNomor(kode, org, seq, year);
      const result = db
        .prepare(
          'INSERT INTO surat (number_seq, number_year, nomor, tanggal, perihal, tujuan, bidang_id, lampiran, sifat, keterangan, isi, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(seq, year, nomor, v.tanggal, v.perihal, v.tujuan, v.bidangId, v.lampiran, v.sifat, v.keterangan, v.isi, ctx.user.id);
      db.exec('COMMIT');
      audit(ctx.user.id, 'CREATE_SURAT', `Buat surat ${nomor} — ${v.perihal}`);
      sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid), nomor });
    } catch (err) {
      db.exec('ROLLBACK');
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Nomor surat bentrok, silakan coba lagi');
      throw err;
    }
  });

  /* ── Ubah surat (opsional: buat ulang nomor apabila tahun berubah / salah urut) ── */
  router.put('/api/surat/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM surat WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Surat tidak ditemukan');
    const v = validatePayload(ctx.body, res);
    if (!v) return;

    const regenerate = Boolean((ctx.body || {}).regenerate_number);
    const year = Number(v.tanggal.slice(0, 4));
    const { kode, org } = suratSettings();

    db.exec('BEGIN IMMEDIATE');
    try {
      let seq = existing.number_seq;
      let numberYear = year;
      let nomor = existing.nomor;

      if (regenerate || year !== existing.number_year) {
        seq = nextSeq(year);
        nomor = buildNomor(kode, org, seq, year);
      }
      // Nomor unik: pastikan tidak bentrok dengan surat lain
      const clash = db.prepare('SELECT id FROM surat WHERE nomor = ? AND id != ?').get(nomor, id);
      if (clash) throw Object.assign(new Error('NOMOR_CLASH'), { code: 'NOMOR_CLASH' });
      const seqClash = db.prepare('SELECT id FROM surat WHERE number_year = ? AND number_seq = ? AND id != ?').get(numberYear, seq, id);
      if (seqClash) throw Object.assign(new Error('SEQ_CLASH'), { code: 'SEQ_CLASH' });

      db.prepare(
        'UPDATE surat SET number_seq = ?, number_year = ?, nomor = ?, tanggal = ?, perihal = ?, tujuan = ?, bidang_id = ?, lampiran = ?, sifat = ?, keterangan = ?, isi = ? WHERE id = ?'
      ).run(seq, numberYear, nomor, v.tanggal, v.perihal, v.tujuan, v.bidangId, v.lampiran, v.sifat, v.keterangan, v.isi, id);
      db.exec('COMMIT');
      audit(ctx.user.id, 'UPDATE_SURAT', `Ubah surat ${nomor}${regenerate ? ' (nomor dibuat ulang)' : ''}`);
      sendJson(res, 200, { ok: true, nomor });
    } catch (err) {
      db.exec('ROLLBACK');
      if (err.code === 'NOMOR_CLASH' || err.code === 'SEQ_CLASH') return sendError(res, 409, 'Nomor surat bentrok dengan surat lain');
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Nomor surat bentrok');
      throw err;
    }
  });

  /* ── Hapus surat ── */
  router.delete('/api/surat/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM surat WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Surat tidak ditemukan');
    db.prepare('DELETE FROM surat WHERE id = ?').run(id);
    audit(ctx.user.id, 'DELETE_SURAT', `Hapus surat ${existing.nomor} — ${existing.perihal}`);
    sendJson(res, 200, { ok: true });
  });

  /* ── Export CSV arsip surat ── */
  router.get('/api/surat/export.csv', authRequired(), (req, res, ctx) => {
    const { tahun = '', bidang_id = '', sifat = '', search = '' } = ctx.query;
    const where = [];
    const params = [];
    if (/^\d{4}$/.test(tahun)) { where.push('s.number_year = ?'); params.push(Number(tahun)); }
    if (bidang_id) { where.push('s.bidang_id = ?'); params.push(Number(bidang_id)); }
    if (VALID_SIFAT.includes(sifat)) { where.push('s.sifat = ?'); params.push(sifat); }
    if (search.trim()) {
      where.push('(s.nomor LIKE ? OR s.perihal LIKE ? OR s.tujuan LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT s.nomor, s.tanggal, s.perihal, s.tujuan, b.name AS bidang, s.sifat, s.lampiran, s.keterangan
           FROM surat s LEFT JOIN surat_bidang b ON b.id = s.bidang_id
           ${whereSql}
          ORDER BY s.number_year DESC, s.number_seq DESC`
      )
      .all(...params);
    const headers = ['Nomor Surat', 'Tanggal', 'Perihal', 'Tujuan (Yth.)', 'Bidang', 'Sifat', 'Lampiran', 'Keterangan'];
    const body = rows.map((r) => [r.nomor, r.tanggal, r.perihal, r.tujuan, r.bidang || '-', r.sifat, r.lampiran || '-', r.keterangan || '-']);
    sendCsv(res, `arsip-surat_${tahun || 'semua'}.csv`, toCsv(headers, body));
  });
}
