// Gates over the built site that read the table — spec 2026-10-08 sub-project 3 §9.
// Run after `npm run build`. Each gate names its origin; each was seen failing once (plan).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import {
  ORIGIN, LOCALES, LANG, ROUTES, EXTERNAL, href, twins, noindex, pages, external, pageFile, ogImage,
} from '../src/i18n/routes.mjs';

export const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
assert.ok(existsSync(DIST), 'dist/ missing — run `npm run build` first');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
export const FILES = walk(DIST).map((p) => relative(DIST, p));
export const read = (f) => readFileSync(join(DIST, f), 'utf8');
export const PAGES = pages();
const html = (p) => parse(read(pageFile(p.path)));
const attrs = (root, sel, ...names) => root.querySelectorAll(sel).map((e) => names.map((n) => e.getAttribute(n)).join(' '));

// The rule BaseLayout and the sitemap implement, written again here so the test is not the code.
export function expectedAlternates(key) {
  const tw = twins(key);
  const pairs = Object.entries(tw);
  if (noindex(key) || pairs.length < 2) return new Set();
  const set = new Set(pairs.map(([l, p]) => `${LANG[l].hreflang} ${ORIGIN}${p}`));
  if (tw.en) set.add(`x-default ${ORIGIN}${tw.en}`);
  return set;
}

test('every page of the table is in dist/, and nothing published is outside the table (build gate + gate i)', () => {
  for (const p of PAGES) assert.ok(FILES.includes(pageFile(p.path)), `${p.path} is in the table and not built`);
  const known = new Set(PAGES.map((p) => pageFile(p.path)));
  const extra = FILES.filter((f) => f.endsWith('.html') && !known.has(f)
    && !['googlecc9795c73ab262d5.html', 'googlehostedservice.html'].includes(f));
  assert.deepEqual(extra, []);
});

test('language, canonical, og:url, og:locale and hreflang come from the table (gates c, f)', () => {
  for (const p of PAGES.filter((x) => !noindex(x.key))) {
    const root = html(p);
    const meta = (k) => root.querySelector(`meta[property="${k}"]`)?.getAttribute('content');
    assert.equal(root.querySelector('html').getAttribute('lang'), LANG[p.locale].html, p.path);
    assert.deepEqual(attrs(root, 'link[rel="canonical"]', 'href'), [ORIGIN + p.path], p.path);
    assert.equal(meta('og:url'), ORIGIN + p.path, p.path);
    assert.equal(meta('og:locale'), LANG[p.locale].og, p.path);
    const others = Object.keys(twins(p.key)).filter((l) => l !== p.locale).map((l) => LANG[l].og);
    assert.deepEqual(new Set(attrs(root, 'meta[property="og:locale:alternate"]', 'content')), new Set(others), p.path);
    assert.deepEqual(new Set(attrs(root, 'link[rel="alternate"][hreflang]', 'hreflang', 'href')), expectedAlternates(p.key), p.path);
    assert.equal(meta('og:image'), ORIGIN + ogImage(p.locale), p.path);
    assert.equal(root.querySelector('meta[name="twitter:image"]')?.getAttribute('content'), meta('og:image'), p.path);
    assert.ok(FILES.includes(ogImage(p.locale).slice(1)), `${ogImage(p.locale)} missing`);
  }
});

test('the sitemap is the table: every indexable page, with the same alternates as its <head> (gates c, i)', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml">/);
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  const locs = urls.map((u) => u.match(/<loc>([^<]+)<\/loc>/)[1]);
  assert.deepEqual(new Set(locs), new Set(PAGES.filter((p) => !noindex(p.key)).map((p) => ORIGIN + p.path)));
  for (const u of urls) {
    const loc = u.match(/<loc>([^<]+)<\/loc>/)[1];
    const inMap = new Set([...u.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)].map((m) => `${m[1]} ${m[2]}`));
    const p = PAGES.find((x) => ORIGIN + x.path === loc);
    assert.deepEqual(inMap, new Set(attrs(html(p), 'link[rel="alternate"][hreflang]', 'hreflang', 'href')), loc);
  }
});

test('internal links stay in the page\'s language, through the table (gate b)', () => {
  for (const p of PAGES) {
    const allowed = new Set(Object.keys(ROUTES).flatMap((k) => { try { return [href(k, p.locale)]; } catch { return []; } }));
    const root = html(p);
    for (const a of root.querySelectorAll('a[href]')) {
      if (a.closest('.nav-lang, .nav-mobile-lang')) continue;            // the switcher has its own gate
      const h = a.getAttribute('href').split('#')[0];
      if (!h.startsWith('/') || h.startsWith('//') || /^\/(images|fonts|js)\//.test(h)) continue;
      assert.ok(allowed.has(h), `${p.path}: ${h} is not a ${p.locale} page of the table`);
    }
  }
});

test('links to the WiFi landing are the table\'s, for the page\'s language (gate b′)', () => {
  const allowed = (l) => new Set(Object.keys(EXTERNAL).map((k) => external(k, l)));
  for (const p of PAGES) {
    for (const a of html(p).querySelectorAll('a[href^="https://www.wifi.winserv.com.br"]')) {
      assert.ok(allowed(p.locale).has(a.getAttribute('href')), `${p.path}: ${a.getAttribute('href')}`);
    }
  }
});

test('the switcher offers the other languages: the twins, or the homes on a noindex page (gate h)', () => {
  for (const p of PAGES) {
    const root = html(p);
    const target = (l) => (noindex(p.key) ? twins('index')[l] : twins(p.key)[l]);
    const want = new Set(LOCALES.filter((l) => l !== p.locale && target(l)).map((l) => `${LANG[l].hreflang} ${LANG[l].html} ${target(l)}`));
    for (const box of ['.nav-lang', '.nav-mobile-lang']) {
      assert.deepEqual(new Set(attrs(root, `${box} a`, 'hreflang', 'lang', 'href')), want, `${p.path} ${box}`);
    }
    assert.equal(root.querySelectorAll('.nav-lang .nav-new, .nav-mobile-lang .nav-new').length, 0, p.path);
  }
});

test('noindex pages: their language, robots noindex, no canonical, no alternates (gate h)', () => {
  for (const p of PAGES.filter((x) => noindex(x.key))) {
    const root = html(p);
    assert.equal(root.querySelector('html').getAttribute('lang'), LANG[p.locale].html, p.path);   // gate c skips noindex pages
    assert.equal(root.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex', p.path);
    assert.equal(root.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').length, 0, p.path);
  }
});

test('the three homes carry the Organization JSON-LD, nothing else does', () => {
  for (const p of PAGES) {
    const blocks = html(p).querySelectorAll('script[type="application/ld+json"]');
    if (p.key !== 'index') { assert.equal(blocks.length, 0, p.path); continue; }
    assert.equal(blocks.length, 1, p.path);
    const org = JSON.parse(blocks[0].text);
    assert.equal(org['@type'], 'Organization');
    assert.equal(org.url, ORIGIN + '/');
  }
});

// ── Language leaks: a floor, not a proof (ported from winserv-unifi-portal tests/test_marketing.py
// 47–76, 209–220). Unaccented Portuguese with no listed word passes.
const PT_LETTERS = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/gu;
const PT_ONLY_LETTERS = /[àâãêôõçÀÂÃÊÔÕÇ]/gu;
const ES_LETTERS = /[ñÑ¿¡]/gu;
// JavaScript's \b is ASCII-only: "você" has no \b after "ê". Letter-class lookarounds instead
// (Review Focus 1; the positive control below holds it).
const PT_ONLY_WORDS = new RegExp(String.raw`(?<![\p{L}\p{N}_])(?:` + [
  'você', 'voce', 'nao', 'seu', 'sua', 'seus', 'suas', 'pelo', 'pela', 'isso', 'com', 'uma',
  'senha', 'rede', 'usuário', 'usuários', 'obrigatório', 'obrigatórios',
  'preencha', 'conta', 'também', 'ainda', 'agora', 'depois', 'foi', 'clique', 'acesso',
  'nenhum', 'nenhuma', 'aparelho', 'aparelhos', 'tente', 'novamente', 'voltar',
  'assinatura', 'pagamento', 'pessoas', 'endereço', 'nome', 'falha', 'segurança',
  'arquivo', 'baixar', 'ajuda',
].join('|') + String.raw`)(?![\p{L}\p{N}_])`, 'giu');
const URLISH = /(?:href|src|content)="[^"]*"|\S+@\S+|https?:\/\/\S+|[\w-]+(?:\.[\w-]+)+/g;
// An element marked lang="…" is that language on purpose (switcher labels, the trade name).
// Never <html> itself: a page declared Portuguese would erase itself and pass.
const foreign = (...langs) => new RegExp(String.raw`<(?!html\b)(\w+)\b[^>]*\blang="(?:${langs.join('|')})"[^>]*>[\s\S]*?</\1>`, 'g');

test('the leak regexes catch what they exist for (positive control, Review Focus 1)', () => {
  const sample = 'Preencha todos os campos obrigatórios, você também.';
  assert.deepEqual([...sample.matchAll(PT_ONLY_WORDS)].map((m) => m[0].toLowerCase()).sort(),
    ['obrigatórios', 'preencha', 'também', 'você']);
  assert.equal('<span lang="pt-BR">Tecnologia da Informação</span> ok'.replace(foreign('pt-BR'), ''), ' ok');
  assert.equal('<html lang="pt-BR"><p>ção</p>'.replace(foreign('pt-BR'), ''), '<html lang="pt-BR"><p>ção</p>');
});

const ofLocale = (l) => PAGES.filter((p) => p.locale === l);

test('English pages carry no Portuguese or Spanish (gate e)', () => {
  const en = ofLocale('en');
  assert.ok(en.length >= 13, `only ${en.length} English pages`);   // never vacuous
  for (const p of en) {
    const text = read(pageFile(p.path)).replace(foreign('pt-BR', 'es'), '');
    const found = new Set([...(text.match(PT_LETTERS) || []), ...(text.match(ES_LETTERS) || [])]);
    assert.deepEqual([...found], [], p.path);
  }
});

test('the trade name stays Portuguese, marked (Review Focus 2)', () => {
  for (const p of ofLocale('en')) {
    const marked = html(p).querySelectorAll('[lang="pt-BR"]').map((e) => e.text);
    assert.ok(marked.includes('Winserv Tecnologia da Informação'), `${p.path}: footer trade name not marked`);
  }
  const contact = parse(read('en/contact.html'));
  assert.ok(contact.querySelector('.contact-card-val [lang="pt-BR"]'), 'contact card trade name not marked');
  const btn = contact.querySelector('#copy-email');
  assert.ok(btn.getAttribute('data-ok') && btn.getAttribute('data-fail'), 'copy messages not in English (Review Focus 3)');
});

// First-level blocks and heading levels: what approach A's three copies of a layout must share.
function skeleton(root) {
  const body = root.querySelector('body');
  const blocks = body.childNodes.filter((n) => n.nodeType === 1
    && !['topnav', 'nav-mobile', 'site-footer'].some((c) => (n.getAttribute('class') || '').split(/\s+/).includes(c))
    && n.tagName !== 'SCRIPT');
  return {
    blocks: blocks.map((n) => [n.tagName.toLowerCase(), ...(n.getAttribute('class') || '').split(/\s+/).filter(Boolean).sort()].join('.')),
    headings: blocks.flatMap((n) => n.querySelectorAll('h1, h2, h3, h4, h5, h6').map((h) => h.tagName.toLowerCase())),
  };
}

test('every language version has the Portuguese page\'s blocks and headings (gate d)', () => {
  let compared = 0;
  for (const key of Object.keys(ROUTES)) {
    const tw = twins(key);
    if (!tw['pt-br']) continue;
    const want = skeleton(parse(read(pageFile(tw['pt-br']))));
    for (const [l, path] of Object.entries(tw)) {
      if (l === 'pt-br') continue;
      assert.deepEqual(skeleton(parse(read(pageFile(path)))), want, `${path} vs ${tw['pt-br']}`);
      compared++;
    }
  }
  assert.ok(compared >= 13, `only ${compared} pairs compared`);
});

test('the English privacy notice: same version date, the Portuguese prevails (gate g)', () => {
  const PT_M = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const EN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pt = parse(read('privacidade.html')).text.match(/Versão de (\d{1,2}) de (\p{L}+) de (\d{4})/u);
  const en = parse(read('en/privacy.html')).text.match(/Version of ([A-Z][a-z]+) (\d{1,2}), (\d{4})/);
  assert.ok(pt && en, 'a version line is missing');
  assert.deepEqual([+en[2], EN_M.indexOf(en[1]), en[3]], [+pt[1], PT_M.indexOf(pt[2]), pt[3]]);
  assert.match(parse(read('en/privacy.html')).text, /the Portuguese version prevails/);
});

test('Spanish pages carry no Portuguese (gate e)', () => {
  const es = ofLocale('es');
  assert.ok(es.length >= 12, `only ${es.length} Spanish pages`);
  for (const p of es) {
    const raw = read(pageFile(p.path)).replace(foreign('pt-BR'), '');
    assert.deepEqual([...new Set(raw.match(PT_ONLY_LETTERS) || [])], [], p.path);
    const copy = raw.replace(URLISH, '');
    assert.deepEqual([...new Set([...copy.matchAll(PT_ONLY_WORDS)].map((m) => m[0].toLowerCase()))], [], p.path);
  }
});

test('the whole site: 35 indexable pages, a 404 per language, Spanish privacy is the English notice', () => {
  assert.equal(PAGES.filter((p) => !noindex(p.key)).length, 35);
  for (const l of LOCALES) assert.ok(twins('404')[l], `no 404 in ${l}`);
  assert.equal(href('privacidade', 'es'), '/en/privacy.html');
  for (const p of ofLocale('es')) {
    assert.ok(html(p).querySelector('.site-footer a[href="/en/privacy.html"]'), `${p.path}: footer privacy link`);
  }
});
