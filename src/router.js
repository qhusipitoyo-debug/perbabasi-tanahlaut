/**
 * Mini router vanilla: pattern '/api/transaksi/:id', middleware chain,
 * parsing body JSON & query string built-in.
 */
import { readBody, sendError } from './helpers.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, ...handlers) {
    const keys = [];
    const regex = new RegExp(
      '^' +
        pattern
          .split('/')
          .map((seg) => {
            if (seg.startsWith(':')) {
              keys.push(seg.slice(1));
              return '([^/]+)';
            }
            return escapeRegex(seg);
          })
          .join('/') +
        '$'
    );
    this.routes.push({ method: method.toUpperCase(), pattern, regex, keys, handlers });
    return this;
  }

  get(pattern, ...handlers) { return this.add('GET', pattern, ...handlers); }
  post(pattern, ...handlers) { return this.add('POST', pattern, ...handlers); }
  put(pattern, ...handlers) { return this.add('PUT', pattern, ...handlers); }
  delete(pattern, ...handlers) { return this.add('DELETE', pattern, ...handlers); }

  async handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;

      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });

      const ctx = { params, query: Object.fromEntries(url.searchParams), body: undefined, user: null };

      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          ctx.body = await readBody(req);
        } catch (err) {
          sendError(res, err.status || 400, err.message || 'Body tidak valid');
          return;
        }
      }

      try {
        for (const handler of route.handlers) {
          await handler(req, res, ctx);
          if (res.writableEnded) break;
        }
      } catch (err) {
        console.error(`Error di ${route.method} ${route.pattern}:`, err);
        if (!res.writableEnded) sendError(res, 500, 'Terjadi kesalahan pada server');
      }
      return;
    }

    sendError(res, 404, 'Endpoint tidak ditemukan');
  }
}
