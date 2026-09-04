# Video Education — progress and runbook

Updated: 4 September 2026.

## Current status

**Run 1 is complete.** The public site has eight lessons and a separate library with two unique X examples. Runs 2–4 have not started; comments and the database will be added in those runs.

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

Start Run 2 in `PLAN.md`: add PostgreSQL, database migrations, the discussion catalogue, comments/replies API, and protected owner access. Configure scheduled backups before accepting real comments. No unresolved dependency blocks starting this run.

## Agreed discussion behavior

Visitors enter a name without signing in. Everyone can read, post immediately, and reply under each lesson or example. The owner can reply with an authenticated badge and delete comments. The backend will use PostgreSQL and protected owner sessions.

## Maintenance

Start locally with `npm start`. Edit the X example catalogue in `index.html` following `README.md`. Deploy changes from `main` and check `/healthz` after deployment. Keep credentials in Railway variables; record only variable names in project documentation.
