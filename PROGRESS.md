# Video Education — progress and runbook

Updated: 4 September 2026.

## Current status

**Run 1 is complete. Run 2 is in progress.** PostgreSQL and the comments API are implemented, and seven integration scenarios pass against local PostgreSQL 18. Production deployment verification and a backup decision remain. The public discussion switch is off; the interface will be added in Run 3.

## Run 2 checkpoint

- PostgreSQL 18 service: `b58bcc9a-9273-4988-a16d-c7117b823018` (`Postgres`).
- Persistent volume: `5c3e187c-4e46-4b0a-83d7-308406fdc303`, mounted at `/var/lib/postgresql/data`.
- Database has private networking only; the application uses a Railway `DATABASE_URL` reference.
- Implemented catalogue, pagination, comments, replies, idempotency, owner sessions, deletion, validation, and persistent rate limits. See `BACKEND.md`.
- Owner password was generated and saved in a private local file outside the repository. Only the scrypt hash is configured on Railway.
- Configured variables: `DATABASE_URL`, `NODE_ENV`, `SITE_ORIGIN`, `OWNER_PASSWORD_HASH`, `OWNER_DISPLAY_NAME`, `RATE_LIMIT_SECRET`, `DISCUSSIONS_ENABLED`, `TRUST_RAILWAY_PROXY`.
- `DISCUSSIONS_ENABLED=false` keeps public API use closed until the UI and backups are ready.
- Built-in scheduled backups are unavailable on the current Railway plan. The API returned `OAUTH_INSUFFICIENT_GRANT`; the signed-in dashboard explicitly says backups require Pro. The owner has been asked to choose separate scheduled database dumps in private storage or a Pro upgrade. No plan upgrade or additional backup service has been created.
- Seven integration scenarios passed on Node.js 24.13.0 and PostgreSQL 18.6, including app restarts, concurrent retries, parent discussion checks, owner authorization, CSRF, expiry/logout, validation, and rate-limit persistence. The HTML is unchanged.

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

Finish Run 2: verify the deployed backend and configure the selected backup approach. Then start Run 3: build the public discussion interface and protected owner login screen, verify them, and enable `DISCUSSIONS_ENABLED`. Keep the switch off until backups are configured.

## Agreed discussion behavior

Visitors enter a name without signing in. Everyone can read, post immediately, and reply under each lesson or example. The owner can reply with an authenticated badge and delete comments. The backend will use PostgreSQL and protected owner sessions.

## Maintenance

Start locally with `npm start`. Edit the X example catalogue in `index.html` following `README.md`. Deploy changes from `main` and check `/healthz` after deployment. Keep credentials in Railway variables; record only variable names in project documentation.
