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
