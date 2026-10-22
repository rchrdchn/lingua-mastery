// Shared SEO text helpers (same file as the soccer, NBA and Races Near sites).
// Titles and descriptions are decoded to plain text here and escaped exactly once by the
// template's autoescape, so "&" never shows up as "&amp;amp;" in <head>.
const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '-', mdash: '-', hellip: '…', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };
function plain(s) {
  let t = String(s == null ? '' : s), prev;
  do { prev = t; t = t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m)); } while (t !== prev);
  return t.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
// Cut at a word boundary and add an ellipsis.
function cut(s, max) {
  if (s.length <= max) return s;
  let c = s.slice(0, max - 1); const i = c.lastIndexOf(' ');
  if (i > max * 0.6) c = c.slice(0, i);
  return c.replace(/[\s,;:(|\-–]+$/, '') + '…';
}
// Title: keep "Base | Brand" if it fits, else drop the brand, then a trailing ": subtitle",
// then a trailing "(...)", then cut at a word boundary. Default max 65 characters.
function seoTitle(s, max = 65) {
  const t = plain(s); if (t.length <= max) return t;
  const base = t.split(' | ')[0]; if (base.length <= max) return base;
  const ci = base.lastIndexOf(': '); if (ci >= 25 && ci <= max) return base.slice(0, ci);
  const np = base.replace(/\s*\([^)]*\)\s*$/, ''); if (np.length <= max && np.length >= 25) return np;
  return cut(base, max);
}
// Description: whole sentences while they fit in max (default 160), else a word-boundary cut.
function seoDesc(s, max = 160) {
  const t = plain(s); if (t.length <= max) return t;
  const parts = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  let out = '';
  for (const p of parts) { if ((out + p).trim().length > max) break; out += p; }
  out = out.trim();
  return out.length >= 110 ? out : cut(t, max);
}
// Shorten a name (race, team) at a word boundary for use inside a title.
const cutName = (s, max = 45) => {
  const t = plain(s); if (t.length <= max) return t;
  let c = t.slice(0, max + 1); c = c.slice(0, c.lastIndexOf(' ') > max * 0.5 ? c.lastIndexOf(' ') : max);
  for (let i = 0; i < 4; i++) c = c.replace(/[\s,;:(|\-–•\/&+]+$/, '').replace(/\s+(and|at|of|the|in|for|with|by|to|a|an)$/i, '');
  return c;
};
module.exports = { plain, cut, seoTitle, seoDesc, cutName };

// BreadcrumbList JSON-LD built from the visible breadcrumb (<p class="crumbs">), so the schema
// always matches what readers see. Returns '' when the page has no crumbs or already has one.
function crumbsLd(html, pageUrl, siteUrl) {
  if (html.includes('"BreadcrumbList"')) return '';
  const m = html.match(/<(p|nav|div|ol)\b[^>]*class="crumbs?"[^>]*>([\s\S]*?)<\/\1>/);
  if (!m) return '';
  const items = []; let rest = m[2];
  for (const a of m[2].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    items.push({ name: plain(a[2]), url: a[1].startsWith('http') ? a[1] : siteUrl + a[1] });
    rest = rest.slice(rest.indexOf(a[0]) + a[0].length);
  }
  const last = plain(rest.replace(/^[\s/›>|]+/, ''));
  if (last) items.push({ name: last, url: siteUrl + pageUrl });
  if (items.length < 2) return '';
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.url })) };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}
module.exports.crumbsLd = crumbsLd;
