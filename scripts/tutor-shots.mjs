// Tutor card preview: TUTOR_PREVIEW=1 npx eleventy --quiet && node scripts/tutor-shots.mjs [outdir]
// WebKit iPhone 15 + Chromium 1440x900: grammar lesson card, footer link, /learn/ session-complete card.
// Fails on console errors, horizontal overflow, or a missing card. Rebuild without the flag afterwards.
import { chromium, webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';
const OUT = process.argv[2] || 'screenshots/ux/tutor'; mkdirSync(OUT, { recursive: true });
const PORT = 8772, BASE = `http://localhost:${PORT}`, LESSON = process.env.TUTOR_LESSON || '/spanish/grammar/estar-to-be/';
const srv = await serve(PORT);
const errors = []; let bad = 0;
const runs = [['webkit-iphone15', webkit, devices['iPhone 15']], ['chromium-desktop', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]];
for (const [name, bt, { defaultBrowserType, ...o }] of runs) {
  const b = await bt.launch(); const ctx = await b.newContext(o); const pg = await ctx.newPage();
  pg.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  pg.on('pageerror', e => errors.push(`${name}: ${e}`));
  const overflow = async where => { if (await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) { bad++; console.log(`OVERFLOW ${name} ${where}`); } };
  // 1. Grammar lesson page.
  await pg.goto(BASE + LESSON, { waitUntil: 'networkidle' }); await overflow(LESSON);
  const card = pg.locator('aside.tutor');
  if (!(await card.count())) { bad++; console.log(`NO CARD ${name} ${LESSON}`); }
  else {
    const a = card.locator('a'); console.log(name, 'lesson card href', await a.getAttribute('href'), 'rel', await a.getAttribute('rel'), 'target', await a.getAttribute('target'));
    await card.scrollIntoViewIfNeeded(); await pg.evaluate(() => scrollBy(0, 120)); await pg.waitForTimeout(200);
    await pg.screenshot({ path: `${OUT}/${name}-lesson.png` });
    await card.screenshot({ path: `${OUT}/${name}-lesson-card.png` });
  }
  const foot = pg.locator('footer.foot'); await foot.scrollIntoViewIfNeeded();
  await foot.screenshot({ path: `${OUT}/${name}-footer.png` });
  // 2. /learn/ session-complete screen (Spanish).
  await pg.goto(`${BASE}/learn/?pack=es&base=en`, { waitUntil: 'networkidle' });
  await pg.waitForSelector('#continue, #beginner, #start');
  if (await pg.$('#beginner')) await pg.click('#beginner'); else await pg.click('#continue, #start');
  for (let i = 0; i < 40 && !(await pg.$('#results')); i++) {
    if (await pg.$('[data-lesson] #start')) { await pg.click('#start'); continue; }
    if (!(await pg.$('.ex'))) { await pg.waitForTimeout(200); continue; }
    const ex = await pg.evaluate(() => window.__lmEx);
    if (ex.type === 'write') await pg.click('.ex button.btn.small');
    else if (ex.type === 'typed') { await pg.fill('input.typed', ex.answer); await pg.press('input.typed', 'Enter'); }
    else await pg.locator(`button.choice[data-v=${JSON.stringify(ex.answer)}]`).first().click();
    await pg.waitForSelector('#next:not([hidden])'); await pg.click('#next');
  }
  await pg.waitForSelector('#results'); await pg.waitForTimeout(1300); await overflow('/learn/ results');
  const rc = pg.locator('#results aside.tutor');
  if (!(await rc.count())) { bad++; console.log(`NO CARD ${name} results`); }
  else console.log(name, 'results card href', await rc.locator('a').getAttribute('href'));
  await pg.screenshot({ path: `${OUT}/${name}-learn-results.png`, fullPage: true });
  await ctx.close(); await b.close();
}
srv.close();
if (errors.length) console.log('Console errors:\n' + errors.join('\n'));
console.log(bad || errors.length ? 'FAIL' : 'OK', `screenshots in ${OUT}`);
process.exit(bad || errors.length ? 1 : 0);
