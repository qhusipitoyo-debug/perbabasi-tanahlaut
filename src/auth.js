/**
 * Keamanan: hashing password (scrypt) & JSON Web Token (HS256) — diimplementasikan
 * langsung dengan node:crypto, tanpa dependensi eksternal.
 */
import crypto from 'node:crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, KEY_LEN, SCRYPT_PARAMS);
  return ['scrypt', SCRYPT_PARAMS.N, SCRYPT_PARAMS.r, SCRYPT_PARAMS.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    if (expected.length !== KEY_LEN) return false;
    const derived = crypto.scryptSync(String(password), salt, KEY_LEN, { N: Number(N), r: Number(r), p: Number(p) });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

const b64urlEncode = (input) => Buffer.from(input).toString('base64url');
const b64urlDecode = (input) => Buffer.from(input, 'base64url');

export function signJwt(payload, secret, expiresInSec) {
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec }));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Format token tidak valid');
  const [header, body, signature] = parts;

  const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const actualSig = b64urlDecode(signature);
  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    throw new Error('Signature token tidak valid');
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8'));
  } catch {
    throw new Error('Payload token rusak');
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) throw new Error('Sesi berakhir (token kedaluwarsa). Silakan login kembali.');
  return payload;
}
