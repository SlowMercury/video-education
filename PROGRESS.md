# Video Education — progress and runbook

Updated: 4 September 2026.

## Current status

Run 1 is in progress: publish the existing course. The site has eight lessons and a separate library with two unique X examples. Runs 2–4 have not started.

## Project

- Repository: [SlowMercury/video-education](https://github.com/SlowMercury/video-education)
- Production branch: `main`
- Railway project name: `video-creation`
- Public URL: pending deployment
- Runtime: Node.js, started with `npm start`
- Health endpoint: `/healthz`
- Environment variables: `PORT` is provided by Railway

## Validation

The HTML scripts and server syntax have been checked. The local server serves the course and health endpoint, rejects unsupported methods, and does not expose project documentation or server source. Production verification is pending.

## Next step

Complete the first deployment and record its URL, identifiers, verified application revision, and validation results here. Then start Run 2 in `PLAN.md`: persistent discussions and protected owner access.

## Agreed discussion behavior

Visitors enter a name without signing in. Everyone can read, post immediately, and reply under each lesson or example. The owner can reply with an authenticated badge and delete comments. The backend will use PostgreSQL and protected owner sessions.

## Maintenance

Start locally with `npm start`. Edit the X example catalogue in `index.html` following `README.md`. Deploy changes from `main` and check `/healthz` after deployment. Keep credentials in Railway variables; record only variable names in project documentation.
