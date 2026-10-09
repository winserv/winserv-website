// Gates for the Winserv WiFi pages — spec 2026-10-09 sub-project 4 (winserv-unifi-portal).
// Run after `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { pages, pageFile } from '../src/i18n/routes.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
assert.ok(existsSync(DIST), 'dist/ missing — run `npm run build` first');
export const read = (f) => readFileSync(join(DIST, f), 'utf8');
export const WIFI = pages().filter((p) => p.key.startsWith('wifi'));
const mainOf = (p) => parse(read(pageFile(p.path))).querySelector('main');

test('the WiFi pages are the fifteen of the table, each in a <main class="w-main">', () => {
  assert.equal(WIFI.length, 15);
  for (const p of WIFI) assert.equal(mainOf(p)?.getAttribute('class'), 'w-main', p.path);
});

// Ported from winserv-unifi-portal tests/test_theme.py::test_every_landing_class_is_styled
// (spec §11): a class without a rule is the port's likeliest defect, and it fails silently.
test('every class on a WiFi page is a w- class with a rule in style.css', () => {
  const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
  const used = new Set();
  for (const p of WIFI) {
    const main = mainOf(p);
    for (const el of [main, ...main.querySelectorAll('*')]) {
      for (const c of (el.getAttribute('class') || '').split(/\s+/)) if (c) used.add(c);
    }
  }
  assert.ok(used.size > 10, `only ${used.size} classes`);
  assert.deepEqual([...used].filter((c) => !c.startsWith('w-')), []);
  assert.deepEqual([...used].filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css)), []);
});

// Old bookmarks carry fragments (#aplicativo-entra since 2026-09); the 301 keeps them and the
// page must still have the id (spec §11, Review Focus 1).
test('every same-site #fragment on a WiFi page lands on an id of its target', () => {
  let checked = 0;
  for (const p of WIFI) {
    for (const a of mainOf(p).querySelectorAll('a[href*="#"]')) {
      const [path, frag] = a.getAttribute('href').split('#');
      if (path && !path.startsWith('/')) continue;
      const target = pageFile(path || p.path);
      const ids = new Set(parse(read(target)).querySelectorAll('[id]').map((e) => e.getAttribute('id')));
      assert.ok(ids.has(frag), `${p.path}: ${a.getAttribute('href')} — no id "${frag}" in ${target}`);
      checked++;
    }
  }
  assert.ok(checked >= 10, `only ${checked} fragments checked`);
});

import { createHash } from 'node:crypto';
import { twins } from '../src/i18n/routes.mjs';

// The text a customer accepts under signup.TERMS_VERSION (winserv-unifi-portal), version → digest.
// Spec 2026-10-09 §4.3: over what is read — <title>, description, the text and every href of
// <main> — never the bytes, so markup, nav and CSS changes force no bump; pages sorted by
// path, never by the table's order. A new entry is the change that bumps signup.TERMS_VERSION,
// and the six pages show its key. Versions up to 2026-10-07c were digests of the landing's
// bytes; their table is in the spec (§4.4), not here.
export const LEGAL_DIGEST = {
  // The pages move into the Winserv site: scope, cookie section and version line (spec §4.1).
  '2026-10-09': '7337dcce64a0a4ffbd9d85c3f5b1e929df6d2eb1ad83078f2fe24c0484aba2ed',
};
const LEGAL = ['wifiTermos', 'wifiPrivacidade', 'wifiDpa'].flatMap((k) => Object.values(twins(k))).sort();

export function legalUnit(html) {
  const root = parse(html);
  const main = root.querySelector('main');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return [
    norm(root.querySelector('title').text),
    root.querySelector('meta[name="description"]').getAttribute('content'),
    norm(main.text),
    ...main.querySelectorAll('a[href]').map((a) => a.getAttribute('href')),
  ].join('\n');
}

test('the legal text changes only with a new version, and the six pages show that version', () => {
  assert.equal(LEGAL.length, 6);
  const digest = createHash('sha256').update(LEGAL.map((p) => legalUnit(read(pageFile(p)))).join('\n\u0000\n')).digest('hex');
  const versions = Object.keys(LEGAL_DIGEST);
  const latest = versions.at(-1);
  assert.deepEqual([...versions].sort(), versions, 'versions out of order');
  assert.equal(LEGAL_DIGEST[latest], digest, `legal text changed: bump the version and record ${digest} for it`);
  for (const p of LEGAL) {
    const main = parse(read(pageFile(p))).querySelector('main');
    assert.equal(main.getAttribute('data-terms-version'), latest, p);
    assert.match(main.text, new RegExp(`(Versão|Version) ${latest}`), p);
  }
});

// Ported from test_marketing.py:263 — links outside this tree end in #aplicativo-entra.
test('the Portuguese privacy keeps the anchor old links carry', () => {
  assert.ok(parse(read('wifi/privacidade.html')).querySelector('#aplicativo-entra'));
});

// Ported from test_marketing.py:290 — LGPD art. 41 §1 (named 2026-09-26; the page had only contact@).
test('both privacy pages name the data protection officer', () => {
  for (const p of Object.values(twins('wifiPrivacidade'))) {
    const text = read(pageFile(p));
    assert.ok(text.includes('Marcelo Samoilenko') && text.includes('href="mailto:dpo@winserv.com.br"'), p);
  }
});

// Ported from test_marketing.py:300 — Decreto 7.962/2013 art. 2, I-II ("CNPJ sob consulta", 2026-09-19).
test('the legal pages identify the company', () => {
  for (const p of LEGAL) {
    const text = read(pageFile(p));
    for (const fact of ['M. SAMOILENKO INFORMATICA', '10.411.266/0001-80', '96202-570']) assert.ok(text.includes(fact), `${p}: ${fact}`);
  }
});
