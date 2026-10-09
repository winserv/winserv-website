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
