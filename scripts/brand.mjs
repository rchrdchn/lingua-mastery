// Renders brand PNGs from the SVG logo with Playwright (system Chrome). Run by hand
// after changing src/brand/*.svg: node scripts/brand.mjs. Outputs are committed.
import { chromium } from 'playwright';
import fs from 'node:fs';

const mark = fs.readFileSync('src/brand/logo-a-bubble.svg', 'utf8');
const inner = mark.slice(mark.indexOf('</title>') + 8, mark.lastIndexOf('</svg>')).trim();
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#fff3e4"/><g transform="translate(7 6) scale(.78)">${inner}</g></svg>`;
fs.writeFileSync('src/brand/icon-app.svg', appIcon);
fs.writeFileSync('src/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`);

const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
const pg = await b.newPage();
async function svgPng(svg, out, w, h = w) {
  await pg.setViewportSize({ width: w, height: h });
  await pg.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
  await pg.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
}
await svgPng(mark, 'src/favicon-32.png', 32);
await svgPng(appIcon, 'src/apple-touch-icon.png', 180);
await svgPng(appIcon, 'src/icon-192.png', 192);
await svgPng(appIcon, 'src/icon-512.png', 512);
for (const v of ['logo-a-bubble', 'logo-b-ltongue', 'logo-c-accent']) await svgPng(fs.readFileSync(`src/brand/${v}.svg`, 'utf8'), `screenshots/ux/${v}.png`, 256);

// Open Graph card, 1200x630.
await pg.setViewportSize({ width: 1200, height: 630 });
await pg.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:#fff3e4;font-family:ui-rounded,system-ui,'Noto Sans','Noto Sans CJK SC',sans-serif;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;color:#13201b">
<div style="flex:none">${mark.replace('<svg ', '<svg width="300" height="300" ')}</div>
<div><div style="font-size:84px;font-weight:900;letter-spacing:-2px;line-height:1">Lingua Magna</div>
<div style="font-size:44px;font-weight:800;margin-top:22px;line-height:1.15">Don't just learn a language.<br><span style="color:#ff4f64">Master it.</span></div>
<div style="display:flex;gap:12px;margin-top:30px;font-size:28px;font-weight:800;align-items:flex-start;flex-wrap:nowrap">${['你好', 'hola', 'bonjour', 'ciao', 'olá', 'Hallo'].map(w => `<span style="background:#fff;border-radius:999px;padding:8px 18px;box-shadow:0 3px 0 #e6e3da;white-space:nowrap">${w}</span>`).join('')}</div></div></body></html>`);
await pg.screenshot({ path: 'src/og.png' });
await b.close();
console.log('brand: favicon, app icons, og.png and logo variants written');
