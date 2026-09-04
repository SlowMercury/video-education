# Discussion backend

The website and API share one Node.js service. PostgreSQL stores comments, owner sessions, migration history, and short-lived rate-limit counters. Visitor accounts are unnecessary. The discussion interface and owner login are included in the website.

## Running locally

1. Install Node.js 22+ and PostgreSQL, then run `npm ci`.
2. Copy `.env.example` to `.env` and set its values. Use a dedicated local database.
3. Generate an owner password hash by piping a password of 16–256 characters into `node scripts/hash-owner-password.mjs`. Set `OWNER_PASSWORD_HASH` to that output. Generate a separate random `RATE_LIMIT_SECRET` of at least 32 characters.
4. Run `node --env-file=.env scripts/migrate.mjs`, then `npm run dev`.
5. Set `DISCUSSIONS_ENABLED=true` in the local environment to exercise the API.

`npm start` reads environment variables supplied by the host. `npm run dev` additionally reads `.env`. A Railway pre-deploy hook is configured for `npm run migrate`; the server also runs the same idempotent migration at startup, so a skipped hook cannot leave a fresh deployment without its tables. Migrations are transactional, serialized with an advisory lock, and checked for changes after application.

The catalogue is derived from the numbered lesson sections and the X example JSON in `index.html`. IDs are `lesson:<section-id>` and `x:<post-id>`. Titles and ordering can change without moving conversations. Removing content deactivates its discussion without deleting stored comments.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; Railway uses the reference `${{Postgres.DATABASE_URL}}` over its private network. |
| `SITE_ORIGIN` | Exact origin allowed to make changes; HTTPS is required in production. |
| `OWNER_PASSWORD_HASH` | Versioned scrypt password hash. Changing it invalidates existing owner sessions. |
| `OWNER_DISPLAY_NAME` | Server-controlled name for authenticated owner comments. |
| `RATE_LIMIT_SECRET` | Random key for hashing client IP addresses in expiring rate counters. |
| `DISCUSSIONS_ENABLED` | `false` by default. The API returns `503 discussions_disabled` until launch. |
| `TRUST_RAILWAY_PROXY` | `true` only behind Railway's public edge; local servers ignore forwarded IP headers. |
| `PORT`, `NODE_ENV` | Listener port and runtime environment. |

The course remains readable when discussions are disabled. `/healthz` checks database/schema availability. Secrets must not be committed or included in website archives.

## API contract

All responses are JSON except the course HTML and health endpoint. Errors have the form `{ "error": { "code": "…", "message": "…" } }`. Error messages are in Russian for the course interface. No API response is cached and no cross-origin access is enabled.

| Method and path | Behavior |
| --- | --- |
| `GET /api/discussions` | Active lessons and examples, with stable IDs and titles. |
| `GET /api/comments?discussionId=lesson:idea&limit=20&after=0` | Chronological, flat comment list. `limit` is 1–50; `nextCursor` is a sequence string or `null`. Replies include `parentId`. |
| `POST /api/comments` | Create a comment or reply. Returns 201 for creation, 200 for an identical retry, or 409 when a request ID is reused with different content. |
| `GET /api/owner/session` | `{ isOwner: false }` or owner identity plus `csrfToken`. |
| `POST /api/owner/session` | Log in with `{ password }`; returns owner identity and `csrfToken`, and sets a seven-day session cookie. |
| `DELETE /api/owner/session` | Revoke the current session and clear the cookie. |
| `DELETE /api/comments/<uuid>` | Owner-only deletion. Erases the public name and message; keeps a placeholder when replies reference it. |

Example comment request:

```json
{
  "discussionId": "lesson:idea",
  "displayName": "Друг",
  "body": "Как подготовить первый кадр?",
  "parentId": null,
  "requestId": "abf858a7-2ef5-4a01-a349-73b893f8085d"
}
```

The browser should create `requestId` using `crypto.randomUUID()` once per submission and reuse it when retrying the same draft. Generate a fresh ID after editing the draft. Private request IDs and fingerprints are never returned in comment listings.

Names allow 1–60 characters and messages 1–5000, after trimming and Unicode normalization. Render both with `textContent`, including line breaks through CSS; do not interpret message text as HTML. The server controls `isOwner` and the owner's display name. A guest choosing the same name does not receive the owner badge.

## Owner sessions and write protection

Every modifying request must carry an `Origin` matching `SITE_ORIGIN`. POST requests require `Content-Type: application/json`. The browser normally supplies `Origin` for same-origin writes.

Owner deletion, logout, and posting also require `X-CSRF-Token`, obtained from the login response or `GET /api/owner/session`. Use same-origin fetch credentials. The session cookie is HttpOnly, SameSite=Strict, Secure in production, scoped to `/`, and has the `__Host-` prefix on HTTPS. Only its hash is stored in the database. Logout revokes it; expiry and a password-hash change invalidate it.

Guest posting is limited to 10 messages per minute and 100 per day per client IP; owner posting allows 60 per minute and 1000 per day. Login allows 5 attempts per 15 minutes per IP, with an additional global cap of 100. API requests have a 120-per-minute per-IP cap. Limits persist across application restarts and return HTTP 429 with `Retry-After`. Expired counters and sessions are removed hourly. Raw IP addresses are not stored by the application.

## Discussion interface

`assets/discussions.js` mounts a discussion beneath each numbered lesson and each X example. The X article carries the stable post ID; changing the order does not move its comments. Only these two assets and `index.html` are served as public files. Messages and names are inserted with `textContent`.

The interface loads comments as each discussion approaches the viewport, supports pagination and replies, and retains form values when a submission fails. The same unchanged attempt reuses its request UUID; submit controls remain disabled while a request is in flight. Only the visitor's name is saved in local browser storage. Owner session and CSRF data stay in memory; the session cookie is HttpOnly.

The owner screen opens from the footer or `/#owner`. Authentication is refreshed before writes. If an owner session expires, a request carrying its CSRF token is rejected rather than accepted as a guest. Deleting a parent preserves live descendant replies; a completely deleted branch disappears, including from paginated API responses.

## Tests

`npm test` requires `TEST_DATABASE_URL` pointing to a disposable local PostgreSQL database with a name ending in `_test`. The suite truncates comments, sessions, and rate counters in that database. It refuses a nonlocal or differently named database.

```sh
TEST_DATABASE_URL=postgresql://localhost:5432/video_education_test npm test
```

Nine integration scenarios verify catalogue and pagination, reply isolation, persistence across app restarts, migration reruns, concurrent retry deduplication, owner permissions, CSRF, session expiry and revocation, nested deletion visibility, validation, rate limits, public asset restrictions, the launch switch, and the real server entrypoint on a fresh temporary schema. The last test creates and removes its own temporary schema in the disposable test database.

## Operational notes

Database: Railway PostgreSQL 18 with a persistent volume, reached through private networking. The separate `database-backups` service creates daily logical dumps in the private `discussion-backups` bucket, retaining 14 days. It runs at 03:00 UTC (06:00 Moscow). This uses the current plan; built-in volume snapshots and PITR are not enabled. See `backup/README.md` for verification and restore instructions.

Railway reported that `railway.json` remains supported until 1 December 2026. Before that date, migrate deployment configuration to Railway's infrastructure-as-code format; include this in Run 4 maintenance.

References: [parameterized PostgreSQL queries](https://node-postgres.com/features/queries), [database transactions](https://node-postgres.com/apis/pool), [Railway edge headers](https://docs.railway.com/networking/public-networking/specs-and-limits), and [Railway guidance on forwarded client IPs](https://station.railway.com/questions/which-header-should-i-rely-on-for-real-c-d78a6f96).
