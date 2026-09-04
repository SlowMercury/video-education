# Video Education — implementation plan

Updated: 4 September 2026. Status: **Runs 1–3 complete; Run 4 prepared for publication**. The detailed Blender lesson, content workflow, moderation/recovery guides, restore drill, and Railway configuration migration are implemented. Real feedback from friends and a generated result for the practice prompts are still awaited.

Repository: [SlowMercury/video-education](https://github.com/SlowMercury/video-education)

Railway project: **video-creation**.

Live site: [Video Education](https://video-education-production.up.railway.app). The repository's `PROGRESS.md` records the current checkpoint. [Owner login](https://video-education-production.up.railway.app/#owner) is available from the footer.

## Agreed experience

The site teaches people to create videos with AI. It has lessons and a separate library of examples, with a dark design, large videos, and minimal decoration. The existing course remains in Russian. New examples can be added from X post links.

Visitors can read the site and its discussions publicly. To post, they enter a name and a question or comment; registration is unnecessary. Posts appear immediately under the relevant lesson or video example. Everyone can reply.

The owner can reply and delete comments through a protected owner login. Only authenticated owner replies receive an author badge; a visitor's chosen display name does not grant privileges. Owner-only deletion is the implementation assumption for the first version.

## Technical approach

Keep the existing HTML, CSS, JavaScript, and Node.js foundation. One Railway web service serves the website and a small comments API on the same domain. A separate PostgreSQL service stores comments and owner sessions using private networking and a persistent volume. A scheduled service exports a daily PostgreSQL dump to a private Railway bucket at 03:00 UTC, retaining 14 days. This works on the current plan; built-in volume snapshots and PITR are not enabled. See [Railway PostgreSQL](https://docs.railway.com/databases/postgresql) and [backup configuration](https://docs.railway.com/guides/postgres-backups-restores).

X videos continue to use the official embeds, with a link to the original post when the embed is unavailable. Comments on the course are independent of comments on X.

Use stable discussion identifiers: for example, `lesson:idea` and `x:2070145120658137385`. Changing a lesson title or moving a video in the library must preserve its discussion. Lesson and example identifiers are validated against the site's content catalogue.

The backend stores each comment's identifier, discussion identifier, optional parent comment, display name, plain-text message, creation time, owner status, and deletion state. Replies belong to the same discussion as their parent. A deleted parent becomes a placeholder when replies remain, preserving the conversation.

Names are display labels, not verified identities. Remembering a visitor's name in their browser makes returning easier without creating an account. The owner login uses a server-side credential and secure session cookie. Secrets live in deployment variables, while the public repository contains source code and configuration examples.

## Run 1 — publish the existing course

1. Put the website project in the confirmed GitHub repository, preserving any content added there since the initial check.
2. Add this plan and a short progress/runbook file to the project. Publish only website materials and project documentation.
3. Create Railway project `video-creation`, connect its web service to the repository, and deploy the existing course.
4. Generate a public Railway URL and verify the deployment and health endpoint.

**Done when:** the lessons and example library are available at a working public URL, with the deployed commit recorded. This is the initial reading version of the course.

## Run 2 — build persistent discussions and owner access

1. Add PostgreSQL, versioned database migrations, and the stable discussion catalogue.
2. Implement paginated comment reading, comment creation, and replies.
3. Implement owner login, logout, owner replies, and deletion, with server-side authorization.
4. Validate text lengths and discussion identifiers; render messages as text; use parameterized database queries. Add basic posting and login rate limits and protect owner actions against forged requests.
5. Configure persistent storage and scheduled backups before accepting real discussions.

**Done when:** API checks prove that comments survive a restart, replies stay in their discussion, visitors can post without an account, and unauthenticated requests cannot delete comments or impersonate the owner. This backend remains under development until the interface is connected in Run 3.

## Run 3 — connect the interface and launch comments

1. Add a “Question or comment” form under every lesson and each video example: name, message, and submit button.
2. Display discussion threads with reply buttons, dates, and an owner badge on authenticated owner posts.
3. Add empty, loading, submitting, and error states. Preserve the draft on a failed submission and prevent duplicate posts from repeated clicks or retries.
4. Add the owner's login screen and deletion controls, including confirmation before deleting a comment.
5. Deploy the complete discussion feature and verify it using separate visitor and owner sessions.

**Done when:** a friend can submit a question, another visitor can see and reply to it, and the owner can answer or delete it. The full flow works on the public site and comments remain after redeployment. Any verification comments are removed afterward.

## Run 4 — try it with friends and refine the course

1. Review feedback from a small group of friends and fix concrete problems with navigation, posting, replies, and reading discussions on a phone.
2. Make one lesson a complete model: example result, explanation of the steps, known inputs or prompts, common mistakes, and a practical exercise. Request missing source material rather than inventing the creator's settings.
3. Document the repeatable process for adding an X link, a short explanation, and its associated lesson without breaking existing discussions.
4. Document how to moderate, check deployment health, and restore a database backup. Verify a backup can be restored into a disposable database.

**Done when:** the core learning and discussion experience is ready for friends, one lesson establishes the intended teaching format, and future content updates are straightforward.

## How to resume across sessions

At the end of each run, record completed work, validation results, the commit, deployment URL/status, Railway resource identifiers, any outstanding dependency, and the exact next step in the repository's progress file. Record environment variable names, never their secret values.

Useful next instruction: **“Use this feedback to refine the course: …”** Send a generated exercise result with its prompt and settings when available.

## Verified starting point before Run 1

- A local website with eight lessons, a separate example library, and two unique X posts already exists in `outputs/ai-video-guide/`.
- The repository is public and accessible with push permissions. It reported a size of zero during the planning check.
- The Railway connection works. No project named `video-creation` appeared in the project list during the planning check.
- Before Run 1, no repository push, Railway project creation, database creation, or deployment had been performed. Run 1 published the website; Run 2 added the database, API, owner access, and daily backups.
