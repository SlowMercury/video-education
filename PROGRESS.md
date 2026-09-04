# Video Education — progress and runbook

Updated: 4 September 2026.

## Current status

**Runs 1–3 are complete; Run 4 implementation is live.** The detailed Blender lesson, stable example links, content and operations guides, actual backup restore, sample-data round trip, and Railway IaC migration are verified. Nine integration scenarios pass. The pilot/feedback portion remains open: no real feedback from friends has been received, and the new practice prompts have not yet been tested in a video generator.

## Run 4 work

- Expanded lesson 05 using the existing Reid Hannaford example, with an inline official X embed, an original six-second practice scene, first-frame and video prompt examples, evaluation criteria, and troubleshooting.
- Clearly distinguished the creator's confirmed workflow from the original practice prompts. No creator prompt, Blender file, generation settings, or tested exercise result was invented.
- Added stable `#example-POST_ID` links; retained the two original numbered anchors. The eight lesson and two video discussion IDs are unchanged.
- Added `CONTENT.md`, `OPERATIONS.md`, `FEEDBACK.md`, `npm run check:content`, and a local-only read-only `npm run check:restore` verifier.
- Restored the actual 10,638-byte private backup into a new local PostgreSQL database. Eight lessons, two examples, schema, constraints, and sequences verified. It contains zero comments because it predates their public launch.
- A separate local dump/restore with a deleted parent, visitor reply, and owner reply preserved every row exactly and passed application API reading. See `backup/RESTORE-CHECK.md`. No production messages were modified or created for these checks.
- Imported the full existing Railway environment into `.railway/railway.ts`, preserving secrets with `preserve()`. Removed legacy `railway.json`; pinned the Railway SDK as a development dependency. CLI apply succeeded and a subsequent plan reported the configuration up to date, without resource deletions or variable changes.
- Browser checks: inline video rendered, two lesson prompt blocks visible, ten discussion mounts, mobile layout without horizontal overflow, library view and stable/legacy anchors present. Nine backend integration scenarios and the content check pass.
- Verified application revision: `a9d0ba687f9531777e95700f90189307d9bb572e`.
- Web deployment: `ee6e9368-be55-4991-95a8-4a913f3e4452`, `SUCCESS`; backup service deployment: `1dca5535-9c57-44ce-ab48-2708b25409e4`, `SUCCESS`. PostgreSQL was not redeployed.
- Public checks passed: exact new HTML, `/healthz` returned `ok`, all ten discussions remain available, and `.railway/railway.ts` is not exposed by the web server. The CLI plan reports that infrastructure configuration is up to date.
- The next commit records this checkpoint only; application source remains the verified revision above.
- Remaining content/pilot work: receive real friend feedback and the actual result/inputs from the practice exercise. Questions were asked; no answers have arrived yet. Do not describe the pilot or generated-prompt validation as completed.

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
- At the Run 3 checkpoint, application source matched the verified revision above and Run 4 had not started. The current revision is recorded in the Run 4 section.

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

Collect feedback using `FEEDBACK.md`. Ask the user for actual student observations and, when available, the practice video's first frame, reference, exact prompt, model/mode, and result. Refine concrete issues and turn the exercise into a verified result walkthrough. Do not repeat the completed backup restore or configuration migration without a new reason.

## Agreed discussion behavior

Visitors enter a name without signing in. Everyone can read, post immediately, and reply under each lesson or example. The owner can reply with an authenticated badge and delete comments. PostgreSQL and protected owner sessions provide persistence and moderation.

## Maintenance

Follow `BACKEND.md` for local database and environment setup, then use `npm run dev`. Edit the X example catalogue in `index.html` following `README.md`. Deploy changes from `main` and check `/healthz` after deployment. Use the backup service's Cron Runs page and “Run now” for an on-demand backup; successful deployment of the schedule alone does not execute a backup. Keep credentials in Railway variables; record only variable names in project documentation.

For local checks, keep the browser preview database separate from the disposable `_test` database. The Run 3 preview used port 4174 and a local-only owner password. Both the preview server and local PostgreSQL cluster are stopped when verification finishes. No production credentials or raw source messages are committed or included in the source archive.

## Video-only examples — 2026-09-04

Replaced full X post widgets with native video players in the library and lesson preview at the owner’s request. The catalogue now holds verified remote MP4 URLs, posters, and aspect ratios; author credits, source links, and discussion IDs are preserved. No media is copied to our server. Content checks, JavaScript parsing, and HEAD requests for both videos and posters passed. X media URLs may need refreshing if the upstream source changes.

## Playback fix — 2026-09-04

Reproduced native-player failure: X returned 403 to video GET/range requests carrying the course Referer, although HEAD returned 200. The same public media returned 206 without a cross-origin Referer. Set the page and server referrer policy to `same-origin`; source attribution remains visible. Local browser playback reached readyState 4 and advancing currentTime. Future video checks must include actual playback, not HEAD alone.
