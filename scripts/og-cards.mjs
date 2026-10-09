// Share cards per language (spec sub-project 3 §5). The published card public/images/og.jpg has
// no source file in the repo (the untracked og.html renders a different layout — measured
// 2026-10-08), so the cards start from og.jpg itself: the band with the tagline and the strip is
// erased (each column interpolated between rows 452 and 578, which carry no text) and the
// language's text is drawn with the parameters below, fitted to og.jpg. The font is the Mac's
// Helvetica, not the site's Plus Jakarta Sans: og.jpg was rendered with a system fallback (its
// 'g' and 'a' match Helvetica; measured by fit, 2026-10-08), so this script runs on macOS.
// CONTROL FIRST: redrawing the Portuguese text must reproduce og.jpg. Measured 0.53 % of pixels
// on 2026-10-08, all on the glyphs' edges, after ruling out font, JPEG and scale as the cause;
// Marcelo accepted the cards by eye and the limit was set to 0.6 %. A wrong font or position
// measured 1–11 %: above the limit the drawing is wrong — stop, never raise it to pass.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const TYPES = { '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const TEXT = {
  'pt-br': { tagline: 'Tecnologia da Informação', services: 'MICROSOFT · IA · INFRAESTRUTURA' },
  en: { tagline: 'Information Technology', services: 'MICROSOFT · AI · INFRASTRUCTURE' },
  es: { tagline: 'Tecnología de la Información', services: 'MICROSOFT · IA · INFRAESTRUCTURA' },
};
// Fitted to og.jpg (2026-10-08); the control below is what proves them.
const STYLE = {
  tagline: { weight: 400, size: 37.75, y: 497, ls: 1.25, color: '#6B7A99' },
  services: { weight: 600, size: 25, y: 564, ls: 3.25, color: '#3E7BFA' },
};
const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0"><canvas id="c" width="1200" height="630"></canvas></body></html>`;

const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/__card.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  try { const body = await readFile(join(PUBLIC, url)); res.writeHead(200, { 'Content-Type': TYPES[extname(url)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

// Returns the card as a PNG buffer: og.jpg, band erased, `text` drawn with STYLE.
async function card(text) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/__card.html`);
  await page.evaluate(async ({ text, style }) => {
    const img = new Image(); img.src = '/images/og.jpg'; await img.decode();
    const W = 1200, H = 630, A = 452, B = 578;
    const ctx = document.getElementById('c').getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H); const p = d.data;
    // Edge colours: mean of 6 rows beside the band and of 7 columns around x. One row alone
    // carries JPEG noise, and interpolating it drew vertical streaks across the band (seen 2026-10-08).
    const edge = (y0, x, k) => { let s = 0, n = 0; for (let y = y0; y < y0 + 6; y++) for (let dx = -3; dx <= 3; dx++) { const xx = Math.min(W - 1, Math.max(0, x + dx)); s += p[(y * W + xx) * 4 + k]; n++; } return s / n; };
    const top = [], bot = [];
    for (let x = 0; x < W; x++) { top[x] = [0, 1, 2].map((k) => edge(A - 5, x, k)); bot[x] = [0, 1, 2].map((k) => edge(B, x, k)); }
    for (let x = 0; x < W; x++) for (let y = A + 1; y < B; y++) {
      const t = (y - A) / (B - A);
      for (let k = 0; k < 3; k++) p[(y * W + x) * 4 + k] = Math.round(top[x][k] * (1 - t) + bot[x][k] * t);
    }
    ctx.putImageData(d, 0, 0);
    for (const key of ['tagline', 'services']) {
      const o = style[key];
      ctx.font = `${o.weight} ${o.size}px Helvetica`; ctx.fillStyle = o.color;
      if (!ctx.font.includes('Helvetica')) throw new Error('Helvetica not available — run on macOS');
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = `${o.ls}px`;
      ctx.fillText(text[key], 600 + o.ls / 2, o.y);   // letter-spacing trails the last glyph; recentre
    }
  }, { text, style: STYLE });
  const png = await page.locator('#c').screenshot({ type: 'png' });
  await page.close();
  return png;
}

async function decode(jpeg) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${jpeg.toString('base64')}" style="display:block">`);
  const png = await page.locator('img').screenshot({ type: 'png' });
  await page.close();
  return png;
}

// The card as it is published: a JPEG at quality 90, like og.jpg.
async function jpeg(png) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0"><img src="data:image/png;base64,${png.toString('base64')}" style="display:block">`);
  const out = await page.locator('img').screenshot({ type: 'jpeg', quality: 90 });
  await page.close();
  return out;
}

const reference = PNG.sync.read(await decode(await readFile(join(PUBLIC, 'images/og.jpg'))));
const control = PNG.sync.read(await card(TEXT['pt-br']));
const diff = pixelmatch(reference.data, control.data, null, 1200, 630, { threshold: 0.1 });
const share = diff / (1200 * 630);
console.log(`control: ${diff} px differ (${(share * 100).toFixed(2)} %)`);
if (share > 0.006) {
  console.error('control above 0.6 % — fix the drawing before trusting a card');
  await browser.close(); server.close(); process.exit(1);
}

for (const locale of ['en', 'es']) {
  await writeFile(join(PUBLIC, `images/og/${locale}.jpg`), await jpeg(await card(TEXT[locale])));
  console.log(`wrote public/images/og/${locale}.jpg`);
}
await browser.close();
server.close();
