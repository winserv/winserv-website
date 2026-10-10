// Share cards (spec 2026-10-10 §4): one template, the site's own CSS and fonts, Playwright.
// Text comes from the built pages (og:title / og:description / og:url), so a card never says
// something its page does not. Run after `npm run build`: node scripts/share-cards/render.mjs
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parse } from 'node-html-parser';
import { OG_STAMP } from '../../src/i18n/routes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HERE = join(ROOT, 'scripts/share-cards');
const LOCALES = ['pt-br', 'en', 'es'];
const home = (l, page) => join(ROOT, 'dist', l === 'pt-br' ? page : `${l}/${page}`);
// [built page, output path without extension, width, height, type]
const JOBS = LOCALES.flatMap((l) => [
  [home(l, 'index.html'), `public/images/og/${OG_STAMP}/${l}`, 1200, 630, 'jpeg'],
  ...[['og-cover', 1200, 630], ['og-portrait', 1080, 1350], ['og-square', 1080, 1080], ['og-story', 1080, 1920]]
    .map(([n, w, h]) => [home(l, 'wifi/index.html'), `public/images/wifi/og/${OG_STAMP}/${l}/${n}`, w, h, 'png']),
]);
// The wordmark already says WINSERV: drop it from the title; a product name ("Winserv WiFi")
// becomes the eyebrow instead.
function split(title) {
  const parts = title.split(' — ');
  const brand = parts.filter((p) => /^winserv\b/i.test(p));
  return { title: parts.filter((p) => !brand.includes(p)).join(' — '), eyebrow: brand.find((p) => p !== 'WINSERV') ?? '' };
}

const TYPES = { '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const file = p === '/card.html' || p === '/share-card.css' ? join(HERE, p) : join(ROOT, 'public', p);
  try { res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch();
  for (const [built, out, w, h, type] of JOBS) {
    const doc = parse(await readFile(built, 'utf8'));
    const meta = (n) => doc.querySelector(`meta[property="${n}"]`)?.getAttribute('content') ?? '';
    const { title, eyebrow } = split(meta('og:title'));
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/card.html`, { waitUntil: 'networkidle' });
    await page.evaluate(([e, t, s, u]) => {
      const $ = (id) => document.getElementById(id);
      $('eyebrow').textContent = e; $('title').textContent = t; $('sub').textContent = s; $('url').textContent = u;
    }, [eyebrow, title, meta('og:description'), meta('og:url').replace(/^https:\/\//, '').replace(/\/$/, '')]);
    await page.evaluate(() => document.fonts.ready);
    // A card whose text runs past the bottom is a broken card: stop rather than publish it.
    const spill = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().bottom - innerHeight);
    if (spill > 0) throw new Error(`${out}: text runs ${Math.ceil(spill)} px past the card`);
    const path = `${out}.${type === 'jpeg' ? 'jpg' : 'png'}`;
    await mkdir(dirname(join(ROOT, path)), { recursive: true });
    await page.screenshot({ path: join(ROOT, path), type, ...(type === 'jpeg' ? { quality: 90 } : {}) });
    await page.close();
    console.log(path);
  }
} finally { await browser?.close(); server.close(); }
