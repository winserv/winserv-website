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

test('the beacon answers 204', () => {
  assert.match(code, /location = \/e\/contato-email \{ return 204; \}/);
});

test('compose: journald, our names, no host port', () => {
  assert.match(compose, /^name: winserv-site$/m);
  assert.match(compose, /container_name: winserv-site$/m);
  assert.match(compose, /driver: journald/);
  assert.ok(!/^\s+ports:/m.test(compose));
});
