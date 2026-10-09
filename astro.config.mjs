// Spec sub-project 3 §2. format 'preserve' builds contato.astro → contato.html (every Portuguese
// URL unchanged) and en/index.astro → en/index.html, so /en/ is a directory nginx serves and
// /en gets nginx's native 301 (measured on /images, 2026-10-08). 'file' flattened en/index to
// en.html. trailingSlash 'never' builds with 'preserve' with no warning (measured).
// compressHTML off so the port is byte-faithful where whitespace between inline-block
// elements matters (the pills, the badges).
// The CSP is the edge's alone: do not enable `security.csp` here (two authorities).
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.winserv.com.br',
  build: { format: 'preserve', inlineStylesheets: 'never' },
  trailingSlash: 'never',
  compressHTML: false,
  i18n: {
    locales: ['pt-br', 'en', 'es'],
    defaultLocale: 'pt-br',
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
});
