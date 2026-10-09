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
