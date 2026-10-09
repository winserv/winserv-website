// The links that leave the site (src/i18n/routes.mjs EXTERNAL) exist — spec sub-project 3 §9,
// gate live′. Redirects are followed: sub-project 4 moves these pages with 301s. A 404/410 fails
// the publish; a 5xx or a network error only warns, because the target is another site and its
// bad minute is not ours (Review Focus 5).
import { externalUrls } from '../src/i18n/routes.mjs';

export function classify(status) {
  if (status === 200) return 'ok';
  if (status === 404 || status === 410) return 'fail';
  return 'warn';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let failed = 0;
  for (const url of externalUrls()) {
    let status = 0;
    try {
      status = (await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) })).status;
    } catch { status = 0; }
    const verdict = classify(status);
    console.log(`${verdict.toUpperCase().padEnd(4)} ${status} ${url}`);
    if (verdict === 'fail') failed = 1;
  }
  process.exit(failed);
}
