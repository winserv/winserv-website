// Theme gates — spec 2026-10-10-winserv-site-light-theme-design §5 (winserv-unifi-portal).
// Reads public/style.css directly; no build needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');

function rootBlock(css) {
  const m = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(m, 'no :root block');
  return m;
}
function rootTokens(css) {
  const map = new Map();
  for (const [, k, v] of rootBlock(css)[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) map.set(k, v.trim());
  return map;
}
const hex = (v) => {
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  assert.ok(m, `not a #rrggbb colour: ${v}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Incident: .w-note 4.03:1 and .w-ledger 4.23:1 (go-live 29, 2026-10-09) — a palette nobody measured.
// Every pair a page actually draws text with; WCAG AA for body text is 4.5:1.
const PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['heading', 'bg'], ['heading', 'surface'], ['muted', 'bg'], ['muted', 'surface'],
  ['accent', 'bg'], ['accent', 'surface'], ['danger', 'bg'], ['danger', 'surface'],
  ['on-accent', 'accent'], ['on-accent', 'accent-hover'],
];
test('every text/background token pair is WCAG AA (4.5:1)', () => {
  const t = rootTokens(CSS);
  const low = [];
  for (const [fg, bg] of PAIRS) {
    assert.ok(t.has(fg) && t.has(bg), `missing token --${fg} or --${bg}`);
    const r = ratio(hex(t.get(fg)), hex(t.get(bg)));
    if (r < 4.5) low.push(`--${fg} on --${bg}: ${r.toFixed(2)}`);
  }
  assert.deepEqual(low, []);
});

// Incident: this migration had to hunt 40 literals across the sheet (2026-10-10); with them
// gone, a dark theme could return as one token block (spec L1). An id selector made only of
// hex letters (#add, #face) would match too — rename it rather than weaken the pattern.
// CSS named colours (CSS Color 4), matched only after a ':' so a class like .c-green never counts;
// transparent, currentColor and inherit stay allowed. Review 2026-10-10: `color: white` and
// `oklch(...)` passed the first version of this gate.
const NAMED = ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown '
  + 'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan '
  + 'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred '
  + 'darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue '
  + 'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray '
  + 'green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen '
  + 'lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink '
  + 'lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen '
  + 'linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue '
  + 'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy '
  + 'oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip '
  + 'peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown '
  + 'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal '
  + 'thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' ');
const LITERAL = new RegExp(String.raw`#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(`
  + String.raw`|:[^;{}]*\b(${NAMED.join('|')})\b`, 'i');

test('no colour literal outside :root', () => {
  // Blank the exempt blocks but keep their newlines, so a hit reports the file's own line.
  const blank = (s) => s.replace(/[^\n]/g, '');
  const body = CSS.replace(rootBlock(CSS)[0], blank).replace(/@font-face\s*\{[^}]*\}/g, blank);
  const hits = body.split('\n').flatMap((line, i) => {
    // Strip comments and quoted strings (content: '✓', font names) before matching.
    const code = line.replace(/\/\*.*?\*\//g, '').replace(/'[^']*'|"[^"]*"/g, "''");
    return LITERAL.test(code) ? [`${i + 1}: ${line.trim()}`] : [];
  });
  assert.deepEqual(hits, []);
});
