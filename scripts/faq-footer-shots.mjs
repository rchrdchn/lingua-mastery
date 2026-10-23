// FAQ + footer check: node scripts/faq-footer-shots.mjs [outdir] (after npm run build, or FF_BASE=https://...).
// Chromium + WebKit at 1440x900 and iPhone 15. Fails on console errors or horizontal overflow.
import { chromium, webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';
const OUT = process.argv[2] || 'screenshots/ux/faq-footer'; mkdirSync(OUT, { recursive: true });
const PORT = 8771, BASE = process.env.FF_BASE || `http://localhost:${PORT}`;
const srv = process.env.FF_BASE ? null : await serve(PORT);
const PAGES = (process.env.FF_PAGES || '/,/spanish/,/english/,/spanish/words/' + (process.env.FF_WORD || '') + ',/spanish/a1/,/learn/,/about/,/credits/,/privacy/').split(',');
const errors = []; let bad = 0;
const iph = devices['iPhone 15'];
for (const [bn, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await bt.launch();
  for (const [dn, opts] of [['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }], ['iphone15', bn === 'webkit' ? iph : { ...iph, defaultBrowserType: undefined }]]) {
    const { defaultBrowserType, ...o } = opts;
    const ctx = await b.newContext(o);
    for (const path of PAGES) {
      const slug = path.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'home';
      const pg = await ctx.newPage();
      pg.on('console', m => { if (m.type() === 'error') errors.push(`${bn}/${dn}${path}: ${m.text()}`); });
      pg.on('pageerror', e => errors.push(`${bn}/${dn}${path}: ${e}`));
      await pg.goto(BASE + path, { waitUntil: 'networkidle' });
      const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) { bad++; console.log(`OVERFLOW ${bn}/${dn}${path}`); }
      const faq = pg.locator('.faq');
      if (await faq.count()) {
        await pg.locator('.qa summary').first().click(); await pg.waitForTimeout(450);
        const open = await pg.locator('.qa').first().evaluate(d => d.open);
        if (!open) { bad++; console.log(`FAQ did not open ${bn}/${dn}${path}`); }
        await faq.scrollIntoViewIfNeeded();
        await faq.screenshot({ path: `${OUT}/${bn}-${dn}-${slug}-faq.png` });
      }
      const foot = pg.locator('footer.foot'); await foot.scrollIntoViewIfNeeded();
      await foot.screenshot({ path: `${OUT}/${bn}-${dn}-${slug}-footer.png` });
      if (slug === 'home') await pg.screenshot({ path: `${OUT}/${bn}-${dn}-home-full.png`, fullPage: true });
      await pg.close();
    }
    await ctx.close();
  }
  await b.close();
}
srv?.close();
if (errors.length) { console.log(errors.join('\n')); bad++; }
console.log(bad ? 'faq-footer: FAIL' : 'faq-footer: OK, no console errors');
process.exit(bad ? 1 : 0);
