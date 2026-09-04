# Railway configuration

`.railway/railway.ts` describes the complete `video-creation` environment: the website, backup job, PostgreSQL, persistent volume, and private bucket. The TypeScript SDK is pinned as a development dependency; install with `npm ci`.

Link the CLI to the existing project and production environment, then review and apply:

```sh
railway config plan
railway config apply
```

`plan` is read-only. Review the exact resource changes before `apply`; an omitted resource can become a deletion. Keep the complete resource list and existing names. Do not add a partial export for this repository.

Imported variables use `preserve()` so credentials and reference values remain in Railway. Do not import with `--include-variables` into this public repository. Do not edit the generated volume or database settings merely to reformat the file.

Infrastructure changes require the CLI apply step; pushing this file alone does not apply them. Website code continues to deploy automatically from `main`. The legacy `railway.json` has been removed. Migration preserves the existing configuration, including three restart retries.

See [OPERATIONS.md](../OPERATIONS.md) and the [Railway IaC documentation](https://docs.railway.com/infrastructure-as-code).
