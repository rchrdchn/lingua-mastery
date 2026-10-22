// Post-build (same file as the soccer, NBA and Races Near sites). Runs after Eleventy:
// 1. Fails the build on double-escaped entities in <head> (&amp;amp; &amp;#39; ...), titles over
//    65 characters, descriptions over 160, or a dateModified without a visible "Updated" date.
// 2. Real lastmod: hashes each sitemap page's content (title, description, <main>; anything between
//    <!--nohash--> and <!--/nohash--> is ignored) against lastmod.json. Only pages whose hash changed
//    get a new timestamp. That timestamp fills the visible "Updated" date, JSON-LD dateModified and
//    the sitemap <lastmod>, so all three always match.
// 3. Writes .indexnow.json with only new, changed and removed URLs for scripts/indexnow.mjs.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = process.cwd(), OUT = path.join(ROOT, '_site'), STATE = path.join(ROOT, 'lastmod.json');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/_data/site.json'), 'utf8'));
const TZ = 'America/Los_Angeles';
const now = process.env.LASTMOD_NOW ? new Date(process.env.LASTMOD_NOW) : new Date();
// ISO 8601 with the Pacific offset, so the date part matches the visible date.
function isoPT(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset' }).formatToParts(d).map(x => [x.type, x.value]));
  const off = (p.timeZoneName.replace('GMT', '') || '+00:00');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${off}`;
}
const human = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric' });
const dec = s => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const files = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!['assets', 'og', 'md'].includes(f.name)) walk(p); } else if (f.name.endsWith('.html')) files.push(p); } })(OUT);
const urlOf = p => { const r = '/' + path.relative(OUT, p).replace(/\\/g, '/'); return r.endsWith('/index.html') ? r.slice(0, -10) : r; };

const smPath = path.join(OUT, 'sitemap.xml');
let sm = fs.existsSync(smPath) ? fs.readFileSync(smPath, 'utf8') : '';
const inSitemap = new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(site.url, '')));
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const T = isoPT(now), errors = [], changed = [], seen = new Set();

for (const f of files) {
  const url = urlOf(f); let html = fs.readFileSync(f, 'utf8');
  const head = (html.match(/<head>([\s\S]*?)<\/head>/i) || [, ''])[1];
  const dbl = head.match(/&amp;(amp|#\d+|#x[0-9a-f]+|quot|lt|gt|apos|nbsp);/i);
  if (dbl) errors.push(`${url}: double-escaped entity in <head>: ${dbl[0]}`);
  const title = dec((head.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1]);
  const desc = dec((head.match(/<meta name="description" content="([^"]*)"/i) || [, ''])[1]);
  const index = !/<meta name="robots" content="noindex/i.test(head) && url !== '/404.html';
  if (index && title.length > 65) errors.push(`${url}: title ${title.length} chars: ${title}`);
  if (index && desc.length > 160) errors.push(`${url}: description ${desc.length} chars`);
  if (html.includes('__LASTMOD_ISO__') && /"dateModified"/.test(html) && !/class="upd"/.test(html)) errors.push(`${url}: dateModified without a visible Updated date`);
  let t = T;
  if (inSitemap.has(url)) {
    seen.add(url);
    const main = (html.match(/<main[^>]*>([\s\S]*)<\/main>/i) || [, html])[1];
    const body = (title + '\n' + desc + '\n' + main).replace(/<!--nohash-->[\s\S]*?<!--\/nohash-->/g, '').replace(/\?v=[\w.-]+/g, '');
    const h = crypto.createHash('sha1').update(body).digest('hex').slice(0, 16);
    if (!state[url] || state[url].h !== h) { state[url] = { h, t: T }; changed.push(url); }
    t = state[url].t;
  }
  if (html.includes('__LASTMOD')) { html = html.replaceAll('__LASTMOD_ISO__', t).replaceAll('__LASTMOD__', human(t)); fs.writeFileSync(f, html); }
}
const removed = Object.keys(state).filter(u => !seen.has(u));
for (const u of removed) delete state[u];
if (sm) {
  sm = sm.replace(/<url><loc>([^<]+)<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>/g, (m, loc) => { const s = state[loc.replace(site.url, '')]; return `<url><loc>${loc}</loc>${s ? `<lastmod>${s.t}</lastmod>` : ''}</url>`; });
  fs.writeFileSync(smPath, sm);
}
if (errors.length) { console.error(`postbuild: ${errors.length} problem(s)\n` + errors.slice(0, 40).join('\n')); process.exit(1); }
const sorted = Object.fromEntries(Object.keys(state).sort().map(k => [k, state[k]]));
fs.writeFileSync(STATE, JSON.stringify(sorted, null, 0).replace(/},"/g, '},\n"') + '\n');
fs.writeFileSync(path.join(ROOT, '.indexnow.json'), JSON.stringify({ at: T, urls: [...changed, ...removed].map(u => site.url + u) }, null, 1));
console.log(`postbuild: ${files.length} pages checked, ${seen.size} in sitemap, ${changed.length} new or changed, ${removed.length} removed`);
