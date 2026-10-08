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
