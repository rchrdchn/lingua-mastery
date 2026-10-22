// Presentation sheets for logo v3: node scripts/logo3-sheet.mjs [id]
import { chromium } from 'playwright';
import fs from 'node:fs';
const C = [
  ['l', 'L', 'Ultra-minimal monogram. One geometric L whose foot ends round, like a tongue tip.'],
  ['lm', 'LM', 'Ligature monogram: the L stem is also the M, the L foot underlines it.'],
  ['bubble-tongue', 'Talking tongue', 'A speech bubble whose tail is a rounded tongue. One shape.'],
  ['bubble-l', 'Bubble L', 'A speech bubble with the L of Lingua cut out of it.'],
  ['wordmark', 'Wordmark', 'Lingua Magna in Outfit ExtraBold. The dot of the i is a tiny speech bubble.', 'wordmark-icon'],
];
const only = process.argv[2];
const rd = n => fs.readFileSync(`src/brand/v3/${n}.svg`, 'utf8').replace(/<title>.*?<\/title>/, '');
const sized = (svg, s, extra = '') => svg.replace('<svg ', `<svg width="${s}" height="${s}" ${extra} `);
const mono = svg => svg.replaceAll('#0f7a5c', '#13201b');
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
const pg = await b.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 2 });
for (const [id, name, line, iconId] of C) {
  if (only && only !== id) continue;
  const main = rd(id), icon = rd(iconId || id), wide = !!iconId;
  const at = s => sized(icon, s);
  const hero = wide
    ? `<div style="display:grid;gap:40px;justify-items:center">${main.replace('<svg ', '<svg width="380" ')}<div style="display:flex;gap:24px">${at(130)}<div style="background:#13201b;border-radius:30px;padding:0 18px;display:flex;align-items:center;height:130px;box-sizing:border-box">${main.replace('<svg ', '<svg width="200" ').replaceAll('#13201b', '#ffffff')}</div></div></div>`
    : `<div style="width:360px;height:360px;border-radius:79px;box-shadow:0 18px 40px rgba(19,32,27,.2)">${at(360)}</div>`;
  const headerMark = wide ? main.replace('<svg ', '<svg height="26" ') : `${sized(icon, 32)}<span>Lingua Magna</span>`;
  await pg.setContent(`<html><body style="margin:0;width:1200px;height:700px;background:#f7f6f1;font-family:Outfit,system-ui,sans-serif;color:#13201b;display:grid;grid-template-columns:400px 1fr;align-items:center;padding:0 60px;box-sizing:border-box;gap:50px">
  ${hero}
  <div>
    <div style="font-size:15px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b756f">Logo option</div>
    <div style="font-size:52px;font-weight:900;letter-spacing:-1px;margin:4px 0 6px">${name}</div>
    <div style="font-size:22px;color:#4a554f;max-width:600px;line-height:1.35">${line}</div>
    <div style="display:flex;align-items:flex-end;gap:24px;margin:30px 0 26px">
      ${[96, 64, 32, 16].map(s => `<div style="text-align:center">${at(s)}<div style="font-size:12px;color:#6b756f;margin-top:6px">${s}px</div></div>`).join('')}
      <div style="text-align:center;background:#13201b;border-radius:14px;padding:12px">${at(48)}<div style="font-size:12px;color:#c9d1cc;margin-top:6px">on dark</div></div>
      <div style="text-align:center;background:#fff;border-radius:14px;padding:12px;border:1px solid #e2e4e0">${sized(mono(icon), 48)}<div style="font-size:12px;color:#6b756f;margin-top:6px">one color</div></div>
    </div>
    <div style="display:flex;gap:18px;align-items:center">
      <div style="width:200px;background:#dfe3e0;border-radius:10px 10px 0 0;padding:8px 12px;display:flex;align-items:center;gap:8px;font-size:13px;color:#333;font-family:system-ui">${at(16)}<span>Lingua Magna</span><span style="margin-left:auto;color:#888">×</span></div>
      <div style="width:340px;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.08);padding:10px 14px;display:flex;align-items:center;gap:9px;font-weight:800;font-size:20px;letter-spacing:-.3px">${headerMark}<span style="margin-left:auto;background:#0f7a5c;color:#fff;border-radius:12px;padding:7px 13px;font-size:15px;box-shadow:0 3px 0 #0a5c45">Practice</span></div>
    </div>
  </div></body></html>`);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `screenshots/ux/logo3-${id}.png` });
  console.log(`screenshots/ux/logo3-${id}.png`);
}
await b.close();
