// Header logo check: node scripts/header-shots.mjs (after npm run build). Fails on console errors.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const PORT = 8768, BASE = process.env.HEADER_BASE || `http://localhost:${PORT}`;
const srv = process.env.HEADER_BASE ? null : await serve(PORT);
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
const errors = []; let bad = 0;
for (const [name, w, h, path, extra] of [
  ['m15-header-logo', 390, 844, '/', {}],
  ['d3-header-logo', 1280, 800, '/', {}],
  ['m16-header-logo-dark', 390, 844, '/spanish/', { dark: true }],
]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 3 : 2, isMobile: w < 600, hasTouch: w < 600 });
  const pg = await ctx.newPage();
  pg.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  pg.on('pageerror', e => errors.push(`${name}: ${e}`));
  await pg.goto(BASE + path, { waitUntil: 'networkidle' });
  if (extra.dark) await pg.addStyleTag({ content: '.top{background:#13201b!important;border-color:#13201b!important}.top .logo{color:#fff!important}' });
  const box = await pg.locator('header .logo').boundingBox();
  const fav = await pg.evaluate(async () => (await fetch('/favicon.svg')).status);
  const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(`header: ${name} logo ${Math.round(box.width)}x${Math.round(box.height)} favicon ${fav} overflow=${overflow}`);
  if (!box || box.height < 20 || overflow) bad++;
  await pg.screenshot({ path: `screenshots/ux/${name}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
  await ctx.close();
}
await b.close(); srv?.close();
if (errors.length) { console.log(errors.join('\n')); bad++; }
console.log(bad ? 'header: FAIL' : 'header: OK, no console errors');
process.exit(bad ? 1 : 0);
