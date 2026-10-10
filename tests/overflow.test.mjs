// Incident: /wifi/privacidade.html scrolled 16 px sideways at 390 px with no sign it did
// (go-live 29, 2026-10-09). Every built page, at 390 px and at 360 px (common Android width: review
// 2026-10-10 found a 3 px scroll there that 390 missed); prints only the pages that overflow.
// Run after `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { pages, pageFile } from '../src/i18n/routes.mjs';

// Not imported from site.test.mjs: under node:test, importing a test file registers its tests again.
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const FILES = pages().map((p) => pageFile(p.path));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

test('no page scrolls sideways at 360 or 390 px', async () => {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(DIST, path.endsWith('/') ? path + 'index.html' : path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  // listen() is asynchronous: address() is null until it has bound.
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const wide = [];
  let browser;
  try {
    browser = await chromium.launch();
    for (const width of [360, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      for (const f of FILES) {
        await page.goto(base + f, { waitUntil: 'load' });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        // A scroll container narrower than its content is the same defect, just hidden.
        const inner = await page.evaluate(() => [...document.querySelectorAll('*')]
          .filter((e) => getComputedStyle(e).overflowX === 'auto' && e.scrollWidth > e.clientWidth + 1)
          .map((e) => `${e.className || e.tagName} +${e.scrollWidth - e.clientWidth}px`));
        if (over > 0 || inner.length) wide.push(`${width} ${f}: page +${over}px ${inner.join(' ')}`);
      }
      await page.close();
    }
  } finally { await browser?.close(); server.close(); }
  assert.deepEqual(wide, []);
});
