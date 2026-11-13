/**
 * Perbasasi Tanah Laut — Aplikasi Bendahara
 * Backend: Node.js murni (vanilla) — tanpa framework & tanpa dependensi npm.
 * Database: node:sqlite (built-in). Token: JWT HS256 (implementasi sendiri via node:crypto).
 */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.js';
import { initDb } from './src/db.js';
import { Router } from './src/router.js';
import { sendJson, sendError, securityHeaders, serveStatic } from './src/helpers.js';
import { registerAuthRoutes } from './src/routes/auth.js';
import { registerDashboardRoutes } from './src/routes/dashboard.js';
import { registerTransactionRoutes } from './src/routes/transactions.js';
import { registerKasRoutes } from './src/routes/kas.js';
import { registerCategoryRoutes } from './src/routes/categories.js';
import { registerMemberRoutes } from './src/routes/members.js';
import { registerDuesRoutes } from './src/routes/dues.js';
import { registerReportRoutes } from './src/routes/reports.js';
import { registerUserRoutes } from './src/routes/users.js';
import { registerSettingsRoutes } from './src/routes/settings.js';
import { registerAuditRoutes } from './src/routes/audit.js';
import { registerBackupRoutes } from './src/routes/backup.js';
import { registerSuratRoutes } from './src/routes/surat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.join(__dirname, 'public');

initDb();

const router = new Router();
registerAuthRoutes(router);
registerDashboardRoutes(router);
registerTransactionRoutes(router);
registerKasRoutes(router);
registerCategoryRoutes(router);
registerMemberRoutes(router);
registerDuesRoutes(router);
registerReportRoutes(router);
registerUserRoutes(router);
registerSettingsRoutes(router);
registerAuditRoutes(router);
registerBackupRoutes(router);
registerSuratRoutes(router);

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await router.handle(req, res);
      return;
    }
    serveStatic(req, res, PUBLIC_DIR, url.pathname);
  } catch (err) {
    console.error('Unhandled error:', err);
    if (!res.writableEnded) sendError(res, 500, 'Terjadi kesalahan internal pada server');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  ✖ Port ${config.port} sedang dipakai aplikasi lain.`);
    console.error('  ▸ Solusi: gunakan port lain, contoh:  PORT=8081 npm start');
    console.error('  ▸ Atau cari proses pemakai port:     ss -ltnp | grep ' + config.port);
    console.error('');
    process.exit(1);
  }
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log('');
  console.log('  🏀  PERBASI TANAH LAUT — Aplikasi Bendahara');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  ▸ Server berjalan di  : http://localhost:${config.port}`);
  console.log(`  ▸ Database            : ${config.dbPath}`);
  console.log(`  ▸ Mode                : ${process.env.NODE_ENV || 'development'}`);
  console.log('');
});
