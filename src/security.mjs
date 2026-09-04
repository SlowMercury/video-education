import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { isIP } from 'node:net';

const derive = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const digest = value => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export const validPasswordHash = value => /^scrypt-v1:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(value || '');

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 256) throw new Error('Owner password must contain 16–256 characters');
  const salt = randomBytes(16).toString('base64url');
  const key = await derive(password, salt, 64, scryptOptions);
  return `scrypt-v1:${salt}:${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256 || !validPasswordHash(stored)) return false;
  const [, salt, expected] = stored.split(':');
  const key = await derive(password, salt, 64, scryptOptions);
  return timingSafeEqual(key, Buffer.from(expected, 'base64url'));
}

export class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message); Object.assign(this, { status, code, headers });
  }
}

export function requireOrigin(request, config) {
  if (request.headers.origin !== config.origin || ['cross-site', 'none'].includes(request.headers['sec-fetch-site'])) {
    throw new HttpError(403, 'invalid_origin', 'Запрос должен быть отправлен с сайта курса.');
  }
}

export function sessionToken(request, config) {
  const prefix = `${config.cookieName}=`;
  const matches = (request.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(prefix));
  const token = matches.length === 1 ? matches[0].slice(prefix.length) : '';
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function sessionCookie(token, config, clear = false) {
  return `${config.cookieName}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 604800}${config.secureCookies ? '; Secure' : ''}`;
}

export const csrfFor = token => createHmac('sha256', token).update('video-education-owner-csrf').digest('hex');

export async function getOwner(request, pool, config) {
  const token = sessionToken(request, config);
  if (!token) return null;
  const result = await pool.query('SELECT token_hash FROM owner_sessions WHERE token_hash = $1 AND credential_version = $2 AND expires_at > now()', [digest(token), digest(config.ownerPasswordHash)]);
  return result.rowCount ? { token, csrfToken: csrfFor(token) } : null;
}

export function requireOwnerCsrf(request, owner) {
  if (!owner) throw new HttpError(401, 'owner_required', 'Требуется вход владельца.');
  const supplied = request.headers['x-csrf-token'];
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(owner.csrfToken))) {
    throw new HttpError(403, 'invalid_csrf', 'Обновите страницу и повторите действие.');
  }
}

export function clientKey(request, config) {
  // Trust proxy headers only on Railway's edge, never on the local/direct listener.
  const forwarded = config.trustRailwayProxy ? request.headers['x-forwarded-for']?.split(',')[0].trim() || request.headers['x-real-ip'] : null;
  let ip = isIP(forwarded || '') ? forwarded : request.socket.remoteAddress || 'unknown';
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return createHmac('sha256', config.rateLimitSecret).update(ip).digest('hex');
}

export async function rateLimit(pool, key, action, maximum, seconds) {
  const start = Math.floor(Date.now() / (seconds * 1000)) * seconds;
  const expiresAt = new Date((start + seconds) * 1000);
  const result = await pool.query(`INSERT INTO rate_limits (key, count, expires_at) VALUES ($1, 1, $2)
    ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`, [`${action}:${start}:${key}`, expiresAt]);
  if (result.rows[0].count > maximum) {
    throw new HttpError(429, 'rate_limited', 'Слишком много запросов. Попробуйте позже.', { 'Retry-After': String(Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))) });
  }
}
