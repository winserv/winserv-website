// The links that leave the site (src/i18n/routes.mjs EXTERNAL) exist — spec sub-project 3 §9,
// gate live′. Redirects are followed: sub-project 4 moves these pages with 301s. A 404/410 fails
// the publish; a 5xx or a network error only warns, because the target is another site and its
// bad minute is not ours (Review Focus 5). A check over no URL fails: "nothing measured" is
// never a pass. publish.sh runs it before uploading — a 404 here is our content being wrong.
import { externalUrls } from '../src/i18n/routes.mjs';

export function classify(status) {
  if (status === 200) return 'ok';
  if (status === 404 || status === 410) return 'fail';
  return 'warn';
}

export async function check(urls, fetcher = (u) => fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(10000) })) {
  if (urls.length === 0) return { failed: true, lines: ['FAIL no external URL to check'] };
  const lines = [];
  let failed = false;
  for (const url of urls) {
    let status = 0;
    try { status = (await fetcher(url)).status; } catch { status = 0; }
    const verdict = classify(status);
    lines.push(`${verdict.toUpperCase().padEnd(4)} ${status} ${url}`);
    if (verdict === 'fail') failed = true;
  }
  return { failed, lines };
}

// Run directly (not imported by the tests). A path with a space would not match this comparison;
// the repo path has none, and the tests above cover the logic either way.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { failed, lines } = await check(externalUrls());
  for (const l of lines) console.log(l);
  process.exit(failed ? 1 : 0);
}
