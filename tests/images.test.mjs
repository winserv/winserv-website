// Incident: the 700 px photos were drawn wider than their files — up to ~896 px on the solution
// pages in one column and ~756 px on every article — and looked soft (Marcelo, 2026-10-13).
// Every built page at desktop and tablet widths; prints only the images drawn upscaled.
// Run after `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { pages, pageFile } from '../src/i18n/routes.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const FILES = pages().map((p) => pageFile(p.path));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

test('no image is drawn wider than its file', async () => {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(DIST, path.endsWith('/') ? path + 'index.html' : path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const big = [];
  let seen = 0;
  let browser;
  try {
    browser = await chromium.launch();
    // 960: the widest one-column layout; 1440: the widest desktop the container allows.
    for (const width of [768, 960, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      for (const f of FILES) {
        await page.goto(base + f, { waitUntil: 'load' });
        const found = await page.evaluate(() => [...document.images]
          .filter((i) => i.complete && i.naturalWidth && i.getClientRects().length && !/\.svg$/.test(i.src))
          // The picture itself, not its border: an article photo has a 1 px border and drew 702 at 700.
          .map((i) => {
            const s = getComputedStyle(i);
            const edges = ['borderLeftWidth', 'borderRightWidth', 'paddingLeft', 'paddingRight'].reduce((n, k) => n + parseFloat(s[k]), 0);
            return { src: i.src.replace(/^.*\/images\//, ''), drawn: i.getBoundingClientRect().width - edges, file: i.naturalWidth };
          }));
        seen += found.length;
        for (const i of found) if (i.drawn > i.file + 0.5) big.push(`${width} ${f}: ${i.src} ${Math.round(i.drawn)} > ${i.file}px`);
      }
      await page.close();
    }
  } finally { await browser?.close(); server.close(); }
  assert.ok(seen > 0, 'measured no image: the gate would pass with every page broken');
  assert.deepEqual(big, []);
});
