/**
 * Helper bersama: response JSON, security headers, baca body, static files & audit log.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db } from './db.js';

export function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function sendError(res, status, message, details) {
  sendJson(res, status, details ? { error: message, details } : { error: message });
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > config.maxBodyBytes) {
        reject(Object.assign(new Error('Payload terlalu besar (maks 1 MB)'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Body harus berupa JSON yang valid'), { status: 400 }));
      }
    });
    req.on('error', () => reject(Object.assign(new Error('Gagal membaca body'), { status: 400 })));
  });
}

/** Header keamanan sederhana (ala helmet) */
export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
}

export function audit(userId, action, detail = '') {
  try {
    db.prepare('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)').run(userId ?? null, String(action).slice(0, 120), String(detail).slice(0, 500));
  } catch (err) {
    console.error('Gagal menulis audit log:', err.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** Static file server dengan proteksi path traversal + fallback SPA ke index.html */
export function serveStatic(req, res, publicDir, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 405, 'Method tidak diizinkan');
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendError(res, 400, 'URL tidak valid');
    return;
  }
  if (decoded.includes('\0')) {
    sendError(res, 400, 'URL tidak valid');
    return;
  }

  const safePath = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    sendError(res, 403, 'Akses ditolak');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');

  if (!fs.existsSync(filePath)) {
    // SPA fallback: route tanpa ekstensi → index.html
    if (!path.extname(safePath)) filePath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(filePath)) {
      sendError(res, 404, 'File tidak ditemukan');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' || path.basename(filePath) === 'sw.js' ? 'no-cache' : 'public, max-age=3600',
  };
  if (path.basename(filePath) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

export function toCsvValue(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(toCsvValue).join(',')];
  for (const row of rows) lines.push(row.map(toCsvValue).join(','));
  return '﻿' + lines.join('\r\n'); // BOM agar Excel membaca UTF-8
}

export function sendCsv(res, filename, csv) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.end(csv);
}

export function isValidDateString(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function isValidPeriod(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function toIntAmount(v) {
  const n = typeof v === 'string' ? Number(v.replace(/[^\d-]/g, '')) : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
