/**
 * Konfigurasi terpusat. Semua nilai bisa dioverride lewat environment variable.
 */
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

/** JWT secret: dari env JWT_SECRET, atau dibuat acak & disimpan di data/.jwt_secret */
function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) return process.env.JWT_SECRET;
  const secretFile = path.join(DATA_DIR, '.jwt_secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch { /* belum ada → buat baru */ }
  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    console.warn('  ⚠️  JWT_SECRET tidak diset. Secret acak dibuat di', secretFile);
  } catch (err) {
    console.warn('  ⚠️  Gagal menyimpan JWT secret acak:', err.message);
  }
  return generated;
}

export const config = {
  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(DATA_DIR, 'perbasasi.db'),
  jwtSecret: getJwtSecret(),
  jwtExpiresInSec: Number(process.env.JWT_EXPIRES_IN_SEC || 12 * 3600), // default 12 jam
  seedDemo: (process.env.SEED_DEMO ?? 'true') !== 'false',
  maxBodyBytes: 1024 * 1024, // 1 MB
  loginRateLimit: { windowMs: 10 * 60 * 1000, maxAttempts: 10 },
};
