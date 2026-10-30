// Writes llms-full.txt (https://llmstxt.org): the full text of every page that llms.txt links to, as Markdown, in one file.
// The page list comes from the built llms.txt (the first link on each "- [" line, same site only), so llms-full.txt
// never drifts from llms.txt: add a page there and it shows up here on the next build. No dependencies.
// Usage: node scripts/llms-full.mjs <outDir> <siteUrl> [maxPages]
import fs from 'node:fs'; import path from 'node:path';
const [OUT = '_site', SITE, MAX = '400'] = process.argv.slice(2);
if (!SITE) { console.error('usage: llms-full.mjs <outDir> <siteUrl> [maxPages]'); process.exit(1); }
const U = SITE.replace(/\/$/, ''), host = new URL(U).host;
const idx = fs.readFileSync(path.join(OUT, 'llms.txt'), 'utf8');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', times: '×', copy: '©', rarr: '→', larr: '←', deg: '°', frac12: '½' };
const dec = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m));
const abs = h => { try { return new URL(dec(h), U + '/').href; } catch { return h; } };

function toMd(html) {
  let m = (html.match(/<main[^>]*>([\s\S]*)<\/main>/i) || html.match(/<article[^>]*>([\s\S]*)<\/article>/i) || html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  m = m.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template|dialog|form|button|select|iframe|canvas|video|audio|picture)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<(input|img|source|meta|link)\b[^>]*>/gi, '');
  m = m.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => {
    const txt = dec(t.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/([\[\]])/g, '\\$1').trim();
    if (!txt) return '';
    if (/^(#|javascript:|mailto:)/i.test(h)) return ` ${txt} `;
    return ` [${txt}](${abs(h)}) `;
  });
  m = m.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(+n)} ${t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n\n`)
    .replace(/<li\b[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '')
    .replace(/<tr\b[^>]*>/gi, '\n| ').replace(/<\/t[dh]>/gi, ' | ').replace(/<t[dh]\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|section|ul|ol|table|thead|tbody|tfoot|figure|figcaption|blockquote|dl|dt|dd|details|summary|aside|article)\b[^>]*>/gi, '\n\n')
    .replace(/<\/(span|time|small|em|i|b|strong|abbr|data|mark|label|sup|sub)>/gi, '$& ')
    .replace(/<(span|time|small|em|b|strong|abbr|data|mark|label)\b/gi, ' $&')
    .replace(/<[^>]+>/g, '');
  return dec(m).split('\n').map(l => l.replace(/[ \t\u00a0]+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').replace(/\( /g, '(').trim()).join('\n')
    .replace(/\n(- |\| )\s*\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const seen = new Set(['/']), urls = ['/'];  // home page first
for (const line of idx.split('\n')) {
  const m = line.match(/^- \[[^\]]*\]\((https?:\/\/[^)\s]+)\)/); if (!m) continue;
  let u; try { u = new URL(m[1]); } catch { continue; }
  if (u.host !== host || /[<>]/.test(m[1])) continue;
  const p = u.pathname; if (seen.has(p)) continue; seen.add(p); urls.push(p);
}
const fileFor = p => { const d = decodeURIComponent(p); const c = d.endsWith('/') ? [d + 'index.html'] : [d, d + '.html', d + '/index.html']; return c.map(x => path.join(OUT, x)).find(f => fs.existsSync(f) && fs.statSync(f).isFile()); };
const head = idx.split('\n## ')[0].trim();
const parts = [head, '', `This file holds the full text of the pages listed in ${U}/llms.txt, one section per page, generated at build time on ${new Date().toISOString().slice(0, 10)}. Each section starts with the page URL.`, ''];
let n = 0, skipped = 0;
for (const p of urls) {
  if (n >= +MAX) break;
  const f = fileFor(p);
  if (!f || !/\.html?$/.test(f)) { skipped++; continue; }
  const html = fs.readFileSync(f, 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) { skipped++; continue; }
  const title = dec((html.match(/<title>([\s\S]*?)<\/title>/i) || [, p])[1]).trim();
  const body = toMd(html); if (!body) { skipped++; continue; }
  parts.push('---', '', `# ${title}`, '', `URL: ${U}${p}`, '', body.replace(/^# .*\n+/, ''), ''); n++;
}
fs.writeFileSync(path.join(OUT, 'llms-full.txt'), parts.join('\n').replace(/\n{3,}/g, '\n\n'));
const kb = Math.round(fs.statSync(path.join(OUT, 'llms-full.txt')).size / 1024);
console.log(`llms-full.txt: ${n} pages, ${kb} KB${skipped ? `, ${skipped} links skipped (not HTML, missing or noindex)` : ''}`);
