// Gate (a), spec 2026-10-08 sub-project 3 §9: the pages that existed before i18n are untouched —
// approach A adds languages without refactoring a Portuguese page, and this is the proof.
// RETIREMENT: the gate proves one transition. The first PR that edits one of these pages on
// purpose (sub-project 4 rewrites the WiFi links) deletes this file and says why in its message.
// Never `git tag -f pre-i18n` to make a red run green: that keeps the test and erases what it
// proves. The tag is moved only when `main` moved before `i18n` merged (plan, Global Constraints).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('every page that existed at pre-i18n is byte-identical to it', () => {
  let listing;
  try {
    listing = git('ls-tree', '-r', '--name-only', 'pre-i18n', '--', 'src/pages');
  } catch {
    // Fails closed: a shallow clone has no tags, and "nothing to compare" must never read as green.
    assert.fail('tag pre-i18n is missing (CI needs fetch-depth: 0) — this gate never skips');
  }
  const files = listing.split('\n').filter(Boolean);
  assert.equal(files.length, 14, `pre-i18n should hold 14 pages, holds ${files.length}`);
  for (const f of files) {
    assert.equal(readFileSync(ROOT + f, 'utf8'), git('show', `pre-i18n:${f}`), `${f} changed since pre-i18n`);
  }
});
