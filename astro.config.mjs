// Spec 2026-10-08 §2. format 'file' keeps every URL the site already has (contato.html), and
// trailingSlash 'never' is what the Configuration Reference asks of that format.
// compressHTML off so the port is byte-faithful where whitespace between inline-block
// elements matters (the pills, the badges).
// The CSP is the edge's alone: do not enable `security.csp` here (two authorities).
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.winserv.com.br',
  build: { format: 'file', inlineStylesheets: 'never' },
  trailingSlash: 'never',
  compressHTML: false,
  i18n: {
    locales: ['pt-br', 'en', 'es'],
    defaultLocale: 'pt-br',
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
});
