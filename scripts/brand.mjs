// Renders brand files from the v3 logo with Playwright (system Chrome). Run by hand
// after changing src/brand/v3/*.svg (python3 scripts/logo3.py): node scripts/brand.mjs. Outputs are committed.
// Mark: talking tongue (bubble-tongue). Header: mark + name lettering, src/_includes/logo.njk (generated here, ink as currentColor).
import { chromium } from 'playwright';
import fs from 'node:fs';

const strip = s => s.replace(/<title>.*?<\/title>\n?/, '');
const tile = strip(fs.readFileSync('src/brand/v3/bubble-tongue.svg', 'utf8'));
const word = strip(fs.readFileSync('src/brand/v3/name.svg', 'utf8'));
const vb = word.match(/viewBox="([^"]+)"/)[1];
const wordBody = word.slice(word.indexOf('>') + 1, word.lastIndexOf('</svg>')).trim();
const tileBody = tile.slice(tile.indexOf('>') + 1, tile.lastIndexOf('</svg>')).trim();
fs.writeFileSync('src/_includes/logo.njk', `<svg class="mk" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${tileBody}</svg><svg class="wm" viewBox="${vb}" aria-hidden="true" focusable="false">${wordBody.replaceAll('fill="#13201b"', 'fill="currentColor"')}</svg>`);
// Favicon keeps the rounded tile; app icons are full-bleed squares (iOS and Android mask the corners).
fs.writeFileSync('src/favicon.svg', tile);
const appIcon = tile.replace(' rx="14"', '');
fs.writeFileSync('src/brand/icon-app.svg', appIcon);

const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
const pg = await b.newPage();
async function svgPng(svg, out, w, h = w) {
  await pg.setViewportSize({ width: w, height: h });
  await pg.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
  await pg.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
}
await svgPng(tile, 'src/favicon-32.png', 32);
await svgPng(appIcon, 'src/apple-touch-icon.png', 180);
await svgPng(appIcon, 'src/icon-192.png', 192);
await svgPng(appIcon, 'src/icon-512.png', 512);

// Open Graph card, 1200x630.
await pg.setViewportSize({ width: 1200, height: 630 });
await pg.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:#f7f6f1;font-family:Outfit,system-ui,'Noto Sans','Noto Sans CJK SC',sans-serif;display:flex;align-items:center;gap:60px;padding:0 90px;box-sizing:border-box;color:#13201b">
<div style="flex:none">${tile.replace('<svg ', '<svg width="260" height="260" ')}</div>
<div>${word.replace('<svg ', '<svg width="640" style="display:block;margin-left:-2px" ')}
<div style="font-size:46px;font-weight:800;margin-top:26px;line-height:1.15;letter-spacing:-.5px">Don't just learn a language.<br><span style="color:#0f7a5c">Master it.</span></div>
<div style="display:flex;gap:12px;margin-top:30px;font-size:28px;font-weight:700;align-items:flex-start;flex-wrap:nowrap">${['你好', 'hola', 'bonjour', 'ciao', 'olá', 'Hallo'].map(w => `<span style="background:#fff;border-radius:999px;padding:8px 18px;box-shadow:0 3px 0 #e6e3da;white-space:nowrap">${w}</span>`).join('')}</div></div></body></html>`);
await pg.waitForTimeout(200);
await pg.screenshot({ path: 'src/og.png' });
await b.close();
console.log('brand: header logo, favicon, app icons and og.png written');
