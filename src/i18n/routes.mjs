// The single authority on which page exists in which language — spec 2026-10-08 sub-project 3 §3.
// Switcher, hreflang, canonical, sitemap, Nav, Footer, cards and the tests' page lists read it.
// Plain .mjs, not .ts: node --test imports it in CI on Node 22 without a TypeScript loader.
// Canonical, hreflang and sitemap come from here only, never from Astro.url, which reads /en
// for /en/ under build.format 'preserve' + trailingSlash 'never'.

export const ORIGIN = 'https://www.winserv.com.br';
export const LOCALES = ['pt-br', 'en', 'es'];

// The one place the spellings of a language meet: Astro's key (lower case), the HTML/hreflang
// tag, the Open Graph locale. es_LA is the WiFi landing's value, kept on purpose.
export const LANG = {
  'pt-br': { html: 'pt-BR', hreflang: 'pt-BR', og: 'pt_BR', name: 'Português', short: 'PT' },
  en: { html: 'en', hreflang: 'en', og: 'en_US', name: 'English', short: 'EN' },
  es: { html: 'es', hreflang: 'es', og: 'es_LA', name: 'Español', short: 'ES' },
};

// key → paths per language. A value is the path as served, or { use: <locale> } when that
// language has no page of its own (Spanish privacy → the English notice; D3: legal texts are
// pt-BR and EN only).
export const ROUTES = {
  index: { paths: { 'pt-br': '/', en: '/en/', es: '/es/' } },
  solucoes: { paths: { 'pt-br': '/solucoes.html', en: '/en/solutions.html', es: '/es/soluciones.html' } },
  conteudo: { paths: { 'pt-br': '/conteudo.html', en: '/en/articles.html', es: '/es/articulos.html' } },
  contato: { paths: { 'pt-br': '/contato.html', en: '/en/contact.html', es: '/es/contacto.html' } },
  missao: { paths: { 'pt-br': '/missao.html', en: '/en/mission.html', es: '/es/mision.html' } },
  valores: { paths: { 'pt-br': '/valores.html', en: '/en/values.html', es: '/es/valores.html' } },
  ti: { paths: { 'pt-br': '/ti.html', en: '/en/information-technology.html', es: '/es/que-es-ti.html' } },
  tiverde: { paths: { 'pt-br': '/tiverde.html', en: '/en/green-it.html', es: '/es/ti-verde.html' } },
  telas: { paths: { 'pt-br': '/telas.html', en: '/en/screen-time.html', es: '/es/tiempo-de-pantalla.html' } },
  exposicao: { paths: { 'pt-br': '/exposicao.html', en: '/en/pornography-exposure.html', es: '/es/exposicion-pornografia.html' } },
  filtro: { paths: { 'pt-br': '/filtro.html', en: '/en/internet-filter.html', es: '/es/filtro-internet.html' } },
  privacidade: { paths: { 'pt-br': '/privacidade.html', en: '/en/privacy.html', es: { use: 'en' } } },
  // Winserv WiFi (spec 2026-10-09 sub-project 4 §2). og: the product's own share card.
  wifi: { og: 'wifi', paths: { 'pt-br': '/wifi/', en: '/en/wifi/', es: '/es/wifi/' } },
  wifiRequisitos: { og: 'wifi', paths: { 'pt-br': '/wifi/requisitos.html', en: '/en/wifi/requirements.html', es: '/es/wifi/requisitos.html' } },
  wifiAjuda: { og: 'wifi', paths: { 'pt-br': '/wifi/ajuda.html', en: '/en/wifi/help.html', es: '/es/wifi/ayuda.html' } },
  // The text a customer accepts under signup.TERMS_VERSION: pt-BR and EN only (roadmap D3).
  wifiTermos: { og: 'wifi', paths: { 'pt-br': '/wifi/termos.html', en: '/en/wifi/terms.html', es: { use: 'en' } } },
  wifiPrivacidade: { og: 'wifi', paths: { 'pt-br': '/wifi/privacidade.html', en: '/en/wifi/privacy.html', es: { use: 'en' } } },
  wifiDpa: { og: 'wifi', paths: { 'pt-br': '/wifi/dpa.html', en: '/en/wifi/dpa.html', es: { use: 'en' } } },
  404: { noindex: true, paths: { 'pt-br': '/404.html', en: '/en/404.html', es: '/es/404.html' } },
  // One error page, Portuguese, unchanged: behind the edge a container that is down produces the
  // Caddy's 502, never ours (spec §8).
  error: { noindex: true, paths: { 'pt-br': '/error.html' } },
};

export function makeTable(routes) {
  const reverse = new Map();
  for (const [key, route] of Object.entries(routes)) {
    for (const [locale, value] of Object.entries(route.paths)) {
      if (!LOCALES.includes(locale)) throw new Error(`${key}: unknown locale ${locale}`);
      if (typeof value !== 'string') continue;
      if (reverse.has(value)) throw new Error(`${value} is declared twice (${reverse.get(value).key}, ${key})`);
      reverse.set(value, { key, locale });
    }
  }
  const href = (key, locale) => {
    const route = routes[key];
    if (!route) throw new Error(`no route ${key}`);
    const value = route.paths[locale];
    if (typeof value === 'string') return value;
    // One level only: an alias names a language that has a real path.
    if (value && typeof route.paths[value.use] === 'string') return route.paths[value.use];
    throw new Error(`${key} has no ${locale} path`);
  };
  const twins = (key) => Object.fromEntries(Object.entries(routes[key].paths).filter(([, v]) => typeof v === 'string'));
  return {
    href,
    twins,
    routeOf: (path) => reverse.get(path),
    noindex: (key) => routes[key]?.noindex === true,
    pages: () => [...reverse].map(([path, r]) => ({ path, ...r })),
  };
}

const site = makeTable(ROUTES);
export const { href, twins, routeOf, noindex, pages } = site;

export const pageFile = (path) => (path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1));
// Two card conventions on purpose (spec 2026-10-09 §2): the company's one image per language,
// the WiFi's own cover per language. The table says which a route uses.
// New names per redesign: networks cache a card by URL, so new bytes need a new URL (go-live 29).
// scripts/share-cards/render.mjs writes under the same stamp.
export const OG_STAMP = '2026-10';
export const ogImage = (locale, key) => (ROUTES[key]?.og === 'wifi'
  ? `/images/wifi/og/${OG_STAMP}/${locale}/og-cover.png`
  : `/images/og/${OG_STAMP}/${locale}.jpg`);
