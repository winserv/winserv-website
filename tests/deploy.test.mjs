// The container and its nginx — spec 2026-10-08 §3. Plain text checks on files that only run
// on the VM; what they do live is measured by scripts/publish.sh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const conf = readFileSync(new URL('../deploy/site-nginx.conf', import.meta.url), 'utf8');
const compose = readFileSync(new URL('../deploy/docker-compose.yml', import.meta.url), 'utf8');
const code = conf.replace(/#.*$/gm, '');

test('the log keeps the default combined format, which carries the referrer', () => {
  assert.ok(!/\blog_format\b/.test(code) && !/\baccess_log\b/.test(code));
});

test('the log keeps the visitor, not the Caddy (Review Focus 5)', () => {
  assert.match(code, /set_real_ip_from 172\.18\.0\.0\/16;/);
  assert.match(code, /real_ip_header X-Forwarded-For;/);
});

test('links without .html keep working, as on GitHub Pages (Review Focus 3)', () => {
  assert.match(code, /try_files \$uri \$uri\.html \$uri\/ =404;/);
});

test('.well-known is served despite the dotfile rule', () => {
  const wk = code.indexOf('location ^~ /.well-known/');
  const dot = code.indexOf('location ~ /\\.');
  assert.ok(wk >= 0 && dot >= 0 && wk < dot);
});

test('the archived AI Portal URLs answer 302, never 301 (reversible archive)', () => {
  for (const p of ['/winserv-ai-portal.html', '/winserv-ai-portal-tecnico.html',
    '/winserv-ai-portal/winserv-ai-portal-facts.html']) {
    assert.ok(code.includes(`location = ${p} { return 302 /; }`), p);
  }
  assert.ok(!/return 301/.test(code));
});

test('our error pages, never nginx\'s', () => {
  assert.match(code, /error_page 403 404 =404 \/404\.html;/);
  assert.match(code, /error_page 400 405 413 414 500 502 503 504 \/error\.html;/);
});

test('every response is revalidated — or repeat visits never reach the log (Review Focus 1)', () => {
  assert.match(code, /add_header Cache-Control "no-cache" always;/);
});

test('the error pages by name answer 404, not 200 (measured 2026-10-08: try_files served them)', () => {
  assert.ok(code.includes('location = /404 { return 404; }'));
  assert.ok(code.includes('location = /error { return 404; }'));
});

test('the beacon answers 204', () => {
  assert.match(code, /location = \/e\/contato-email \{ return 204; \}/);
});

test('compose: journald, our names, no host port', () => {
  assert.match(compose, /^name: winserv-site$/m);
  assert.match(compose, /container_name: winserv-site$/m);
  assert.match(compose, /driver: journald/);
  assert.ok(!/^\s+ports:/m.test(compose));
});

import { LOCALES } from '../src/i18n/routes.mjs';

// Spec sub-project 3 §8. Each block repeats the server's error.html line: if an error_page inside
// a location cancels the server's (nginx documentation, not re-read when this was written), the
// line is needed; if it does not, the line is a harmless repeat. Right either way.
for (const l of LOCALES.filter((x) => x !== 'pt-br')) {
  test(`${l}: its own 404, the shared error page, internal and by-name rules`, () => {
    const block = code.match(new RegExp(String.raw`location \^~ /${l}/ \{([^}]*)\}`))?.[1];
    assert.ok(block, `no location ^~ /${l}/`);
    assert.match(block, new RegExp(String.raw`error_page 403 404 =404 /${l}/404\.html;`));
    assert.match(block, /error_page 400 405 413 414 500 502 503 504 \/error\.html;/);
    assert.match(block, /try_files \$uri \$uri\.html \$uri\/ =404;/);
    // Each exact location names its own 404 page: without it, it inherits the server's Portuguese
    // /404.html (2026-10-09 branch review, inferred from error_page inheritance).
    assert.ok(code.includes(`location = /${l}/404.html { internal; error_page 404 /${l}/404.html; }`));
    assert.ok(code.includes(`location = /${l}/404 { error_page 404 /${l}/404.html; return 404; }`));
  });
}

// Ported from winserv-unifi-portal test_marketing.py:311 (measured 2026-09-22: without it,
// /termos answered 301 to http://…:8080/termos/). /wifi → /wifi/ depends on it (spec §6 row 17).
test('nginx answers relative redirects and names no version', () => {
  assert.match(code, /^\s*absolute_redirect off;/m);
  assert.match(code, /^\s*server_tokens off;/m);
});
