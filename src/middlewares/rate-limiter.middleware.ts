// ============================================================================
// DPRD Chatbot — In-Memory Rate Limiter Middleware
// ============================================================================

import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment';
import { AppError } from '../types/index';

interface RateLimitEntry {
  count: number;
  reset_at: number;
}

const store = new Map<string, RateLimitEntry>();

// Bersihkan entri kadaluarsa setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.reset_at) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Mendapatkan identifier unik dari request (IP address).
 */
function getClientId(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Rate limiter middleware — membatasi jumlah request per window waktu.
 */
export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const clientId = getClientId(req);
  const now = Date.now();
  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = env.RATE_LIMIT_MAX_REQUESTS;

  let entry = store.get(clientId);

  if (!entry || now > entry.reset_at) {
    entry = { count: 0, reset_at: now + windowMs };
    store.set(clientId, entry);
  }

  entry.count++;

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.reset_at / 1000));

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.reset_at - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    throw new AppError(
      `Terlalu banyak permintaan. Silakan coba lagi dalam ${retryAfter} detik.`,
      429,
    );
  }

  next();
}
