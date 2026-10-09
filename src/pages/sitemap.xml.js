// Generated from the table (spec sub-project 3 §5): one <url> per indexable path, with its
// language versions. public/sitemap.xml must not exist — it would silently win over this file.
import { ORIGIN, LANG, pages, twins, noindex } from '../i18n/routes.mjs';

export function GET() {
  const rows = pages().filter((p) => !noindex(p.key)).map(({ path, key }) => {
    const tw = twins(key);
    const pairs = Object.entries(tw);
    const alt = pairs.length < 2 ? [] : [
      ...pairs.map(([l, p]) => `    <xhtml:link rel="alternate" hreflang="${LANG[l].hreflang}" href="${ORIGIN}${p}"/>`),
      ...(tw.en ? [`    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${tw.en}"/>`] : []),
    ];
    return ['  <url>', `    <loc>${ORIGIN}${path}</loc>`, ...alt, '  </url>'].join('\n');
  });
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    + rows.join('\n') + '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
