// Spec 2026-10-08 §10: the twelve pages at 1366 and 390 px, old (tag pre-astro) vs new
// (dist/), same browser, footer hidden on both (the new one adds the privacy link).
// Only same-origin requests load (no gtag on the old side). Writes visual-diff/*.png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const OLD = process.env.OLD_ORIGIN || 'http://127.0.0.1:8801';
const NEW = process.env.NEW_ORIGIN || 'http://127.0.0.1:8802';
const PATHS = ['/index.html', '/solucoes.html', '/conteudo.html', '/contato.html', '/missao.html',
  '/valores.html', '/ti.html', '/tiverde.html', '/telas.html', '/exposicao.html', '/filtro.html', '/404.html'];
const WIDTHS = [1366, 390];

mkdirSync('visual-diff', { recursive: true });
const browser = await chromium.launch();
let failed = 0;
for (const width of WIDTHS) {
  for (const path of PATHS) {
    const shots = [];
    for (const origin of [OLD, NEW]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
      await page.goto(origin + path, { waitUntil: 'load' });
      await page.addStyleTag({ content: 'footer.site-footer{display:none!important}' });
      await page.evaluate(() => document.fonts.ready);
      shots.push(PNG.sync.read(await page.screenshot({ fullPage: true })));
      await page.close();
    }
    const [a, b] = shots;
    const name = `${width}${path.replace(/[/.]/g, '_')}`;
    if (process.env.SAVE_ALL) {   // for the side-by-side Marcelo looks at (Step 3)
      writeFileSync(`visual-diff/${name}-old.png`, PNG.sync.write(a));
      writeFileSync(`visual-diff/${name}-new.png`, PNG.sync.write(b));
    }
    if (a.width !== b.width || a.height !== b.height) {
      writeFileSync(`visual-diff/${name}-old.png`, PNG.sync.write(a));
      writeFileSync(`visual-diff/${name}-new.png`, PNG.sync.write(b));
      console.log(`SIZE  ${name}: old ${a.width}x${a.height}, new ${b.width}x${b.height}`);
      failed++;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    if (n > 0) {
      writeFileSync(`visual-diff/${name}-diff.png`, PNG.sync.write(diff));
      console.log(`DIFF  ${name}: ${n} px`);
      failed++;
    } else console.log(`same  ${name}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
