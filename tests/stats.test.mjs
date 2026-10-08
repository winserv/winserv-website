// deploy/site-stats.awk over a fixture (spec 2026-10-08 §7, Review Focus 1–2). Runs with the
// local awk (BSD on macOS, mawk/gawk on CI): the script must stay POSIX.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const awk = fileURLToPath(new URL('../deploy/site-stats.awk', import.meta.url));
const run = (f) => execFileSync('awk', ['-f', awk, fileURLToPath(new URL(f, import.meta.url))], { encoding: 'utf8' });

test('counts views, origins and e-mail clicks — and nothing else', () => {
  const out = run('./fixtures/access.log');
  assert.match(out, /^linhas 12, robos\/healthcheck 6, visualizacoes 3$/m);  // 304 and /contato count
  assert.match(out, /^\s+1 \/$/m);
  assert.match(out, /^\s+1 \/contato\.html$/m);
  assert.match(out, /^\s+1 \/contato$/m);
  assert.match(out, /^\s+1 www\.google\.com$/m);
  assert.match(out, /^\s+1 \(interno\)$/m);
  assert.match(out, /^\s+1 \(sem origem\)$/m);
  assert.match(out, /^\s+1 contato$/m);                                       // the POST beacon
  // Over external views only: internal navigation would dilute the share the spec's 20 %
  // floor reads (review of the astro branch).
  assert.match(out, /^sem origem: 50% das visitas externas$/m);
  assert.ok(!/203\.0\.113|Mozilla|Wget|facebookexternalhit|WhatsApp|zgrab/.test(out), 'an address or user agent leaked');
  assert.ok(!/style\.css|nao-existe|ti\.html/.test(out), 'asset, 404 or bot counted');
});

test('an empty journal is an error, not zero visits', () => {
  // The message, not only the status: awk itself exits 2 when it cannot open the script.
  assert.throws(() => run('./fixtures/empty.log'),
    (e) => e.status === 2 && /nenhuma linha do winserv-site/.test(e.stdout));
});
