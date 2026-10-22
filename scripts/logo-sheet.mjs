// Presentation sheets for logo concepts: node scripts/logo-sheet.mjs
// Each sheet: large app icon, real-size favicons, a browser tab and the mobile header.
import { chromium } from 'playwright';
import fs from 'node:fs';
const C = [
  ['l-tongue', 'L-tongue', 'One confident tongue shape that is also the L of Lingua.'],
  ['flag', 'Tongue flag', 'A tongue flying like a banner: loud, proud, a little rebellious.'],
  ['bubble-mouth', 'Talking bubble', 'A speech bubble that grins and sticks its tongue out.'],
  ['m-mark', 'M-tongue', 'Minimal geometric M with a tongue dropping from the middle.'],
];
const only = process.argv[2];
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
const pg = await b.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1 });
for (const [id, name, line] of C) {
  if (only && only !== id) continue;
  const svg = fs.readFileSync(`src/brand/v2/${id}.svg`, 'utf8').replace(/<title>.*?<\/title>/, '');
  const at = (s, extra = '') => svg.replace('<svg ', `<svg width="${s}" height="${s}" ${extra} `);
  await pg.setContent(`<html><body style="margin:0;width:1200px;height:700px;background:#f7f6f1;font-family:ui-rounded,system-ui,'Noto Sans',sans-serif;color:#13201b;display:grid;grid-template-columns:400px 1fr;align-items:center;padding:0 60px;box-sizing:border-box;gap:50px">
  <div style="filter:drop-shadow(0 18px 30px rgba(19,32,27,.22))">${at(380)}</div>
  <div>
    <div style="font-size:15px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b756f">Concept</div>
    <div style="font-size:52px;font-weight:900;letter-spacing:-1px;margin:4px 0 6px">${name}</div>
    <div style="font-size:22px;color:#4a554f;max-width:560px;line-height:1.35">${line}</div>
    <div style="display:flex;align-items:flex-end;gap:26px;margin:34px 0 30px">
      ${[96, 64, 32, 16].map(s => `<div style="text-align:center">${at(s)}<div style="font-size:12px;color:#6b756f;margin-top:6px">${s}px</div></div>`).join('')}
      <div style="text-align:center;background:#13201b;border-radius:14px;padding:12px">${at(48)}<div style="font-size:12px;color:#c9d1cc;margin-top:6px">on dark</div></div>
    </div>
    <div style="display:flex;gap:18px;align-items:center">
      <div style="width:200px;background:#dfe3e0;border-radius:10px 10px 0 0;padding:8px 12px;display:flex;align-items:center;gap:8px;font-size:13px;color:#333">${at(16)}<span>Lingua Magna</span><span style="margin-left:auto;color:#888">×</span></div>
      <div style="width:330px;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.08);padding:10px 14px;display:flex;align-items:center;gap:9px;font-weight:850;font-size:19px">${at(32, 'style="border-radius:8px"')}<span>Lingua Magna</span><span style="margin-left:auto;background:#0f7a5c;color:#fff;border-radius:12px;padding:7px 13px;font-size:15px;box-shadow:0 3px 0 #0a5c45">Practice</span></div>
    </div>
  </div></body></html>`);
  await pg.screenshot({ path: `screenshots/ux/logo2-${id}.png` });
  console.log(`screenshots/ux/logo2-${id}.png`);
}
await b.close();
