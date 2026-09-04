import { createApp } from './src/app.mjs';
import { loadConfig } from './src/config.mjs';
import { cleanup, createPool, migrate } from './src/db.mjs';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
// Keep startup safe even when a host skips its optional pre-deploy hook.
await migrate(pool);
await cleanup(pool);
const server = createApp({ pool, config });
const timer = setInterval(() => cleanup(pool).catch(error => console.error('Database cleanup failed', error.code)), 3600000);
timer.unref();
server.listen(config.port, '0.0.0.0', () => console.log(`Website listening on port ${config.port}`));
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => { await pool.end(); process.exit(0); });
});
