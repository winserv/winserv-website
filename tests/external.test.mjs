// Review Focus 5: a bad minute on the WiFi landing must not block the company site's publish,
// while a page the site links that is gone must.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../scripts/check-external.mjs';

test('200 passes; 404 and 410 fail; 5xx, 000 and anything else only warn', () => {
  assert.equal(classify(200), 'ok');
  for (const s of [404, 410]) assert.equal(classify(s), 'fail');
  for (const s of [500, 502, 503, 0, 429, 301]) assert.equal(classify(s), 'warn');
});
