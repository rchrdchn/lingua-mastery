// Audio check: taps listen buttons and confirms bundle requests return 200 and the shared
// <audio> element reaches 'playing'. Chrome runs with autoplay allowed; WebKit (iPhone
// emulation) runs when installed (npx playwright install webkit). Run after `npm run build`.
import { chromium, webkit, devices } from 'playwright';
import { serve } from './serve.mjs';

// AUDIO_BASE=https://ux.linguamagna.pages.dev checks a deployed preview instead of _site
const PORT = 8767, BASE = process.env.AUDIO_BASE || `http://localhost:${PORT}`;
const srv = process.env.AUDIO_BASE ? null : await serve(PORT);
const results = []; let fail = 0;
const log = (...a) => console.log('audio:', ...a);

async function run(name, browserType, launchOpts, ctxOpts) {
  let b;
  try { b = await browserType.launch(launchOpts); } catch (e) { log(`${name}: not available (${String(e).split('\n')[0]})`); return; }
  const ctx = await b.newContext(ctxOpts); const pg = await ctx.newPage();
  const errors = [];
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('pageerror', e => errors.push(String(e)));
  const reqs = [];
  pg.on('response', r => { if (r.url().includes('/a/')) reqs.push(r.status()); });
  const stat = () => pg.evaluate(() => ({ ...(window.__lmAudio || {}) }));
  const tap = async (sel, label, wait = 4000) => {
    const before = await stat();
    await pg.locator(sel).first().click();
    const t0 = Date.now(); let s;
    while (Date.now() - t0 < wait) { s = await stat(); if ((s.playing || 0) > (before.playing || 0) || (s.failed || 0) > (before.failed || 0)) break; await pg.waitForTimeout(100); }
    const ok = (s.playing || 0) > (before.playing || 0) && s.last === 'file';
    results.push(`${name} ${label}: ${ok ? 'playing' : 'NOT playing'} (last=${s.last}, resolved=${s.resolved}, failed=${s.failed}, src=${s.src})`);
    if (!ok) fail++;
  };
  await pg.goto(`${BASE}/mandarin/words/${encodeURIComponent('朋友')}/`);
  await pg.waitForTimeout(800);   // idle prefetch
  await tap('button.say.big', 'zh word page, word');
  await tap('.exlist button.say', 'zh word page, sentence');
  await pg.goto(`${BASE}/spanish/words/hola/`);
  await tap('button.say.big', 'es word page, word (cold, no prefetch wait)');
  await pg.goto(`${BASE}/english/words/about/`); await pg.waitForTimeout(800);
  await tap('button.say.big', 'en word page, word');
  await tap('.exlist button.say', 'en word page, sentence');
  await pg.goto(`${BASE}/portuguese/words/amigo/`); await pg.waitForTimeout(800);
  await tap('button.say.big', 'pt word page, word');
  await tap('.exlist button.say', 'pt word page, sentence');
  await pg.goto(`${BASE}/french/words/ami/`); await pg.waitForTimeout(800);
  await tap('button.say.big', 'fr word page, word');
  await tap('.exlist button.say', 'fr word page, sentence');
  await pg.goto(`${BASE}/`); await pg.waitForTimeout(800);
  await tap('#demo .dcard button.say', 'home demo, question word');
  await tap('#cards button.say', 'home example card');
  await pg.goto(`${BASE}/mandarin/characters/${encodeURIComponent('好')}/`);
  await tap('button.say.big', 'zh character page');
  await pg.goto(`${BASE}/learn/?pack=fr&base=en`); await pg.waitForSelector('.dash');
  await pg.click('#continue'); await pg.waitForSelector('[data-lesson], .ex');
  if (await pg.$('[data-lesson]')) { await pg.waitForTimeout(600); await tap('button.flip', 'fr lesson flip card'); await pg.click('#start'); }
  await pg.waitForSelector('.ex');
  if (await pg.$('.ex .say')) await tap('.ex .say', 'fr exercise prompt');
  const bad = reqs.filter(s => s !== 200 && s !== 304);
  results.push(`${name} bundle requests: ${reqs.length}, non-200: ${bad.length}`);
  if (bad.length) fail++;
  if (errors.length) { results.push(`${name} console errors: ${errors.join(' | ')}`); fail++; }
  await b.close();
}

await run('chrome', chromium, { channel: process.env.PW_CHANNEL || 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] }, { viewport: { width: 390, height: 844 } });
// Real gesture policy: no autoplay flag, taps are real clicks.
await run('chrome-gesture', chromium, { channel: process.env.PW_CHANNEL || 'chrome', headless: true }, { viewport: { width: 390, height: 844 } });
await run('webkit-iphone', webkit, { headless: true }, { ...devices['iPhone 13'] });
srv?.close();
for (const r of results) log(r);
if (fail) { log(`${fail} problem(s)`); process.exit(1); }
log('OK');
