import pg from 'pg';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { loadCatalogue } from './catalogue.mjs';

export function createPool(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  pool.on('error', error => console.error('Database connection error', error.code || 'unavailable'));
  return pool;
}

export async function transaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function migrate(pool) {
  const catalogue = await loadCatalogue();
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(file => /^\d+_.+\.sql$/.test(file)).sort();
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(742690411)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const file of files) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [file]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
    }
    await client.query('UPDATE discussion_items SET active = false');
    for (const item of catalogue) {
      await client.query(`INSERT INTO discussion_items (id, kind, title, source_url) VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, source_url = EXCLUDED.source_url, active = true`,
      [item.id, item.kind, item.title, item.sourceUrl]);
    }
  });
}

export async function cleanup(pool) {
  await pool.query('DELETE FROM owner_sessions WHERE expires_at < now()');
  await pool.query('DELETE FROM rate_limits WHERE expires_at < now()');
}
