// UX screenshot pass (mobile 390x844 + desktop 1280x800) and a reduced-motion check.
// Fails on console errors. Output: screenshots/ux/. Run after `npm run build`.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const PORT = 8766, BASE = `http://localhost:${PORT}`, OUT = 'screenshots/ux';
const srv = await serve(PORT);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
const errors = [];
const log = (...a) => console.log('ux:', ...a);
async function ctx(opts) {
  const c = await browser.newContext(opts); const p = await c.newPage();
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push(String(e)));
  return [c, p];
}
const shot = async (p, n, full = false) => { await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }); log(`${OUT}/${n}.png`); };
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const answerOf = p => p.evaluate(() => {
  const d = JSON.parse(document.getElementById('demo-data').textContent);
  const on = document.querySelector('.dlangs [aria-pressed="true"]')?.dataset.l || d[0].id;
  const L = d.find(l => l.id === on) || d[0]; const w = document.querySelector('.dcard .w')?.firstChild?.textContent;
  return L.qs.find(q => q.w === w)?.a;
});
async function demoAnswer(p, right) {
  const a = await answerOf(p);
  if (right) await p.locator('.dcard button.choice', { hasText: a }).first().click();
  else await p.locator('.dcard button.choice:not([disabled])').filter({ hasNotText: a }).first().click();
}

// Mobile
{
  const [c, p] = await ctx(mobile);
  await p.goto(BASE + '/'); await p.waitForTimeout(400);
  await shot(p, 'm1-home-hero');
  await p.locator('#demo').scrollIntoViewIfNeeded();
  await demoAnswer(p, true); await p.waitForTimeout(180);
  await shot(p, 'm2-demo-correct');
  await p.waitForTimeout(900); await demoAnswer(p, false); await p.waitForTimeout(150);
  await shot(p, 'm2b-demo-wrong');
  await p.waitForTimeout(1400); await demoAnswer(p, true); await p.waitForTimeout(1300);
  await p.locator('.dfin').waitFor();
  await p.locator('#demo').scrollIntoViewIfNeeded();
  await shot(p, 'm3-demo-finish');
  // perfect run in Spanish for the mastery/unlock moment
  await p.click('.dlangs button[data-l="es"]');
  for (let i = 0; i < 3; i++) { await p.waitForSelector('.dcard button.choice:not([disabled])'); await demoAnswer(p, true); await p.waitForTimeout(950); }
  await p.locator('.dfin').waitFor(); await p.waitForTimeout(250);
  await p.locator('#demo').scrollIntoViewIfNeeded();
  await shot(p, 'm4-mastered-unlock');
  await p.locator('#cards').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await shot(p, 'm5-example-cards');

  // Lesson + exercise in the app
  await p.goto(BASE + '/learn/?pack=es&base=en'); await p.waitForSelector('.dash');
  await shot(p, 'm6-dashboard');
  await p.locator('.tree').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
  await shot(p, 'm7-skill-tree');
  await p.click('#continue'); await p.waitForSelector('[data-lesson], .ex');
  if (await p.$('[data-lesson]')) { await p.waitForTimeout(1200); await shot(p, 'm8-lesson'); await p.click('#start'); }
  await p.waitForSelector('.ex'); await p.waitForTimeout(400);
  await shot(p, 'm9-exercise');
  // answer through the session for the results / unlock moment
  for (let i = 0; i < 30; i++) {
    if (!(await p.$('.ex'))) break;
    const ex = await p.evaluate(() => window.__lmEx);
    if (!ex) break;
    if (ex.type === 'write') await p.click('.ex button.btn.small');
    else if (ex.type === 'typed') { await p.fill('input.typed', ex.answer); await p.press('input.typed', 'Enter'); }
    else await p.locator(`button.choice[data-v=${JSON.stringify(ex.answer)}]`).first().click();
    await p.waitForSelector('#next:not([hidden])');
    if (i === 0) { await p.waitForTimeout(120); await shot(p, 'm10-exercise-correct'); }
    await p.click('#next'); await p.waitForTimeout(60);
  }
  await p.waitForSelector('#results'); await p.waitForTimeout(900);
  await shot(p, 'm11-results-unlock');
  await p.goto(BASE + '/mandarin/words/' + encodeURIComponent('朋友') + '/'); await p.waitForTimeout(300);
  await shot(p, 'm12-word-page');
  await p.goto(BASE + '/spanish/'); await p.waitForTimeout(300);
  await shot(p, 'm13-course-hub');
  await p.goto(BASE + '/learn/?pack=zh&base=en&placement=1'); await p.waitForSelector('#placement-intro');
  await shot(p, 'm14-placement-intro');
  await c.close();
}
// Desktop
{
  const [c, p] = await ctx({ viewport: { width: 1280, height: 800 } });
  await p.goto(BASE + '/'); await p.waitForTimeout(400);
  await shot(p, 'd1-home');
  await p.goto(BASE + '/mandarin/words/' + encodeURIComponent('朋友') + '/'); await p.waitForTimeout(300);
  await shot(p, 'd2-word-page');
  await c.close();
}
// Reduced motion: no animations running, no confetti
{
  const [c, p] = await ctx({ ...mobile, reducedMotion: 'reduce' });
  await p.goto(BASE + '/'); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await p.waitForSelector('.dcard button.choice:not([disabled])'); await demoAnswer(p, true); await p.waitForTimeout(950); }
  await p.locator('.dfin').waitFor();
  const r = await p.evaluate(() => ({ bursts: document.querySelectorAll('.burst, .confetti').length, anims: document.getAnimations().filter(a => a.playState === 'running' && (a.effect?.getTiming().duration ?? 0) > 50).length }));
  log('reduced motion:', JSON.stringify(r));
  if (r.bursts || r.anims) errors.push('reduced motion: animations still running ' + JSON.stringify(r));
  const s0 = await p.evaluate(() => document.getElementById('cards')?.scrollLeft); await p.waitForTimeout(3600);
  const s1 = await p.evaluate(() => document.getElementById('cards')?.scrollLeft);
  if (s0 !== s1) errors.push('reduced motion: carousel auto-advanced');
  await c.close();
}
await browser.close(); srv.close();
if (errors.length) { console.error('ux: console errors:\n' + errors.join('\n')); process.exit(1); }
log('OK, no console errors');
