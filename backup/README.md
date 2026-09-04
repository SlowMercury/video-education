# Daily private database backups

This service runs a PostgreSQL 18 custom-format dump at 03:00 UTC each day (06:00 Moscow time). It uploads to the private `discussion-backups` Railway bucket and retains 14 days of this job's archives. It exits after each run, and has no public domain. The regular Railway account plan is unchanged.

Required variables are `DATABASE_URL`, `BUCKET`, `ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION`. These use reference variables to the project's PostgreSQL service and private bucket. `RETENTION_DAYS` defaults to 14.

The job checks the archive with `pg_restore --list`, verifies the uploaded object size, then removes only expired objects matching its own filename pattern. Failed dumps or uploads never trigger retention cleanup. Runtime failures are recorded in Railway deployment logs.

Check the latest `database-backups` execution in Railway and look for “Backup complete”. A successful job is expected to exit, so it need not remain online between scheduled runs. The bucket's Files tab also shows the dated `.dump` objects.

## Restore drill

Download the chosen `.dump` from the private bucket using authenticated access. Keep it outside the public source directory with access limited to your local user. Use PostgreSQL tools that can read the dump's version (the current job uses PostgreSQL 18).

Create a new, empty local database. This example uses port 5432; replace it with your local instance's port. The name must end in `_restore_test` for the verifier:

```sh
createdb -h 127.0.0.1 -p 5432 video_education_restore_test
pg_restore --no-owner --no-privileges --single-transaction --exit-on-error --dbname=postgresql://127.0.0.1:5432/video_education_restore_test /absolute/private/path/database.dump
RESTORE_DATABASE_URL=postgresql://127.0.0.1:5432/video_education_restore_test npm run check:restore
```

Run the verifier from the repository root. It reads migration history, catalogue and comment counts, reply/discussion references, constraints, and the comment sequence. It refuses nonlocal databases, prints counts rather than message contents, and does not change the restored database. Do not use `--clean` or `--create` against the live database for a drill.

Compare counts with what existed at the backup time, not with the current website. Check representative threads through a local application before planning a production switch. A backup taken before discussions opened can correctly contain zero comments.

The actual archive restore and a separate sample-message round trip passed on 4 September 2026; see [RESTORE-CHECK.md](RESTORE-CHECK.md). Production recovery and owner-session revocation are described in [OPERATIONS.md](../OPERATIONS.md).

These are daily logical backups, so recovery may lose changes made since the last successful daily run. Keep separate off-provider copies if the course later requires recovery from loss of the entire Railway account. Object storage and short backup executions incur usage charges under the current plan; no plan upgrade is required.

Run the retention boundary test with `python3 -m unittest discover -s backup -p 'test_*.py'` from the project root.

References: [Railway's scheduled dump workflow](https://docs.railway.com/guides/postgres-backups-restores), [private buckets](https://docs.railway.com/storage-buckets), and [bucket billing](https://docs.railway.com/storage-buckets/billing).
