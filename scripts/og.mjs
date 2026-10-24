// Post-build: renders the 1200x630 share cards that built pages point to (see lib/og.js) into _site/og/.
// Cards are drawn as pure SVG paths, so the result does not depend on the fonts installed on the build
// machine (Cloudflare Pages has no CJK fonts):
//   - Latin text: Outfit ExtraBold / SemiBold (OFL) with DejaVu Sans Bold for pinyin tone marks Outfit
//     lacks, all in scripts/og-fonts/, measured and turned into paths with opentype.js;
//   - Chinese characters: stroke outlines from hanzi-writer-data (already used for stroke order).
// Text per card comes from the built page itself (h1, description, <title>), so new lessons and levels
// get a card on the next build with no extra step. Unchanged cards are skipped via a content hash cache
// in node_modules/.cache, which keeps local rebuilds fast; Cloudflare builds render all ~100 from scratch.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const opentype = require('opentype.js'); const { ogKey } = require('../lib/og.js');
const ROOT = process.cwd(), OUT = path.join(ROOT, '_site'), OG = path.join(OUT, 'og');
const t0 = Date.now();
const font = f => opentype.loadSync(path.join(ROOT, 'scripts/og-fonts', f));
const XB = font('Outfit-ExtraBold.ttf'), SB = font('Outfit-SemiBold.ttf'), FB = font('DejaVuSans-Bold.ttf');
const HW = path.join(ROOT, 'node_modules/hanzi-writer-data');
const hanzi = new Map(); const han = ch => { if (!hanzi.has(ch)) { const f = path.join(HW, ch + '.json'); hanzi.set(ch, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).strokes.join(' ') : null); } return hanzi.get(ch); };
const isCJK = ch => /[\u3400-\u9fff]/.test(ch);

// Split text into runs: Chinese characters (hanzi paths) or Latin (opentype, with fallback font).
function runs(text, f) {
  const out = []; let cur = null;
  for (const ch of text) {
    const kind = isCJK(ch) && han(ch) ? 'han' : f.charToGlyphIndex(ch) ? 'lat' : FB.charToGlyphIndex(ch) ? 'fb' : isCJK(ch) ? 'skip' : 'lat';
    if (kind === 'skip') continue;
    if (cur && cur.kind === kind) cur.t += ch; else out.push(cur = { kind, t: ch });
  }
  return out;
}
const HAN_W = 1.0, HAN_GAP = 0.04;
function width(text, f, size) {
  return runs(text, f).reduce((w, r) => w + (r.kind === 'han' ? [...r.t].length * size * (HAN_W + HAN_GAP) : (r.kind === 'fb' ? FB : f).getAdvanceWidth(r.t, size)), 0);
}
function draw(text, f, size, x, y, fill) {
  let d = '', hp = '';
  for (const r of runs(text, f)) {
    if (r.kind === 'han') {
      for (const ch of r.t) { const s = size / 1024; hp += `<path stroke="${fill}" stroke-width="${f === XB ? 34 : 22}" stroke-linejoin="round" transform="translate(${(x).toFixed(1)} ${(y - size * 0.86).toFixed(1)}) scale(${s.toFixed(4)} ${(-s).toFixed(4)}) translate(0 -900)" d="${han(ch)}"/>`; x += size * (HAN_W + HAN_GAP); }
    } else { const ff = r.kind === 'fb' ? FB : f; d += ff.getPath(r.t, x, y, size).toPathData(1); x += ff.getAdvanceWidth(r.t, size); }
  }
  return `<g fill="${fill}">${d ? `<path d="${d}"/>` : ''}${hp}</g>`;
}
function wrap(text, f, size, max, maxLines) {
  const words = text.split(/\s+/).filter(Boolean), lines = []; let l = '';
  for (const w of words) { const t = l ? l + ' ' + w : w; if (width(t, f, size) <= max || !l) l = t; else { lines.push(l); l = w; } }
  if (l) lines.push(l);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); let last = keep[maxLines - 1]; while (last && width(last + '…', f, size) > max) last = last.replace(/\s*\S+$/, ''); keep[maxLines - 1] = last + '…'; return keep; }
  return lines;
}
// Largest size (step 2) at which text fits in maxLines lines of width max.
function fitWrap(text, f, sizes, max, maxLines) {
  for (let s = sizes[0]; s >= sizes[1]; s -= 2) { const ls = wrap(text, f, s, max, 99); if (ls.length <= maxLines && ls.every(x => width(x, f, s) <= max)) return { size: s, lines: ls }; }
  return { size: sizes[1], lines: wrap(text, f, sizes[1], max, maxLines) };
}

const tile = fs.readFileSync('src/brand/v3/bubble-tongue.svg', 'utf8').replace(/<\?xml[^>]*>|<title>.*?<\/title>/g, '');
const tileBody = tile.slice(tile.indexOf('>') + 1, tile.lastIndexOf('</svg>'));
const name = fs.readFileSync('src/brand/v3/name.svg', 'utf8'), nameVb = name.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const nameBody = name.slice(name.indexOf('>') + 1, name.lastIndexOf('</svg>')).replace(/<title>.*?<\/title>/, '');
const LANG = {
  mandarin: { name: 'Mandarin', hi: '你好', hiMean: 'hello' }, spanish: { name: 'Spanish', hi: 'hola', hiMean: 'hello' },
  english: { name: 'English', hi: 'hello', hiMean: 'hola · olá · 你好' }, french: { name: 'French', hi: 'bonjour', hiMean: 'hello' },
  italian: { name: 'Italian', hi: 'ciao', hiMean: 'hello' }, portuguese: { name: 'Portuguese', hi: 'olá', hiMean: 'hello' },
  german: { name: 'German', hi: 'Hallo', hiMean: 'hello' },
};
const INK = '#13201b', GREEN = '#0f7a5c', CREAM = '#f7f6f1', MUTED = '#45564e';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function card({ kicker, title, hook, big, small }) {
  const L = 72, LW = 620;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${CREAM}"/>`;
  // Kicker pill
  const kw = width(kicker, SB, 26);
  s += `<rect x="${L}" y="64" width="${(kw + 44).toFixed(0)}" height="50" rx="25" fill="${GREEN}"/>` + draw(kicker, SB, 26, L + 22, 98, '#ffffff');
  // Title
  const T = fitWrap(title, XB, [76, 46], LW, 3); let y = 160 + T.size * 0.92;
  for (const ln of T.lines) { s += draw(ln, XB, T.size, L, y, INK); y += T.size * 1.08; }
  // Hook
  if (hook) { y += 14; const room = Math.floor((505 - y) / 40) + 1; if (room > 0) for (const ln of wrap(hook, SB, 30, LW, Math.min(3, room))) { s += draw(ln, SB, 30, L, y, MUTED); y += 40; } }
  // Brand row
  const ns = 34 / (nameVb[3]);
  s += `<svg x="${L}" y="530" width="60" height="60" viewBox="0 0 64 64">${tileBody}</svg><g transform="translate(${L + 78} ${560 + 34 * 0.5 - (nameVb[1] + nameVb[3]) * ns * 0.5}) scale(${ns.toFixed(4)}) translate(${-nameVb[0]} ${-nameVb[1]})" fill="${INK}">${nameBody.replace(/fill="#13201b"/g, '')}</g>`;
  // Hero panel: big sample word in the target language on brand green, like a flash card.
  const PX = 742, PW = 386, PY = 64, PH = 502;
  s += `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="36" fill="${GREEN}"/>`;
  s += `<rect x="${PX + 34}" y="${PY + 40}" width="${PW - 68}" height="300" rx="28" fill="#ffffff"/><rect x="${PX + 80}" y="${PY + 316}" width="70" height="90" rx="35" fill="#ffffff"/>`;
  let bs = 150; while (bs > 40 && width(big, XB, bs) > PW - 120) bs -= 4;
  const bw = width(big, XB, bs);
  s += draw(big, XB, bs, PX + (PW - bw) / 2, PY + 40 + 150 + bs * 0.36, INK);
  if (small) { let ss = 34; while (ss > 18 && width(small, SB, ss) > PW - 210) ss -= 2; s += draw(small, SB, ss, PX + 172, PY + 396, '#ffffff'); }
  s += draw('linguamagna.pages.dev', SB, 24, PX + 36, PY + PH - 34, '#cdeee2');
  return s + '</svg>';
}

const dec = s => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const firstSentence = s => { const m = s.match(/^(.{20,}?[.!?])(\s|$)/); let t = m ? m[1] : s; if (t.length > 130) { t = t.slice(0, 128).replace(/\s+\S*$/, '') + '…'; } return t; };
function cardFor(key, url, html) {
  const seg = decodeURI(url).split('/').filter(Boolean), lang = LANG[seg[0]];
  const h1 = dec((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]), title = dec((html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]);
  const desc = dec((html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1]);
  const count = n => n.toLocaleString('en-US');
  if (seg.length === 1) return { kicker: `LEARN ${lang.name.toUpperCase()} FREE`, title: h1, hook: firstSentence(desc), big: lang.hi, small: lang.hiMean };
  if (seg[1] === 'words') { const n = shared[key] || 0; return { kicker: `${lang.name.toUpperCase()} WORDS`, title: `${count(n)} ${lang.name} words with audio and examples`, hook: 'Meaning, real example sentences and free practice for every word. No account.', big: lang.hi, small: lang.hiMean }; }
  if (seg[1] === 'characters') { const n = shared[key] || 0; return { kicker: 'CHINESE CHARACTERS', title: `${count(n)} Chinese characters with stroke order`, hook: 'Meaning, pinyin, stroke order animations and writing practice, free.', big: '字', small: 'zì · character' }; }
  const lvl = (title.match(/\(([^)]+)\)\s*$/) || [, ''])[1] || (seg[1] !== 'grammar' ? h1.match(/^(?:\w+ )?((?:HSK|[ABC])\s?\d)/)?.[1] : '') || '';
  if (seg[1] === 'grammar') {
    const cjk = (h1.match(/[\u3400-\u9fff]+/) || [''])[0].slice(0, 3);
    return { kicker: `${lang.name.toUpperCase()} GRAMMAR${lvl ? ' · ' + lvl.toUpperCase() : ''}`, title: h1, hook: firstSentence(desc), big: cjk || lvl || lang.hi, small: cjk ? (h1.match(/\(([^)]+)\)/) || [, ''])[1] : cjk || lvl ? 'grammar lesson' : lang.hiMean };
  }
  const code = seg[1].replace(/^hsk-(\d)$/, 'HSK $1').replace(/^([abc]\d)$/, m => m.toUpperCase());
  const words = (h1.match(/(\d[\d,]*)\s+(?:most common\s+)?words/) || [, ''])[1];
  if (seg[1] === 'foundations') return { kicker: `${lang.name.toUpperCase()} FOUNDATIONS`, title: h1, hook: firstSentence(desc), big: 'mā má mǎ mà', small: 'the four tones' };
  return { kicker: `${lang.name.toUpperCase()} · ${code}`, title: h1, hook: firstSentence(desc), big: code, small: words ? `${words} words` : 'level' };
}

// Every og:image a built page points to.
const files = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!['assets', 'og', 'packs', 'a'].includes(f.name)) walk(p); } else if (f.name === 'index.html') files.push(p); } })(OUT);
const need = new Map(), shared = {};
// Counts on the shared cards use indexable pages only (the sitemap), matching what search shows.
const inSitemap = new Set([...fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8').matchAll(/<loc>[^<]*?\.dev([^<]*)<\/loc>/g)].map(m => encodeURI(decodeURI(m[1]))));
for (const f of files) {
  const url = '/' + path.relative(OUT, path.dirname(f)).split(path.sep).map(encodeURIComponent).join('/') + '/';
  const k = ogKey(url.replace(/^\/\/$/, '/')); if (!k) continue;
  const seg = decodeURI(url).split('/').filter(Boolean);
  if (seg.length === 3 && (seg[1] === 'words' || seg[1] === 'characters') && inSitemap.has(url)) shared[k] = (shared[k] || 0) + 1;
  if (!need.has(k)) need.set(k, { url, f });
}
fs.mkdirSync(OG, { recursive: true });
const CACHE = path.join(ROOT, 'node_modules/.cache/og'); fs.mkdirSync(CACHE, { recursive: true });
const ver = crypto.createHash('sha1').update(fs.readFileSync(new URL(import.meta.url))).digest('hex').slice(0, 8);
let made = 0, cached = 0, bytes = 0;
for (const [k, { url, f }] of need) {
  const svg = card(cardFor(k, url, fs.readFileSync(f, 'utf8')));
  const h = crypto.createHash('sha1').update(ver + svg).digest('hex').slice(0, 16), c = path.join(CACHE, h + '.png'), o = path.join(OG, k + '.png');
  if (fs.existsSync(c)) { fs.copyFileSync(c, o); cached++; }
  else { await sharp(Buffer.from(svg)).png({ palette: true, quality: 90, effort: 7 }).toFile(o); fs.copyFileSync(o, c); made++; }
  bytes += fs.statSync(o).size;
}
// Every referenced card must exist.
const missing = [...need.keys()].filter(k => !fs.existsSync(path.join(OG, k + '.png')));
if (missing.length) { console.error('og: missing cards', missing); process.exit(1); }
console.log(`og: ${need.size} cards (${made} rendered, ${cached} cached), ${(bytes / 1048576).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
