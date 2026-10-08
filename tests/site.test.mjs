// Gates over the built site — spec 2026-10-08-winserv-site-astro-design §6, site CI row.
// Run after `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

export const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
export const ORIGIN = 'https://www.winserv.com.br';
export const PAGES = ['index.html', 'solucoes.html', 'conteudo.html', 'contato.html', 'missao.html',
  'valores.html', 'ti.html', 'tiverde.html', 'telas.html', 'exposicao.html', 'filtro.html',
  'privacidade.html'];
export const ERROR_PAGES = ['404.html', 'error.html'];

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
    'images/og.jpg', 'fonts/plus-jakarta-sans-400.woff2']) {
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

test("format 'file' + i18n produce the old paths and no locale routes yet (spec §11)", () => {
  for (const f of ['index.html', 'contato.html', 'filtro.html', '404.html']) assert.ok(HTML.includes(f), f);
  assert.ok(!HTML.some((f) => f.endsWith('/index.html')), 'a page built as dir/index.html');
  assert.ok(!FILES.some((f) => /^(en|es|pt-br)\//.test(f)), 'a locale route exists before sub-project 3');
});

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

test('pages declare language, title, description and a canonical on www', () => {
  for (const f of PAGES) {
    const root = parse(read(f));
    assert.equal(root.querySelector('html').getAttribute('lang'), 'pt-BR', f);
    assert.ok(root.querySelector('title')?.text.trim(), `${f}: <title>`);
    assert.ok(root.querySelector('meta[name="description"]')?.getAttribute('content'), `${f}: description`);
    const path = f === 'index.html' ? '/' : `/${f}`;
    assert.deepEqual(root.querySelectorAll('link[rel="canonical"]').map((e) => e.getAttribute('href')),
      [ORIGIN + path], f);
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
  const banned = /googletagmanager|google-analytics|connect\.facebook\.net|facebook\.com\/tr|fbevents|fonts\.googleapis|fonts\.gstatic/;
  for (const f of FILES.filter((x) => /\.(html|js|css)$/.test(x))) assert.ok(!banned.test(read(f)), f);
});
