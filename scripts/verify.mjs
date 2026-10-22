// End-to-end check with Playwright (uses the system Chrome):
// Mandarin HSK 1 placement -> lesson -> practice -> review, plus a word page and
// a Spanish typed drill. Fails on any console error. Screenshots go to screenshots/.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const PORT = 8765, BASE = `http://localhost:${PORT}`;
const srv = await serve(PORT);
fs.mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
const log = (...a) => console.log('verify:', ...a);
const shot = async name => { await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false }); log('screenshot', `screenshots/${name}.png`); };

// Answer the current exercise. right=true picks the correct answer.
async function answer(right = true) {
  const ex = await page.evaluate(() => window.__lmEx);
  if (ex.type === 'write') {
    // Stroke drawing is not automated; use the hint button (counts as a miss).
    await page.click('.ex button.btn.small');
  } else if (ex.type === 'typed') {
    await page.fill('input.typed', right ? ex.answer : 'zzz'); await page.press('input.typed', 'Enter');
  } else {
    const pickV = right ? ex.answer : ex.choices.find(c => c !== ex.answer);
    await page.locator('button.choice').filter({ has: page.locator(`xpath=self::*[@data-v=${JSON.stringify(pickV)}]`) }).first().click();
  }
  await page.waitForSelector('#next:not([hidden])');
  return ex;
}
async function runSession(rightFn = () => true, max = 20) {
  const seen = [];
  for (let i = 0; i < max; i++) {
    if (!(await page.$('.ex'))) break;
    seen.push(await answer(rightFn(i)));
    await page.click('#next');
  }
  return seen;
}

try {
  // 1. Placement: pass the first HSK 1 band, fail the second.
  await page.goto(`${BASE}/learn/?pack=zh&base=en&placement=1`);
  await page.waitForSelector('#placement-intro');
  await page.click('#start');
  await page.waitForSelector('.ex');
  await shot('1-placement-question');
  await runSession(() => true, 5);
  log('band 1 answered correctly');
  await runSession(() => false, 5);
  await page.waitForSelector('#placement-done');
  log('placement result:', (await page.textContent('#placement-done .lead')).trim());

  // 2. Continue -> a lesson for the next concept, then a practice session.
  await page.click('#continue');
  await page.waitForSelector('[data-lesson], .ex, .card h1');
  if (await page.$('[data-lesson]')) {
    log('lesson:', (await page.textContent('[data-lesson] h1')).trim());
    await shot('2-lesson');
    await page.click('#start');
  }
  const s1 = await runSession(i => i % 5 !== 3);
  log('session 1 exercise types:', [...new Set(s1.map(e => e.type))].join(','), 'modes:', [...new Set(s1.map(e => e.mode))].join(','));
  await page.waitForSelector('#results');
  log('results:', (await page.textContent('#results .lead')).trim());

  // 3. Review: move every review card's due date into the past, then continue.
  await page.evaluate(() => {
    const k = 'lm:v1:zh:en'; const p = JSON.parse(localStorage.getItem(k));
    for (const c of Object.values(p.cards)) c.due = Date.now() - 1000;
    p.xpSinceCheck = 0; localStorage.setItem(k, JSON.stringify(p));
  });
  await page.goto(`${BASE}/learn/?pack=zh&base=en`);
  await page.waitForSelector('#continue');
  await page.click('#continue');
  await page.waitForSelector('[data-lesson], .ex');
  if (await page.$('[data-lesson]')) await page.click('#start');
  let reviewSeen = false;
  for (let i = 0; i < 12 && (await page.$('.ex')); i++) {
    const ex = await page.evaluate(() => window.__lmEx);
    if (ex.mode === 'review' && !reviewSeen) { reviewSeen = true; await shot('3-review'); }
    await answer(true); await page.click('#next');
  }
  if (!reviewSeen) throw new Error('no review exercise appeared after cards came due');
  log('review exercises appeared in session 2');
  await page.goto(`${BASE}/learn/?pack=zh&base=en`);
  await page.waitForSelector('.dash');
  const stats = await page.$$eval('.stat', els => els.map(e => e.textContent));
  log('dashboard stats:', stats.join(' | '));
  await shot('4-dashboard');

  // 4. A Spanish session with typed recall, English from Spanish, and a word page.
  await page.goto(`${BASE}/learn/?pack=es`);
  await page.click('#continue'); await page.waitForSelector('[data-lesson], .ex');
  if (await page.$('[data-lesson]')) await page.click('#start');
  await runSession(() => true, 10);
  await page.goto(`${BASE}/learn/?pack=en&base=es`);
  await page.waitForSelector('.dash'); log('ESL dashboard (es):', (await page.textContent('#continue')).trim());
  await page.goto(`${BASE}/mandarin/words/${encodeURIComponent('朋友')}/`);
  await page.waitForSelector('h1'); await shot('5-word-page');
  await page.goto(`${BASE}/mandarin/characters/${encodeURIComponent('好')}/`);
  await page.waitForSelector('#stroke svg', { timeout: 5000 });
  log('character stroke animation rendered');
} catch (e) {
  errors.push('FLOW: ' + (e.stack || e));
  await page.screenshot({ path: 'screenshots/error.png' }).catch(() => {});
} finally {
  await browser.close(); srv.close();
}
const real = errors.filter(e => !/favicon/.test(e));
if (real.length) { console.error('verify: FAILED\n' + real.join('\n')); process.exit(1); }
log('OK, no console errors');
