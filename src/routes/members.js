/**
 * CRUD anggota organisasi (atlet, pelatih, pengurus).
 */
import { db } from '../db.js';
import { sendJson, sendError, audit, isValidDateString } from '../helpers.js';
import { authRequired } from '../middleware.js';

export function registerMemberRoutes(router) {
  router.get('/api/members', authRequired(), (req, res, ctx) => {
    const { search = '', page = '1', limit = '50', active = '' } = ctx.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

    const where = [];
    const params = [];
    if (active === '1' || active === '0') { where.push('active = ?'); params.push(Number(active)); }
    if (search.trim()) {
      where.push('(name LIKE ? OR member_no LIKE ? OR position LIKE ? OR team LIKE ? OR phone LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS n FROM members ${whereSql}`).get(...params).n;
    const rows = db
      .prepare(`SELECT * FROM members ${whereSql} ORDER BY active DESC, name ASC LIMIT ? OFFSET ?`)
      .all(...params, limitNum, (pageNum - 1) * limitNum);

    sendJson(res, 200, { data: rows, total, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
  });

  router.post('/api/members', authRequired(), (req, res, ctx) => {
    const { member_no, name, position = '', team = '', phone = '', joined_at } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama anggota wajib diisi');
    if (joined_at && !isValidDateString(joined_at)) return sendError(res, 400, 'Tanggal bergabung tidak valid');
    try {
      const result = db
        .prepare('INSERT INTO members (member_no, name, position, team, phone, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(
          member_no ? String(member_no).trim() : null,
          String(name).trim(),
          String(position).slice(0, 80),
          String(team).slice(0, 80),
          String(phone).slice(0, 30),
          joined_at || new Date().toISOString().slice(0, 10)
        );
      audit(ctx.user.id, 'CREATE_ANGGOTA', `Tambah anggota "${name}"`);
      sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Nomor anggota sudah dipakai');
      throw err;
    }
  });

  router.put('/api/members/:id', authRequired(), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Anggota tidak ditemukan');
    const { member_no, name, position = '', team = '', phone = '', active = 1, joined_at } = ctx.body || {};
    if (!name || !String(name).trim()) return sendError(res, 400, 'Nama anggota wajib diisi');
    if (joined_at && !isValidDateString(joined_at)) return sendError(res, 400, 'Tanggal bergabung tidak valid');
    try {
      db.prepare('UPDATE members SET member_no = ?, name = ?, position = ?, team = ?, phone = ?, active = ?, joined_at = ? WHERE id = ?')
        .run(
          member_no ? String(member_no).trim() : null,
          String(name).trim(),
          String(position).slice(0, 80),
          String(team).slice(0, 80),
          String(phone).slice(0, 30),
          active ? 1 : 0,
          joined_at || existing.joined_at,
          id
        );
      audit(ctx.user.id, 'UPDATE_ANGGOTA', `Ubah anggota #${id} "${name}"`);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendError(res, 409, 'Nomor anggota sudah dipakai');
      throw err;
    }
  });

  router.delete('/api/members/:id', authRequired('admin'), (req, res, ctx) => {
    const id = Number(ctx.params.id);
    const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, 'Anggota tidak ditemukan');
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
    audit(ctx.user.id, 'DELETE_ANGGOTA', `Hapus anggota "${existing.name}"`);
    sendJson(res, 200, { ok: true });
  });
}
