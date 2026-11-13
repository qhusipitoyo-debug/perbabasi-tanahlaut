/**
 * Backup database SQLite: download file .db setelah WAL checkpoint. Khusus admin.
 */
import fs from 'node:fs';
import { db } from '../db.js';
import { config } from '../config.js';
import { sendError, audit } from '../helpers.js';
import { authRequired } from '../middleware.js';

export function registerBackupRoutes(router) {
  router.get('/api/backup', authRequired('admin'), (req, res, ctx) => {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const filename = `backup-perbasasi_${stamp}.db`;
      res.writeHead(200, {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      });
      audit(ctx.user.id, 'BACKUP_DB', 'Mengunduh backup database');
      fs.createReadStream(config.dbPath).pipe(res);
    } catch (err) {
      console.error('Backup gagal:', err);
      sendError(res, 500, 'Gagal membuat backup database');
    }
  });

  router.get('/api/health', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'perbasasi-bendahara', time: new Date().toISOString() }));
  });
}
