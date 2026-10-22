// Header-to-content spacing check: node scripts/spacing-shots.mjs (after npm run build).
// Measures the gap between the sticky header and the first visible content on each page template.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const PORT = 8769, BASE = process.env.SPACING_BASE || `http://localhost:${PORT}`;
const srv = process.env.SPACING_BASE ? null : await serve(PORT);
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
const pages = ['/', '/mandarin/', '/mandarin/hsk-1/', '/mandarin/words/一些/', '/mandarin/characters/七/', '/mandarin/grammar/ba-suggestions/', '/learn/', '/learn/?pack=zh&base=en', '/about/', '/spanish/'];
const errors = []; let bad = 0;
for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 800 }, deviceScaleFactor: 2, isMobile: w < 600, hasTouch: w < 600 });
  for (const path of pages) {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push(`${w} ${path}: ${e}`));
    await pg.goto(BASE + encodeURI(path), { waitUntil: 'networkidle' }); await pg.waitForTimeout(300);
    const gap = await pg.evaluate(() => {
      const hb = document.querySelector('header.top, .top').getBoundingClientRect().bottom;
      let top = Infinity;
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (r.height > 0 && r.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && (el.children.length === 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0)) top = Math.min(top, r.top);
      }
      return Math.round(top - hb);
    });
    const ok = gap >= 16 && gap <= (path === '/' ? 120 : 48); // the home hero has its own top padding
    if (!ok) bad++;
    console.log(`spacing: ${w}px ${path} gap ${gap}px ${ok ? 'ok' : 'BAD'}`);
    if (path.startsWith('/learn/?pack=zh')) await pg.screenshot({ path: `screenshots/ux/${w < 600 ? 'm17' : 'd4'}-dashboard-spacing.png`, clip: { x: 0, y: 0, width: w, height: w < 600 ? 420 : 380 } });
    await pg.close();
  }
  await ctx.close();
}
await b.close(); srv?.close();
if (errors.length) { console.log(errors.join('\n')); bad++; }
console.log(bad ? 'spacing: FAIL' : 'spacing: OK');
process.exit(bad ? 1 : 0);
