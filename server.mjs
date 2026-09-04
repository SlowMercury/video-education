import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const pagePath = new URL('./index.html', import.meta.url);
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = createServer(async (request, response) => {
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
  let path;
  try { path = new URL(request.url, 'http://localhost').pathname; }
  catch { response.writeHead(400, headers); response.end('Bad request'); return; }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); response.end(); return;
  }
  if (path === '/healthz') {
    response.writeHead(200, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : 'ok'); return;
  }
  if (path !== '/' && path !== '/index.html') {
    response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : 'Not found'); return;
  }
  try {
    const html = await readFile(pagePath);
    response.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Length': html.length });
    response.end(request.method === 'HEAD' ? undefined : html);
  } catch {
    response.writeHead(500, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Unable to load page');
  }
});
server.listen(port, '0.0.0.0', () => console.log(`Preview: http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
