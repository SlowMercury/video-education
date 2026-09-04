import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.mjs';
import { createPool, migrate } from '../src/db.mjs';
import { hashPassword, sessionCookie } from '../src/security.mjs';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set TEST_DATABASE_URL to a disposable local PostgreSQL database whose name ends in _test.');
const database = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) || !database.pathname.endsWith('_test')) throw new Error('Tests require a disposable local database ending in _test.');
const pool = createPool(databaseUrl);
const password = `test-only-${randomUUID()}`;
let config, server, base;
async function start() {
  server = createApp({ pool, config, logger: { error() {} } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  config.origin = base;
}
async function stop() { await new Promise(resolve => server.close(resolve)); }
async function call(path, { method = 'GET', body, cookie, csrf, origin = base, headers = {} } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(method !== 'GET' ? { Origin: origin } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, headers: response.headers, data: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
const message = (extra = {}) => ({ discussionId: 'lesson:idea', displayName: 'Друг', body: 'Как подготовить первый кадр?', requestId: randomUUID(), ...extra });
async function login() {
  const result = await call('/api/owner/session', { method: 'POST', body: { password } });
  assert.equal(result.status, 200);
  return { cookie: result.headers.get('set-cookie').split(';')[0], csrf: result.data.csrfToken };
}
before(async () => {
  await migrate(pool);
  config = { enabled: true, trustRailwayProxy: false, secureCookies: false, cookieName: 'owner_session', ownerName: 'Автор курса', ownerPasswordHash: await hashPassword(password), rateLimitSecret: randomUUID() };
  await start();
});
beforeEach(async () => { await pool.query('TRUNCATE comments, owner_sessions, rate_limits RESTART IDENTITY'); });
after(async () => { if (server) await stop(); await pool.end(); });

test('catalogue, paginated comments, replies, and data survive app and migration restarts', async () => {
  const catalogue = (await call('/api/discussions')).data.discussions;
  assert.equal(catalogue.filter(item => item.kind === 'lesson').length, 8);
  assert.equal(catalogue.filter(item => item.kind === 'example').length, 2);
  const parent = await call('/api/comments', { method: 'POST', body: message() });
  assert.equal(parent.status, 201);
  const reply = await call('/api/comments', { method: 'POST', body: message({ parentId: parent.data.comment.id, body: 'Попробуй сделать эскиз.' }) });
  assert.equal(reply.status, 201);
  assert.equal((await call('/api/comments', { method: 'POST', body: message({ discussionId: 'lesson:motion', parentId: parent.data.comment.id }) })).status, 404);
  const example = await call('/api/comments', { method: 'POST', body: message({ discussionId: 'x:2070145120658137385' }) });
  assert.equal(example.status, 201);
  await stop(); await migrate(pool); await start();
  const first = (await call('/api/comments?discussionId=lesson:idea&limit=1')).data;
  assert.equal(first.comments[0].id, parent.data.comment.id);
  const second = (await call(`/api/comments?discussionId=lesson:idea&limit=1&after=${first.nextCursor}`)).data;
  assert.equal(second.comments[0].id, reply.data.comment.id);
  assert.equal(second.comments[0].parentId, parent.data.comment.id);
  assert.equal(second.nextCursor, null);
  assert.equal((await call('/api/comments?discussionId=lesson:motion')).data.comments.length, 0);
});

test('concurrent retries create one comment; altered retries conflict; private fields stay private', async () => {
  const body = message();
  const results = await Promise.all(Array.from({ length: 4 }, () => call('/api/comments', { method: 'POST', body })));
  assert.equal(results.filter(result => result.status === 201).length, 1);
  assert.equal(new Set(results.map(result => result.data.comment.id)).size, 1);
  assert.equal((await pool.query('SELECT count(*) FROM comments')).rows[0].count, '1');
  assert.equal((await call('/api/comments', { method: 'POST', body: { ...body, body: 'Changed' } })).status, 409);
  const visible = (await call('/api/comments?discussionId=lesson:idea')).data.comments[0];
  assert.equal('request_id' in visible || 'requestId' in visible || 'request_hash' in visible, false);
});

test('owner badge, deletion and session mutations require authentication and CSRF protection', async () => {
  const parent = (await call('/api/comments', { method: 'POST', body: message({ displayName: config.ownerName }) })).data.comment;
  assert.equal(parent.isOwner, false);
  assert.equal((await call('/api/comments', { method: 'POST', body: message({ isOwner: true }) })).status, 400);
  const deletion = `/api/comments/${parent.id}`;
  assert.equal((await call(deletion, { method: 'DELETE' })).status, 401);
  const owner = await login();
  assert.equal((await call(deletion, { method: 'DELETE', cookie: owner.cookie })).status, 403);
  assert.equal((await call(deletion, { method: 'DELETE', ...owner, origin: 'https://other.example' })).status, 403);
  const reply = (await call('/api/comments', { method: 'POST', ...owner, body: message({ parentId: parent.id, displayName: 'Spoofed' }) })).data.comment;
  assert.equal(reply.isOwner, true);
  assert.equal(reply.displayName, config.ownerName);
  assert.equal((await call(deletion, { method: 'DELETE', ...owner })).status, 200);
  const rows = (await call('/api/comments?discussionId=lesson:idea')).data.comments;
  assert.equal(rows[0].body, null);
  assert.equal(rows[0].displayName, null);
  assert.ok(rows[0].deletedAt);
  assert.equal(rows[1].id, reply.id);
  assert.equal((await call('/api/owner/session', { method: 'DELETE', ...owner })).status, 200);
  assert.equal((await call('/api/owner/session', { cookie: owner.cookie })).data.isOwner, false);
  assert.equal((await call(`/api/comments/${reply.id}`, { method: 'DELETE', ...owner })).status, 401);
});

test('sessions expire, logout revokes them, credential changes invalidate them and cookies are protected', async () => {
  const owner = await login();
  const session = await call('/api/owner/session', { cookie: owner.cookie });
  assert.equal(session.data.isOwner, true);
  await stop(); await start();
  assert.equal((await call('/api/owner/session', { cookie: owner.cookie })).data.isOwner, true);
  const previousHash = config.ownerPasswordHash;
  config.ownerPasswordHash = await hashPassword(`rotated-${randomUUID()}`);
  assert.equal((await call('/api/owner/session', { cookie: owner.cookie })).data.isOwner, false);
  config.ownerPasswordHash = previousHash;
  await pool.query("UPDATE owner_sessions SET expires_at = now() - interval '1 second'");
  assert.equal((await call('/api/owner/session', { cookie: owner.cookie })).data.isOwner, false);
  assert.match(sessionCookie('token', { cookieName: '__Host-owner_session', secureCookies: true }), /Path=\/; HttpOnly; SameSite=Strict; Max-Age=604800; Secure/);
  const stored = (await pool.query('SELECT token_hash FROM owner_sessions')).rows[0].token_hash;
  assert.notEqual(stored, owner.cookie.split('=')[1]);
});

test('validation rejects malformed input and cross-site writes while preserving literal message text', async () => {
  for (const extra of [{ body: '' }, { body: 'x'.repeat(5001) }, { displayName: 'a'.repeat(61) }, { displayName: 'a\nb' }, { body: '\u0000' }, { requestId: 'invalid' }]) {
    assert.equal((await call('/api/comments', { method: 'POST', body: message(extra) })).status, 400);
  }
  assert.equal((await call('/api/comments', { method: 'POST', body: message({ discussionId: 'lesson:missing' }) })).status, 404);
  assert.equal((await call('/api/comments', { method: 'POST', body: message(), origin: 'https://other.example' })).status, 403);
  assert.equal((await call('/api/comments', { method: 'POST', body: message(), headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await call('/api/comments', { method: 'POST', body: message({ body: 'a'.repeat(33000) }) })).status, 413);
  const literal = `<script>alert('hello')</script> '; DROP TABLE comments; --`;
  const result = await call('/api/comments', { method: 'POST', body: message({ body: literal }) });
  assert.equal(result.status, 201);
  assert.equal(result.data.comment.body, literal);
  assert.equal((await call('/api/comments?discussionId=lesson:idea&after=9223372036854775808')).status, 400);
  assert.equal((await call('/api/comments?discussionId=lesson:idea&limit=51')).status, 400);
});

test('posting and login limits persist across restarts and ignore spoofed local proxy headers', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/comments', { method: 'POST', body: message() })).status, 201);
  await stop(); await start();
  const limited = await call('/api/comments', { method: 'POST', body: message(), headers: { 'X-Forwarded-For': '8.8.8.8', 'X-Real-IP': '8.8.8.8' } });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  for (let i = 0; i < 5; i++) assert.equal((await call('/api/owner/session', { method: 'POST', body: { password: 'wrong' } })).status, 401);
  assert.equal((await call('/api/owner/session', { method: 'POST', body: { password } })).status, 429);
});

test('launch switch keeps API closed and course available; private files stay private', async () => {
  config.enabled = false;
  try {
    assert.equal((await call('/')).status, 200);
    assert.equal((await call('/healthz')).data, 'ok');
    assert.equal((await call('/api/discussions')).data.error.code, 'discussions_disabled');
    assert.equal((await call('/api/comments', { method: 'POST', body: message() })).status, 503);
    for (const path of ['/src/config.mjs', '/.env', '/migrations/001_discussions.sql', '/PROGRESS.md']) assert.equal((await call(path)).status, 404);
  } finally { config.enabled = true; }
});
