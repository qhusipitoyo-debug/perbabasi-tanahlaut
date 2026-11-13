/**
 * Rute autentikasi: login (JWT), profil, ganti password.
 * Dilindungi rate limiting sederhana per IP+username.
 */
import { verifyPassword, hashPassword, signJwt } from '../auth.js';
import { config } from '../config.js';
import { db } from '../db.js';
import { sendJson, sendError, audit } from '../helpers.js';
import { authRequired } from '../middleware.js';

// Rate limiter in-memory: key = ip|username → { count, resetAt }
const loginAttempts = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) if (entry.resetAt <= now) loginAttempts.delete(key);
}, 60 * 1000).unref();

function rateLimitKey(req, username) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  return `${ip}|${String(username || '').toLowerCase()}`;
}

function checkRateLimit(req, username) {
  const key = rateLimitKey(req, username);
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= config.loginRateLimit.maxAttempts) {
    const waitMin = Math.ceil((entry.resetAt - now) / 60000);
    return `Terlalu banyak percobaan login. Coba lagi ${waitMin} menit lagi.`;
  }
  return null;
}

function recordFailure(req, username) {
  const key = rateLimitKey(req, username);
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + config.loginRateLimit.windowMs });
  } else {
    entry.count += 1;
  }
}

export function registerAuthRoutes(router) {
  router.post('/api/auth/login', (req, res, ctx) => {
    const { username, password } = ctx.body || {};
    if (!username || !password) return sendError(res, 400, 'Username dan password wajib diisi');

    const blocked = checkRateLimit(req, username);
    if (blocked) return sendError(res, 429, blocked);

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
    if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
      recordFailure(req, username);
      return sendError(res, 401, 'Username atau password salah');
    }
    loginAttempts.delete(rateLimitKey(req, username));

    const token = signJwt(
      { sub: user.id, username: user.username, role: user.role, name: user.full_name },
      config.jwtSecret,
      config.jwtExpiresInSec
    );
    audit(user.id, 'LOGIN', `Login dari ${req.socket.remoteAddress || 'unknown'}`);
    sendJson(res, 200, {
      token,
      expiresIn: config.jwtExpiresInSec,
      user: { id: user.id, username: user.username, name: user.full_name, role: user.role },
    });
  });

  router.get('/api/auth/me', authRequired(), (req, res, ctx) => {
    sendJson(res, 200, { user: ctx.user });
  });

  router.post('/api/auth/change-password', authRequired(), (req, res, ctx) => {
    const { oldPassword, newPassword } = ctx.body || {};
    if (!oldPassword || !newPassword) return sendError(res, 400, 'Password lama dan password baru wajib diisi');
    if (String(newPassword).length < 6) return sendError(res, 400, 'Password baru minimal 6 karakter');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
    if (!verifyPassword(oldPassword, user.password_hash)) {
      return sendError(res, 400, 'Password lama salah');
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
    audit(user.id, 'CHANGE_PASSWORD', 'Mengganti password sendiri');
    sendJson(res, 200, { ok: true, message: 'Password berhasil diubah' });
  });
}
