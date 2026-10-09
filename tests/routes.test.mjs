// The table's own rules — spec 2026-10-08 sub-project 3 §3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTable, pageFile, ROUTES, pages, routeOf, href } from '../src/i18n/routes.mjs';

const fixture = {
  valores: { paths: { 'pt-br': '/valores.html', es: '/es/valores.html' } },
  privacidade: { paths: { 'pt-br': '/privacidade.html', en: '/en/privacy.html', es: { use: 'en' } } },
};

test('an alias resolves to the path of the language it names', () => {
  assert.equal(makeTable(fixture).href('privacidade', 'es'), '/en/privacy.html');
});

test('an alias is not a twin', () => {
  assert.deepEqual(makeTable(fixture).twins('privacidade'), { 'pt-br': '/privacidade.html', en: '/en/privacy.html' });
});

test('routeOf matches the full path, never the file name', () => {
  const t = makeTable(fixture);
  assert.deepEqual(t.routeOf('/valores.html'), { key: 'valores', locale: 'pt-br' });
  assert.deepEqual(t.routeOf('/es/valores.html'), { key: 'valores', locale: 'es' });
  assert.equal(t.routeOf('/en/valores.html'), undefined);
});

test('a path declared twice is refused', () => {
  assert.throws(() => makeTable({ a: { paths: { 'pt-br': '/x.html' } }, b: { paths: { en: '/x.html' } } }), /declared twice/);
});

test('an unknown language, an alias to an alias and a missing language are refused', () => {
  assert.throws(() => makeTable({ a: { paths: { fr: '/fr/' } } }), /unknown locale/);
  const t = makeTable({ a: { paths: { 'pt-br': '/a.html', en: { use: 'es' }, es: { use: 'pt-br' } } } });
  assert.throws(() => t.href('a', 'en'), /has no en path/);
  assert.throws(() => makeTable(fixture).href('valores', 'en'), /has no en path/);
});

test('pageFile maps a served path to the file in dist/', () => {
  assert.equal(pageFile('/'), 'index.html');
  assert.equal(pageFile('/en/'), 'en/index.html');
  assert.equal(pageFile('/en/solutions.html'), 'en/solutions.html');
});

test('the real table holds the 14 pages that exist today, by their exact paths', () => {
  for (const p of ['/', '/solucoes.html', '/conteudo.html', '/contato.html', '/missao.html', '/valores.html',
    '/ti.html', '/tiverde.html', '/telas.html', '/exposicao.html', '/filtro.html', '/privacidade.html',
    '/404.html', '/error.html']) {
    assert.equal(routeOf(p)?.locale, 'pt-br', p);
  }
  assert.ok(ROUTES['404'].noindex && ROUTES.error.noindex);
  assert.ok(pages().length >= 14);
  assert.equal(href('index', 'pt-br'), '/');
});
