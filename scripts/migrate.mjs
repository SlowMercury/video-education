import { createPool, migrate } from '../src/db.mjs';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = createPool(process.env.DATABASE_URL);
try { await migrate(pool); console.log('Database migrations and discussion catalogue are up to date.'); }
finally { await pool.end(); }
