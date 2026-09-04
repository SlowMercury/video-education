import { readFile } from 'node:fs/promises';

// The published HTML remains the source of truth until the content editor is added.
export async function loadCatalogue() {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const items = [];
  for (const match of html.matchAll(/<section class="lesson" id="([a-z-]+)"><div class="lesson-top"><span class="chapter-number">\d+<\/span>[\s\S]*?<h2>([^<]+)<\/h2>/g)) {
    items.push({ id: `lesson:${match[1]}`, kind: 'lesson', title: match[2], sourceUrl: null });
  }
  const embedded = html.match(/<script id="x-examples" type="application\/json">([\s\S]*?)<\/script>/);
  if (!items.length || !embedded) throw new Error('Course catalogue is missing');
  for (const example of JSON.parse(embedded[1])) {
    const url = new URL(example.url);
    const match = url.pathname.match(/^\/(?:[A-Za-z0-9_]{1,15}\/status|i\/status|i\/web\/status)\/(\d+)\/?$/);
    if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) || !match || url.username || url.password || url.port) {
      throw new Error('Invalid example URL');
    }
    if (!items.some(item => item.id === `lesson:${example.lesson}`)) throw new Error('Example references an unknown lesson');
    items.push({ id: `x:${match[1]}`, kind: 'example', title: example.title, sourceUrl: example.url });
  }
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate discussion identifier');
  return items;
}
