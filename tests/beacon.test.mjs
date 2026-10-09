// Review Focus 4 (spec sub-project 3): the e-mail beacon names the page it was clicked on with a
// readable slug, so site-stats counts "en/contact", not "en%2Fcontact". Runs public/js/site.js
// itself in a sandbox — a fixture line in stats.test.mjs could not catch a regression here
// (the 2026-10-09 review put the old code back and the suite stayed green).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../public/js/site.js', import.meta.url), 'utf8');

function beaconFor(pathname) {
  const sent = [];
  const handlers = [];
  const link = { addEventListener: (ev, fn) => { if (ev === 'click') handlers.push(fn); } };
  const sandbox = {
    location: { pathname },
    navigator: { sendBeacon: (url) => { sent.push(url); return true; } },
    document: {
      getElementById: () => null,
      querySelectorAll: (sel) => (sel === 'a[href^="mailto:"]' ? [link] : []),
    },
  };
  vm.runInNewContext(SOURCE, sandbox);
  handlers.forEach((fn) => fn());
  assert.equal(sent.length, 1, `${pathname}: no beacon sent`);
  return sent[0];
}

test('the beacon slug is readable on every kind of path', () => {
  for (const [path, slug] of [
    ['/', 'inicio'], ['/contato.html', 'contato'], ['/contato', 'contato'],
    ['/en/', 'en/inicio'], ['/en/contact.html', 'en/contact'], ['/es/contacto.html', 'es/contacto'],
  ]) {
    assert.equal(beaconFor(path), `/e/contato-email?p=${slug}`, path);
  }
});
