import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCatalogue } from '../src/catalogue.mjs';

const items = await loadCatalogue();
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const examples = JSON.parse(html.match(/<script id="x-examples" type="application\/json">([\s\S]*?)<\/script>/)[1]);
for (const example of examples) {
  for (const key of ['title', 'author', 'watchFor', 'practice']) {
    assert.ok(typeof example[key] === 'string' && example[key].trim(), `Example is missing ${key}`);
  }
  assert.ok(example.video, `Example is missing video: ${example.url}`);
  for (const [key, host] of [['src', 'video.twimg.com'], ['poster', 'pbs.twimg.com']]) {
    const url = new URL(example.video[key]);
    assert.ok(url.protocol === 'https:' && url.hostname === host && !url.username && !url.password && !url.port, `Invalid video ${key}: ${example.url}`);
    if (key === 'src') assert.ok(url.pathname.endsWith('.mp4'), 'Video must use an MP4 source');
  }
  for (const key of ['width', 'height']) {
    assert.ok(Number.isFinite(example.video[key]) && example.video[key] > 0, `Invalid video ${key}`);
  }
}
for (const [, id] of html.matchAll(/data-example-preview="(\d+)"/g)) {
  assert.ok(items.some(item => item.id === `x:${id}`), `Lesson preview references a missing X example: ${id}`);
}
console.log(`Content valid: ${items.filter(item => item.kind === 'lesson').length} lessons, ${examples.length} unique X examples. Discussion identifiers are valid.`);
