import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { HttpError, clientKey, csrfFor, digest, getOwner, randomToken, rateLimit, requireOrigin, requireOwnerCsrf, sessionCookie, sessionToken, verifyPassword } from './security.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/assets/discussions.css', ['assets/discussions.css', 'text/css']],
  ['/assets/discussions.js', ['assets/discussions.js', 'text/javascript']]
]);
const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };

function send(request, response, status, data, extra = {}) {
  const body = JSON.stringify(data).replace(/</g, '\\u003c');
  response.writeHead(status, { ...headers, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', ...extra });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw new HttpError(415, 'json_required', 'Отправьте данные в формате JSON.');
  if (Number(request.headers['content-length']) > 32768) throw new HttpError(413, 'body_too_large', 'Сообщение слишком большое.', { Connection: 'close' });
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 32768) { reject(new HttpError(413, 'body_too_large', 'Сообщение слишком большое.', { Connection: 'close' })); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
        resolve(data);
      } catch { reject(new HttpError(400, 'invalid_json', 'Некорректные данные сообщения.')); }
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new HttpError(400, 'request_aborted', 'Отправка прервана.')));
  });
}

function textField(value, name, maximum, singleLine = false) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_input', `Заполните поле «${name}».`);
  const result = value.trim().normalize('NFC');
  if (!result.length || [...result].length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result) || (singleLine && /[\r\n\t]/.test(result))) throw new HttpError(400, 'invalid_input', `Проверьте поле «${name}» (до ${maximum} символов).`);
  return result;
}

function onlyFields(body, allowed) {
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(400, 'unknown_field', 'Неизвестное поле запроса.');
}

const commentView = row => ({ id: row.id, sequence: row.sequence, discussionId: row.discussion_id, parentId: row.parent_id,
  displayName: row.display_name, body: row.body, isOwner: row.deleted_at ? false : row.is_owner, createdAt: row.created_at, deletedAt: row.deleted_at });

async function requireDiscussion(pool, id) {
  if (typeof id !== 'string' || id.length > 100) throw new HttpError(400, 'invalid_discussion', 'Выберите урок или пример.');
  const result = await pool.query('SELECT id FROM discussion_items WHERE id = $1 AND active = true', [id]);
  if (!result.rowCount) throw new HttpError(404, 'discussion_not_found', 'Обсуждение не найдено.');
}

export function createApp({ pool, config, logger = console }) {
  const server = createServer(async (request, response) => {
    try {
      let url;
      try { url = new URL(request.url, 'http://localhost'); }
      catch { throw new HttpError(400, 'invalid_url', 'Некорректный адрес.'); }
      const path = url.pathname;
      if (path === '/healthz' && ['GET', 'HEAD'].includes(request.method)) {
        await pool.query('SELECT version FROM schema_migrations LIMIT 1');
        response.writeHead(200, { ...headers, 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : 'ok'); return;
      }
      if (publicFiles.has(path) && ['GET', 'HEAD'].includes(request.method)) {
        const [file, type] = publicFiles.get(path);
        const page = await readFile(new URL(`../${file}`, import.meta.url));
        response.writeHead(200, { ...headers, 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache', 'Content-Length': page.length });
        response.end(request.method === 'HEAD' ? undefined : page); return;
      }
      if (!path.startsWith('/api/')) {
        if (publicFiles.has(path) || path === '/healthz') throw new HttpError(405, 'method_not_allowed', 'Метод не поддерживается.', { Allow: 'GET, HEAD' });
        throw new HttpError(404, 'not_found', 'Страница не найдена.');
      }
      if (!config.enabled) throw new HttpError(503, 'discussions_disabled', 'Обсуждения скоро появятся.');
      const key = clientKey(request, config);
      await rateLimit(pool, key, 'api', 120, 60);
      if (!['GET', 'HEAD'].includes(request.method)) requireOrigin(request, config);

      if (path === '/api/discussions' && request.method === 'GET') {
        const result = await pool.query('SELECT id, kind, title, source_url AS "sourceUrl" FROM discussion_items WHERE active = true ORDER BY id');
        send(request, response, 200, { discussions: result.rows }); return;
      }
      if (path === '/api/comments' && request.method === 'GET') {
        const discussionId = url.searchParams.get('discussionId');
        await requireDiscussion(pool, discussionId);
        const after = url.searchParams.get('after') || '0';
        const limitString = url.searchParams.get('limit') || '20';
        if (!/^\d{1,19}$/.test(after) || BigInt(after) > 9223372036854775807n || !/^\d{1,2}$/.test(limitString) || Number(limitString) < 1 || Number(limitString) > 50) throw new HttpError(400, 'invalid_pagination', 'Некорректные параметры страницы.');
        const limit = Number(limitString);
        const result = await pool.query(`WITH RECURSIVE visible AS (
          SELECT id, parent_id FROM comments WHERE discussion_id = $1 AND deleted_at IS NULL
          UNION
          SELECT c.id, c.parent_id FROM comments c JOIN visible v ON c.id = v.parent_id
        ) SELECT c.* FROM comments c JOIN visible v ON c.id = v.id
          WHERE c.discussion_id = $1 AND c.sequence > $2
          ORDER BY c.sequence LIMIT $3`, [discussionId, after, limit + 1]);
        const more = result.rows.length > limit;
        const rows = result.rows.slice(0, limit);
        send(request, response, 200, { comments: rows.map(commentView), nextCursor: more ? rows.at(-1).sequence : null }); return;
      }
      if (path === '/api/owner/session' && request.method === 'GET') {
        const owner = await getOwner(request, pool, config);
        send(request, response, 200, owner ? { isOwner: true, displayName: config.ownerName, csrfToken: owner.csrfToken } : { isOwner: false }); return;
      }
      if (path === '/api/owner/session' && request.method === 'POST') {
        await rateLimit(pool, key, 'login', 5, 900);
        await rateLimit(pool, 'all', 'login-global', 100, 900);
        const body = await readJson(request);
        onlyFields(body, ['password']);
        if (!await verifyPassword(body.password, config.ownerPasswordHash)) throw new HttpError(401, 'invalid_credentials', 'Неверный пароль.');
        const token = randomToken();
        await transaction(pool, async client => {
          const previous = sessionToken(request, config);
          if (previous) await client.query('DELETE FROM owner_sessions WHERE token_hash = $1', [digest(previous)]);
          await client.query("INSERT INTO owner_sessions (token_hash, credential_version, expires_at) VALUES ($1, $2, now() + interval '7 days')", [digest(token), digest(config.ownerPasswordHash)]);
        });
        send(request, response, 200, { isOwner: true, displayName: config.ownerName, csrfToken: csrfFor(token) }, { 'Set-Cookie': sessionCookie(token, config) }); return;
      }
      if (path === '/api/owner/session' && request.method === 'DELETE') {
        const owner = await getOwner(request, pool, config);
        requireOwnerCsrf(request, owner);
        await pool.query('DELETE FROM owner_sessions WHERE token_hash = $1', [digest(owner.token)]);
        send(request, response, 200, { isOwner: false }, { 'Set-Cookie': sessionCookie('', config, true) }); return;
      }
      if (path === '/api/comments' && request.method === 'POST') {
        const body = await readJson(request);
        onlyFields(body, ['discussionId', 'parentId', 'displayName', 'body', 'requestId']);
        await requireDiscussion(pool, body.discussionId);
        const owner = await getOwner(request, pool, config);
        if (owner || request.headers['x-csrf-token']) requireOwnerCsrf(request, owner);
        const name = owner ? config.ownerName : textField(body.displayName, 'Имя', 60, true);
        const message = textField(body.body, 'Сообщение', 5000);
        const parentId = body.parentId ?? null;
        if ((parentId !== null && (typeof parentId !== 'string' || !uuid.test(parentId))) || typeof body.requestId !== 'string' || !uuid.test(body.requestId)) throw new HttpError(400, 'invalid_identifier', 'Некорректный идентификатор сообщения.');
        const hash = digest(JSON.stringify([body.discussionId, parentId, name, message, Boolean(owner)]));
        const replay = row => {
          if (row.request_hash !== hash) throw new HttpError(409, 'request_conflict', 'Этот запрос уже использован для другого сообщения.');
          return { status: 200, row };
        };
        const existing = await pool.query('SELECT * FROM comments WHERE request_id = $1', [body.requestId]);
        if (existing.rowCount) { const result = replay(existing.rows[0]); send(request, response, result.status, { comment: commentView(result.row) }); return; }
        await rateLimit(pool, key, 'posting-minute', owner ? 60 : 10, 60);
        await rateLimit(pool, key, 'posting-day', owner ? 1000 : 100, 86400);
        const result = await transaction(pool, async client => {
          if (parentId) {
            const parent = await client.query('SELECT id FROM comments WHERE id = $1 AND discussion_id = $2 AND deleted_at IS NULL FOR SHARE', [parentId, body.discussionId]);
            if (!parent.rowCount) throw new HttpError(404, 'parent_not_found', 'Исходное сообщение не найдено в этом обсуждении.');
          }
          const inserted = await client.query(`INSERT INTO comments (id, discussion_id, parent_id, display_name, body, is_owner, request_id, request_hash)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (request_id) DO NOTHING RETURNING *`,
          [randomUUID(), body.discussionId, parentId, name, message, Boolean(owner), body.requestId, hash]);
          if (inserted.rowCount) return { status: 201, row: inserted.rows[0] };
          return replay((await client.query('SELECT * FROM comments WHERE request_id = $1', [body.requestId])).rows[0]);
        });
        send(request, response, result.status, { comment: commentView(result.row) }); return;
      }
      if (path.startsWith('/api/comments/') && request.method === 'DELETE') {
        const id = path.slice('/api/comments/'.length);
        if (!uuid.test(id)) throw new HttpError(400, 'invalid_identifier', 'Некорректный идентификатор.');
        const owner = await getOwner(request, pool, config);
        requireOwnerCsrf(request, owner);
        const result = await pool.query('UPDATE comments SET deleted_at = COALESCE(deleted_at, now()), display_name = NULL, body = NULL, is_owner = false WHERE id = $1 RETURNING *', [id]);
        if (!result.rowCount) throw new HttpError(404, 'comment_not_found', 'Сообщение не найдено.');
        send(request, response, 200, { comment: commentView(result.rows[0]) }); return;
      }
      const allowed = { '/api/comments': 'GET, POST', '/api/discussions': 'GET', '/api/owner/session': 'GET, POST, DELETE' }[path];
      if (allowed) throw new HttpError(405, 'method_not_allowed', 'Метод не поддерживается.', { Allow: allowed });
      throw new HttpError(404, 'not_found', 'Страница не найдена.');
    } catch (error) {
      if (!(error instanceof HttpError)) logger.error('Request failed', error.code || error.name);
      if (!response.headersSent && !response.destroyed) {
        send(request, response, error.status || 503, { error: { code: error.code && error instanceof HttpError ? error.code : 'service_unavailable', message: error instanceof HttpError ? error.message : 'Сервис временно недоступен. Попробуйте позже.' } }, error.headers);
      }
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
