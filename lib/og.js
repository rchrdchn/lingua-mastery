// Which share image a page uses. Hubs, levels and grammar lessons each get their own card; word and
// character pages share one card per language (a card per word would add ~6,700 PNGs). Everything else
// uses the site-wide /og.png. scripts/og.mjs renders every /og/<key>.png that a built page points to.
const LANGS = ['mandarin', 'spanish', 'english', 'french', 'italian', 'portuguese', 'german'];
const SHARED = { words: 'words', characters: 'characters' };
function ogKey(url) {
  const s = decodeURI(url || '/').split('/').filter(Boolean);
  if (!LANGS.includes(s[0])) return null;
  if (s.length === 1) return s[0];
  if (SHARED[s[1]]) return `${s[0]}-${SHARED[s[1]]}`;
  if (s[1] === 'grammar' && s[2] && /^[a-z0-9-]+$/.test(s[2]) && s.length === 3) return `${s[0]}-grammar-${s[2]}`;
  if (s.length === 2 && /^[a-z0-9-]+$/.test(s[1])) return `${s[0]}-${s[1]}`;
  return null;
}
const ogImage = (url, siteUrl) => { const k = ogKey(url); return `${siteUrl}${k ? `/og/${k}.png` : '/og.png'}`; };
// Alt text describes the card itself: the page title on per-page cards, the shared card's headline otherwise.
function ogAlt(url, title, site) {
  const k = ogKey(url);
  if (!k) return `${site.name}: ${site.tagline}`;
  const s = decodeURI(url).split('/').filter(Boolean);
  const lang = s[0][0].toUpperCase() + s[0].slice(1);
  if (s[1] === 'words') return `${site.name}: ${lang} words with audio and examples`;
  if (s[1] === 'characters') return `${site.name}: Chinese characters with stroke order`;
  return title;
}
module.exports = { ogKey, ogImage, ogAlt, LANGS };
