# Video Education — progress and runbook

Updated: 4 September 2026.

## Current status

**Runs 1–3 are complete.** Public discussions are enabled beneath all eight lessons and both X examples. Visitors can post and reply with a name; the owner can sign in, answer with an author badge, and delete comments. Nine integration scenarios and the browser checks pass. Comments and the owner session survived a production redeployment. All five verification messages were removed from public discussions afterward.

## Run 3 checkpoint

- Public website: [Video Education](https://video-education-production.up.railway.app).
- Owner login: [Вход для автора](https://video-education-production.up.railway.app/#owner), also linked in the footer. The generated owner password remains in the private local `video-education-owner-access.json` file outside the public repository; its login instructions are updated.
- `DISCUSSIONS_ENABLED=true` is configured on the web service. The existing PostgreSQL volume and daily private backups remain active.
- Added ten discussion areas, lazy loading, pagination, reply context, dates, authenticated author badges, remembered visitor names, and owner login/logout. Messages render as plain text.
- Failed submissions retain the draft and reuse an unchanged request's identifier. Submit controls prevent concurrent submissions. Owner authentication is refreshed before writes; expired owner requests cannot fall back to guest posting.
- Deletion requires confirmation. Deleted ancestors remain only when live replies need their context, including across pages; entirely deleted branches disappear.
- Nine integration scenarios passed on the disposable local PostgreSQL database. These cover data persistence, concurrent retry deduplication, reply isolation, owner authorization, CSRF, expiry/logout, nested deletions, input validation, rate limits, private-file restrictions, and server startup/migrations.
- Local browser verification: visitor post and reply, literal HTML-looking text, incorrect and correct owner passwords, author reply, deletion cancellation and confirmation, retained replies, logout, all ten mounts, responsive layout without horizontal overflow, and 22 comments across two pages with a late reply attached to its parent.
- A stopped local server produced a connection error; the draft stayed editable, and retry after restart published exactly one message. Both official X widgets also rendered during the interface check.
- Verified application revision: `56fe147a4877493899f354a61ff88c9ae68747bf`.
- Initial Run 3 production deployment: `57c68cbc-b98b-44b5-9aad-b5f57520bd4e`, `SUCCESS`.
- Production redeployment used for the persistence check: `18864f97-2c0c-4564-a761-807e91c89a9e`, `SUCCESS`.
- Public checks confirmed exact HTML/JS/CSS delivery, ten catalogue entries, secure owner cookies, visitor and owner replies, idempotent retries, discussion isolation, and unauthorized deletion rejection. A separate visitor browser successfully posted a reply and showed the authenticated author's badge.
- All five verification messages, reply links, and the test owner session survived redeployment. Their names/text were subsequently removed, no test branches remained visible, and the owner test session was revoked.
- The commit containing this checkpoint changes documentation only; application source matches the verified revision above. Run 4 has not started.

## Run 2 checkpoint

- PostgreSQL 18 service: `b58bcc9a-9273-4988-a16d-c7117b823018` (`Postgres`).
- Persistent volume: `5c3e187c-4e46-4b0a-83d7-308406fdc303`, mounted at `/var/lib/postgresql/data`.
- Database has private networking only; the application uses a Railway `DATABASE_URL` reference.
- Implemented catalogue, pagination, comments, replies, idempotency, owner sessions, deletion, validation, and persistent rate limits. See `BACKEND.md`.
- Owner password was generated and saved in a private local file outside the repository. Only the scrypt hash is configured on Railway.
- Configured variables: `DATABASE_URL`, `NODE_ENV`, `SITE_ORIGIN`, `OWNER_PASSWORD_HASH`, `OWNER_DISPLAY_NAME`, `RATE_LIMIT_SECRET`, `DISCUSSIONS_ENABLED`, `TRUST_RAILWAY_PROXY`.
- At the Run 2 checkpoint, `DISCUSSIONS_ENABLED=false` kept the API closed. Run 3 enabled it after the interface and backups were ready.
- Built-in scheduled volume backups require Pro. The implemented alternative uses daily logical dumps to a private bucket on the current plan. No account upgrade was made.
- Backup service: `database-backups` — `6203795d-532c-47ee-a814-640cf0777e31`; root directory `/backup`; schedule `0 3 * * *` (06:00 Moscow); retention 14 days; no public domain.
- Private bucket: `discussion-backups` — `77c91362-f2e9-4032-a031-d92711250976`, region `sjc`. Credentials are Railway reference variables confined to the backup service.
- First backup verified on 4 September 2026 at 12:26 UTC: `video-education/database/20260904T122641Z-5b9e6d62e01a49968f1a7e08b1754ffe.dump`, 10,638 bytes. Logs confirm archive validation, successful upload, matching stored size, and retention completion. Backup deployment: `194db1b1-6df7-4d08-bf79-7953aec99eaa`.
- Eight integration scenarios passed on Node.js 24.13.0 and PostgreSQL 18.6, including app restarts, concurrent retries, parent discussion checks, owner authorization, CSRF, expiry/logout, validation, rate-limit persistence, and actual server startup on a fresh schema. One Python retention test also passed. The HTML is unchanged.
- Production runtime: Node.js 22.23.2. Verified application revision: `32a6d33d79d93e3ec7966d8f5b6fa06cb530d658`; web deployment: `465f278f-0ff4-4280-bf42-ce462411d262`.
- Production checks: `GET /` returned 200 with an exact match to the published HTML; `/healthz` returned 200 and `ok`; `/api/discussions` returned the expected 503 `discussions_disabled` response.
- The server runs locked, idempotent migrations before listening as well as through the configured pre-deploy hook, so a skipped platform hook cannot leave the schema uninitialized.
- The disposable local test PostgreSQL instance was stopped after verification. It can be started again from the task's `work/run2-postgres` directory if needed.

## Project

- Repository: [SlowMercury/video-education](https://github.com/SlowMercury/video-education)
- Production branch: `main`
- Railway project name: `video-creation`
- Public URL: [Video Education](https://video-education-production.up.railway.app)
- Example library: [Examples](https://video-education-production.up.railway.app/#examples)
- Railway project ID: `7ccc31b8-60f3-4f21-8c72-7228474ffbc9`
- Environment: `production` — `4d7b13f9-409c-4aac-a4f5-0f1e1011e20f`
- Web service: `video-education` — `2c89d6bb-1ed4-43b6-b75a-c408c6e5ba7e`
- Runtime: Node.js, started with `npm start`
- Health endpoint: `/healthz`
- Environment variables: `PORT` is provided by Railway

## Validation

The first application deployment succeeded on 4 September 2026:

- Verified application revision: `8cb46ab7df09377cf253130f311bdf6502812cb8`
- Deployment ID: `c0cdc73d-4f7d-44ab-be2e-bd9ed3968155`
- Railway status: `SUCCESS`
- Public `GET /`: HTTP 200; response exactly matches the published HTML, including all eight lessons.
- Public `GET /healthz`: HTTP 200 with body `ok`.
- Public `GET /server.mjs` and `GET /README.md`: HTTP 404.
- Public `POST /`: HTTP 405.
- Public `HEAD /`: HTTP 200 with no response body.

The HTML scripts and server syntax were also checked locally. Production checks cover delivery of the page and server behavior; they do not verify playback inside X's externally hosted video widgets.

The Run 1 verification above is historical. Consult the Run 3 checkpoint and latest Git history for the current application revision.

## Next step

Start Run 4 from `PLAN.md`: gather feedback from friends, make one complete model lesson from verified source material, document the repeatable process for adding X examples, and perform a full restore drill using a disposable database. Also migrate the deprecated Railway configuration before its reported 1 December 2026 deadline. Ask for missing teaching material or feedback when needed; do not invent a creator's prompts or settings.

## Agreed discussion behavior

Visitors enter a name without signing in. Everyone can read, post immediately, and reply under each lesson or example. The owner can reply with an authenticated badge and delete comments. PostgreSQL and protected owner sessions provide persistence and moderation.

## Maintenance

Follow `BACKEND.md` for local database and environment setup, then use `npm run dev`. Edit the X example catalogue in `index.html` following `README.md`. Deploy changes from `main` and check `/healthz` after deployment. Use the backup service's Cron Runs page and “Run now” for an on-demand backup; successful deployment of the schedule alone does not execute a backup. Keep credentials in Railway variables; record only variable names in project documentation.

For local checks, keep the browser preview database separate from the disposable `_test` database. The Run 3 preview used port 4174 and a local-only owner password. Both the preview server and local PostgreSQL cluster are stopped when verification finishes. No production credentials or raw source messages are committed or included in the source archive.
