import assert from 'node:assert/strict';
import { createPool } from '../src/db.mjs';

// Deliberately limited to local restore drills; never point this at the live service.
const raw = process.env.RESTORE_DATABASE_URL;
if (!raw) throw new Error('Set RESTORE_DATABASE_URL to a local database ending in _restore_test.');
const target = new URL(raw);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_restore_test') || target.search || target.hash) {
  throw new Error('Only a local disposable database ending in _restore_test is allowed.');
}
const pool = createPool(raw);
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows.map(row => row.tablename);
    for (const name of ['comments', 'discussion_items', 'owner_sessions', 'rate_limits', 'schema_migrations']) assert.ok(tables.includes(name), `Missing table: ${name}`);
    const migrations = (await client.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row => row.version);
    assert.ok(migrations.length > 0, 'No migration history restored');
    const catalogue = (await client.query('SELECT kind, count(*)::integer AS count FROM discussion_items GROUP BY kind ORDER BY kind')).rows;
    assert.ok(catalogue.some(row => row.kind === 'lesson' && row.count > 0), 'No lesson catalogue restored');
    const comments = (await client.query(`SELECT count(*)::integer AS total,
      count(*) FILTER (WHERE deleted_at IS NULL)::integer AS live,
      count(*) FILTER (WHERE deleted_at IS NOT NULL)::integer AS deleted,
      count(*) FILTER (WHERE parent_id IS NOT NULL)::integer AS replies,
      count(*) FILTER (WHERE is_owner)::integer AS owner_posts FROM comments`)).rows[0];
    const broken = (await client.query(`SELECT count(*)::integer AS count FROM comments c
      LEFT JOIN discussion_items d ON d.id = c.discussion_id
      LEFT JOIN comments p ON p.id = c.parent_id
      WHERE d.id IS NULL OR (c.parent_id IS NOT NULL AND (p.id IS NULL OR p.discussion_id <> c.discussion_id))`)).rows[0].count;
    assert.equal(broken, 0, 'Broken discussion/reply references');
    const sequence = (await client.query('SELECT last_value FROM comments_sequence_seq')).rows[0].last_value;
    const maximum = (await client.query('SELECT COALESCE(max(sequence), 0) AS maximum FROM comments')).rows[0].maximum;
    assert.ok(BigInt(sequence) >= BigInt(maximum), 'Comment sequence would reuse an existing value');
    const invalidConstraints = (await client.query("SELECT count(*)::integer AS count FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated")).rows[0].count;
    assert.equal(invalidConstraints, 0, 'Unvalidated constraints');
    await client.query('COMMIT');
    console.log(JSON.stringify({ database: target.pathname.slice(1), migrations, catalogue, comments, brokenReferences: broken, constraintsValid: true, sequenceValid: true }, null, 2));
  } finally { client.release(); }
} finally { await pool.end(); }
