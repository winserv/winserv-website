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
// pt-BR and EN only). English and Spanish entries arrive with their pages (Tasks 6 and 7).
export const ROUTES = {
  index: { paths: { 'pt-br': '/' } },
  solucoes: { paths: { 'pt-br': '/solucoes.html' } },
  conteudo: { paths: { 'pt-br': '/conteudo.html' } },
  contato: { paths: { 'pt-br': '/contato.html' } },
  missao: { paths: { 'pt-br': '/missao.html' } },
  valores: { paths: { 'pt-br': '/valores.html' } },
  ti: { paths: { 'pt-br': '/ti.html' } },
  tiverde: { paths: { 'pt-br': '/tiverde.html' } },
  telas: { paths: { 'pt-br': '/telas.html' } },
  exposicao: { paths: { 'pt-br': '/exposicao.html' } },
  filtro: { paths: { 'pt-br': '/filtro.html' } },
  privacidade: { paths: { 'pt-br': '/privacidade.html' } },
  404: { noindex: true, paths: { 'pt-br': '/404.html' } },
  // One error page, Portuguese, unchanged: behind the edge a container that is down produces the
  // Caddy's 502, never ours (spec §8).
  error: { noindex: true, paths: { 'pt-br': '/error.html' } },
};

// Links that leave the site, until sub-project 4 brings the WiFi pages in.
const WIFI = 'https://www.wifi.winserv.com.br';
export const EXTERNAL = {
  wifiHome: { paths: { 'pt-br': `${WIFI}/pt-br/`, en: `${WIFI}/`, es: `${WIFI}/es/` } },
  // The Spanish landing has no privacy page (measured 2026-10-08): ayuda/, requisitos/, 404 only.
  wifiPrivacy: { paths: { 'pt-br': `${WIFI}/pt-br/privacidade/`, en: `${WIFI}/privacy/`, es: { use: 'en' } } },
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

const links = makeTable(EXTERNAL);
export const external = links.href;
export const externalUrls = () => [...new Set(links.pages().map((p) => p.path))];

export const pageFile = (path) => (path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1));
export const ogImage = (locale) => `/images/og/${locale}.jpg`;
