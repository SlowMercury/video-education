# Daily private database backups

This service runs a PostgreSQL 18 custom-format dump at 03:00 UTC each day (06:00 Moscow time). It uploads to the private `discussion-backups` Railway bucket and retains 14 days of this job's archives. It exits after each run, and has no public domain. The regular Railway account plan is unchanged.

Required variables are `DATABASE_URL`, `BUCKET`, `ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION`. These use reference variables to the project's PostgreSQL service and private bucket. `RETENTION_DAYS` defaults to 14.

The job checks the archive with `pg_restore --list`, verifies the uploaded object size, then removes only expired objects matching its own filename pattern. Failed dumps or uploads never trigger retention cleanup. Runtime failures are recorded in Railway deployment logs.

Check the latest `database-backups` execution in Railway and look for “Backup complete”. A successful job is expected to exit, so it need not remain online between scheduled runs. The bucket's Files tab also shows the dated `.dump` objects.

To restore, download a selected dump using authenticated bucket access. Restore into a new disposable database first with `pg_restore --no-owner --no-privileges --exit-on-error --dbname=<restore-database> <dump-file>`. Verify its catalogue, comment count, and sample discussions before planning a production restore. A full restore drill is scheduled for Run 4.

These are daily logical backups, so recovery may lose changes made since the last successful daily run. Keep separate off-provider copies if the course later requires recovery from loss of the entire Railway account. Object storage and short backup executions incur usage charges under the current plan; no plan upgrade is required.

Run the retention boundary test with `python3 -m unittest discover -s backup -p 'test_*.py'` from the project root.

References: [Railway's scheduled dump workflow](https://docs.railway.com/guides/postgres-backups-restores), [private buckets](https://docs.railway.com/storage-buckets), and [bucket billing](https://docs.railway.com/storage-buckets/billing).
