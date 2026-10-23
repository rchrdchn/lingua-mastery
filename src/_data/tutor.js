// "Practice with a real tutor" (italki via Awin). Off until affiliates.json has italkiUrl,
// so no untracked links ship. TUTOR_PREVIEW=1 renders it with plain italki links for screenshots only.
const a = require('./affiliates.json');
const HOME = 'https://www.italki.com/';
const preview = process.env.TUTOR_PREVIEW === '1' && !a.italkiUrl;
// Swap the deeplink's ued (destination) for the course's page; a non-Awin URL is used as-is.
const wrap = page => {
  if (!a.italkiUrl) return page;
  try { const u = new URL(a.italkiUrl); if (u.searchParams.has('ued')) { u.searchParams.set('ued', page); return u.toString(); } } catch {}
  return a.italkiUrl;
};
module.exports = () => ({
  on: !!a.italkiUrl || preview,
  preview,
  home: wrap(HOME),
  byPack: Object.fromEntries(Object.entries(a.italkiPages).map(([id, page]) => [id, wrap(page || HOME)])),
  disclosure: a.disclosure,
});
