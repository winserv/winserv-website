// Review Focus 5: a bad minute on the WiFi landing must not block the company site's publish,
// while a page the site links that is gone must.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, check } from '../scripts/check-external.mjs';

test('200 passes; 404 and 410 fail; 5xx, 000 and anything else only warn', () => {
  assert.equal(classify(200), 'ok');
  for (const s of [404, 410]) assert.equal(classify(s), 'fail');
  for (const s of [500, 502, 503, 0, 429, 301]) assert.equal(classify(s), 'warn');
});

const fake = (statuses) => async (url) => {
  if (statuses[url] === 'throw') throw new Error('network');
  return { status: statuses[url] };
};

test('a check over no URL fails — "nothing measured" is never a pass', async () => {
  assert.equal((await check([], fake({}))).failed, true);
});

test('one 404 fails the check; a 502 and a network error only warn', async () => {
  const r = await check(['https://a/', 'https://b/', 'https://c/'], fake({ 'https://a/': 502, 'https://b/': 'throw', 'https://c/': 200 }));
  assert.equal(r.failed, false);
  assert.deepEqual(r.lines.map((l) => l.split(' ')[0]), ['WARN', 'WARN', 'OK']);
  assert.equal((await check(['https://a/', 'https://c/'], fake({ 'https://a/': 404, 'https://c/': 200 }))).failed, true);
});
