# Restore verification — 4 September 2026

The archive from the private Railway bucket was downloaded using authorized storage credentials, held only in process memory. The archive stayed outside the public repository. No production database or comment was modified for this drill.

- Object: `video-education/database/20260904T122641Z-5b9e6d62e01a49968f1a7e08b1754ffe.dump`
- Stored at: 4 September 2026, 12:26:42 UTC.
- Size: 10,638 bytes; download matched storage metadata.
- SHA-256: `dcc2321d61545de1baa84508fe5625aa4b02eb5df9e93d614717687581d2987b`.
- Tools: PostgreSQL 18.6; custom-format restore with `--no-owner --no-privileges --single-transaction --exit-on-error`.

## Actual stored archive

Restored into a new local database. Migration `001_discussions.sql`, eight lessons, and two examples were present. All expected tables and validated constraints were present; reply references and the comment sequence passed checks. There were zero comments, as this archive predates public discussions. That limitation is expected and is not evidence of lost messages.

## Sample-message round trip

After verifying the stored archive, three synthetic messages were added only to the local restored database: a deleted parent, a visitor reply, and an owner reply to that reply. A new local dump was created and restored into a second empty local database.

All rows matched exactly after restoration, including text and line breaks, identifiers, dates, deletion state, reply links, request identifiers, and owner status. Counts: three total, two live, one deleted, two replies, one owner post. The application API read the restored thread and retained the deleted parent placeholder and both reply relationships.

The sample archive was not uploaded to Railway. This validates the schema and data recovery path; it does not replace the daily schedule or a later drill with real student discussions. Production cutover was not performed.

References: [PostgreSQL pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html), [Railway backup workflow](https://docs.railway.com/guides/postgres-backups-restores).
