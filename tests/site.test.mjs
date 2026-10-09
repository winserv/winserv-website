// Gates over the built site — spec 2026-10-08-winserv-site-astro-design §6, site CI row.
// Run after `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { pages, noindex, pageFile, href } from '../src/i18n/routes.mjs';

export const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
export const ORIGIN = 'https://www.winserv.com.br';
// From the table (spec sub-project 3 §3): the lists that were written here by hand.
export const PAGES = pages().filter((p) => !noindex(p.key)).map((p) => pageFile(p.path));
export const ERROR_PAGES = pages().filter((p) => noindex(p.key)).map((p) => pageFile(p.path));
const LOCALE_OF = Object.fromEntries(pages().map((p) => [pageFile(p.path), p.locale]));

assert.ok(existsSync(DIST), 'dist/ missing — run `npm run build` first');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const FILES = walk(DIST).map((p) => relative(DIST, p));
const HTML = FILES.filter((f) => f.endsWith('.html'));
const read = (f) => readFileSync(join(DIST, f), 'utf8');

test('every page builds at its old path', () => {
  for (const f of [...PAGES, ...ERROR_PAGES]) assert.ok(HTML.includes(f), `missing ${f}`);
});

test('the static files survive byte for byte', () => {
  for (const f of ['style.css', 'BingSiteAuth.xml', 'googlecc9795c73ab262d5.html',
    'googlehostedservice.html', '.well-known/winserv-license/sagres-validation.json',
    'images/og.jpg', 'images/og/pt-br.jpg', 'fonts/plus-jakarta-sans-400.woff2',
    'images/wifi/og/pt-br/og-cover.png']) {
    assert.ok(FILES.includes(f), `missing ${f}`);
  }
});

test('every page carries the shared script and no other inline code', () => {
  for (const f of [...PAGES, ...ERROR_PAGES]) {
    const srcs = parse(read(f)).querySelectorAll('script[src]').map((s) => s.getAttribute('src'));
    assert.ok(srcs.includes('/js/site.js'), `${f}: no /js/site.js`);
  }
});

test('the WiFi tab has its badge on the desktop nav only', () => {
  for (const f of [...PAGES, ...ERROR_PAGES]) {
    const root = parse(read(f));
    assert.equal(root.querySelectorAll('.nav-links .nav-new').length, 1, f);
    assert.equal(root.querySelectorAll('#mobile-menu .nav-new, .site-footer .nav-new').length, 0, f);
  }
});

const APEX = /https?:\/\/winserv\.com\.br(?![\w.-])/;
// Published HTML that is not a page: error documents and search-engine verification files.
const NOT_IN_SITEMAP = [...ERROR_PAGES, 'googlecc9795c73ab262d5.html', 'googlehostedservice.html'];

function resolveSameSite(url, from) {
  let u = url.trim();
  if (/^(mailto:|tel:|data:|#)/.test(u)) return null;
  if (u.startsWith(ORIGIN)) u = u.slice(ORIGIN.length) || '/';
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return null;
  u = u.split('#')[0].split('?')[0];
  // Review Focus 4: 404.html is served at any depth, so nothing same-site may be relative.
  assert.ok(u.startsWith('/'), `${from}: relative URL "${url}"`);
  if (u === '/') return 'index.html';
  return u.endsWith('/') ? u.slice(1) + 'index.html' : u.slice(1);
}

test('no inline style or script anywhere (CSP without unsafe-inline)', () => {
  for (const f of HTML) {
    const root = parse(read(f));
    assert.equal(root.querySelectorAll('[style]').length, 0, `${f}: style= attribute`);
    assert.equal(root.querySelectorAll('style').length, 0, `${f}: <style> block`);
    for (const s of root.querySelectorAll('script')) {
      if (s.getAttribute('src')) continue;
      assert.equal(s.getAttribute('type'), 'application/ld+json', `${f}: inline <script>`);
    }
  }
});

test('every same-site reference resolves, and none is relative', () => {
  for (const f of HTML) {
    const root = parse(read(f));
    const refs = [
      ...root.querySelectorAll('a[href], link[href]').map((e) => e.getAttribute('href')),
      ...root.querySelectorAll('script[src], img[src]').map((e) => e.getAttribute('src')),
    ];
    for (const r of refs) {
      const target = resolveSameSite(r, f);
      if (target) assert.ok(FILES.includes(target), `${f}: ${r} does not resolve`);
    }
  }
});

// Language and canonical moved to tests/i18n.test.mjs (gate c), which reads them from the table.
test('pages declare a title and a description', () => {
  for (const f of PAGES) {
    const root = parse(read(f));
    assert.ok(root.querySelector('title')?.text.trim(), `${f}: <title>`);
    assert.ok(root.querySelector('meta[name="description"]')?.getAttribute('content'), `${f}: description`);
  }
});

test('error pages are never indexed', () => {
  for (const f of ERROR_PAGES) {
    const root = parse(read(f));
    assert.equal(root.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex', f);
    assert.equal(root.querySelectorAll('link[rel="canonical"]').length, 0, f);
  }
});

test('nothing links to the apex (each such link costs a 301)', () => {
  for (const f of FILES.filter((x) => /\.(html|xml|txt|js|css)$/.test(x))) {
    assert.ok(!APEX.test(read(f)), `${f} names https://winserv.com.br — use www`);
  }
});

test('no tracker and no third-party font (D5; Pixel removed 2026-10-08)', () => {
  const banned = /googletagmanager|google-analytics|facebook|fbevents|fonts\.googleapis|fonts\.gstatic/;   // spec §6: 'facebook'
  for (const f of FILES.filter((x) => /\.(html|js|css)$/.test(x))) assert.ok(!banned.test(read(f)), f);
});

test('the sitemap lists exactly the published pages', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => resolveSameSite(m[1], 'sitemap.xml'));
  const expected = HTML.filter((f) => !NOT_IN_SITEMAP.includes(f)).sort();
  assert.deepEqual([...locs].sort(), expected);
});

test('robots.txt names the www sitemap', () => {
  assert.match(read('robots.txt'), /^Sitemap: https:\/\/www\.winserv\.com\.br\/sitemap\.xml$/m);
});

test('every page links the privacy notice', () => {
  for (const f of [...PAGES, ...ERROR_PAGES]) {
    assert.ok(parse(read(f)).querySelector(`a[href="${href('privacidade', LOCALE_OF[f])}"]`), f);
  }
});

test('the privacy notice names what the site publishes (spec §5)', () => {
  const text = parse(read('privacidade.html')).text;
  for (const must of ['10.411.266/0001-80', 'dpo@winserv.com.br', 'comercial@winserv.com.br',
    'contact@winserv.com.br', 'suporte@winserv.com.br',
    '185 dias', 'Alemanha', 'Estados Unidos', 'não grava cookies',
    'links externos']) {
    assert.ok(text.includes(must), `privacidade.html lacks "${must}"`);
  }
});

test('the English privacy notice names what the site publishes (spec sub-project 3 §6)', () => {
  const text = parse(read('en/privacy.html')).text;
  for (const must of ['10.411.266/0001-80', 'dpo@winserv.com.br', 'comercial@winserv.com.br',
    'contact@winserv.com.br', 'suporte@winserv.com.br',
    '185 days', 'Germany', 'United States', 'sets no cookies', 'external links']) {
    assert.ok(text.includes(must), `en/privacy.html lacks "${must}"`);
  }
});
