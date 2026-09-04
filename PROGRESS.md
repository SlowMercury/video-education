# Video Education — progress and runbook

Updated: 4 September 2026.

## Current status

**Runs 1 and 2 are complete.** PostgreSQL and the comments API are deployed. Eight integration scenarios and the backup retention test pass. The first private backup completed successfully. The public discussion switch is off; the interface will be added in Run 3.

## Run 2 checkpoint

- PostgreSQL 18 service: `b58bcc9a-9273-4988-a16d-c7117b823018` (`Postgres`).
- Persistent volume: `5c3e187c-4e46-4b0a-83d7-308406fdc303`, mounted at `/var/lib/postgresql/data`.
- Database has private networking only; the application uses a Railway `DATABASE_URL` reference.
- Implemented catalogue, pagination, comments, replies, idempotency, owner sessions, deletion, validation, and persistent rate limits. See `BACKEND.md`.
- Owner password was generated and saved in a private local file outside the repository. Only the scrypt hash is configured on Railway.
- Configured variables: `DATABASE_URL`, `NODE_ENV`, `SITE_ORIGIN`, `OWNER_PASSWORD_HASH`, `OWNER_DISPLAY_NAME`, `RATE_LIMIT_SECRET`, `DISCUSSIONS_ENABLED`, `TRUST_RAILWAY_PROXY`.
- `DISCUSSIONS_ENABLED=false` keeps public API use closed until the UI and backups are ready.
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

The commit containing this checkpoint changes documentation only; the application source is identical to the verified revision above. Consult the latest Git history and Railway deployment status when resuming.

## Next step

Start Run 3: build the public discussion interface and protected owner login screen using `BACKEND.md`. Verify posting, replying, deletion, error states, and mobile layout, then enable `DISCUSSIONS_ENABLED`. Backups are already configured. The owner credential is saved locally outside the public repository for use in this run.

## Agreed discussion behavior

Visitors enter a name without signing in. Everyone can read, post immediately, and reply under each lesson or example. The owner can reply with an authenticated badge and delete comments. The backend will use PostgreSQL and protected owner sessions.

## Maintenance

Follow `BACKEND.md` for local database and environment setup, then use `npm run dev`. Edit the X example catalogue in `index.html` following `README.md`. Deploy changes from `main` and check `/healthz` after deployment. Use the backup service's Cron Runs page and “Run now” for an on-demand backup; successful deployment of the schedule alone does not execute a backup. Keep credentials in Railway variables; record only variable names in project documentation.

In Run 4, perform the full restore drill and migrate the deprecated Railway config file before its reported 1 December 2026 support deadline. The Run 2 checkpoint is followed by a documentation-only commit; the verified runtime source remains the revision listed above.
