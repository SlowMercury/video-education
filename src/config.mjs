import { validPasswordHash } from './security.mjs';

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const parsed = new URL(env.SITE_ORIGIN || `http://localhost:${port}`);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || (production && parsed.protocol !== 'https:')) throw new Error('SITE_ORIGIN must be an origin; production requires HTTPS');
  if (!validPasswordHash(env.OWNER_PASSWORD_HASH)) throw new Error('OWNER_PASSWORD_HASH is required; use the password hashing script');
  if (!env.RATE_LIMIT_SECRET || env.RATE_LIMIT_SECRET.length < 32) throw new Error('RATE_LIMIT_SECRET must contain at least 32 characters');
  if (env.DISCUSSIONS_ENABLED && !['true', 'false'].includes(env.DISCUSSIONS_ENABLED)) throw new Error('DISCUSSIONS_ENABLED must be true or false');
  const ownerName = (env.OWNER_DISPLAY_NAME || 'Айдар · автор курса').trim().normalize('NFC');
  if (!ownerName || [...ownerName].length > 60 || /[\u0000-\u001f\u007f]/.test(ownerName)) throw new Error('OWNER_DISPLAY_NAME must contain 1–60 characters on one line');
  return {
    port, databaseUrl: env.DATABASE_URL, origin: parsed.origin,
    ownerPasswordHash: env.OWNER_PASSWORD_HASH, rateLimitSecret: env.RATE_LIMIT_SECRET,
    ownerName,
    enabled: env.DISCUSSIONS_ENABLED === 'true', trustRailwayProxy: env.TRUST_RAILWAY_PROXY === 'true',
    secureCookies: parsed.protocol === 'https:', cookieName: parsed.protocol === 'https:' ? '__Host-owner_session' : 'owner_session'
  };
}
