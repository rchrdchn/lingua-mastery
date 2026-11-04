// Site search indexes (Tiny Labs shared pattern, see src/assets/search.js).
// /search-index/all.json: courses, levels, grammar, site pages and the 150 most common words of each course.
// /search-index/<course>.json: the same plus every word (and, for Mandarin, every character) in that course.
// Per-course files keep each download small (about 10-30 KB gzipped) instead of one ~100 KB file.
const PAGES = [
  ['/', 'Lingua Magna home', 'Courses, method and free practice', 'home start'],
  ['/learn/', 'Practice', 'Mastery-gated practice in your browser', 'practice app review flashcards placement test'],
  ['/about/', 'About and method', 'How mastery learning works here', 'about method mastery'],
  ['/credits/', 'Credits and licenses', 'Data sources, audio and licenses', 'credits license sources audio tatoeba'],
  ['/privacy/', 'Privacy', 'No accounts; progress stays in your browser', 'privacy cookies data'],
  ['/feed.xml', 'New lessons (RSS)', 'Feed of new lessons', 'rss feed'],
];
const G = ['course', 'lvl', 'word', 'char', 'gram', 'page'], W = [.35, .2, .1, .08, .12, .05];
const TOP = 150;
module.exports = class {
  data() {
    return { permalink: d => `/search-index/${d.ix}.json`, pagination: { data: 'ixs', size: 1, alias: 'ix' }, ixs: ['all', 'zh', 'es', 'en', 'fr', 'it', 'pt', 'de'], eleventyExcludeFromCollections: true };
  }
  render({ lm, ix }) {
    const i = [], add = (g, t, s, u, k, b, a) => { const r = [G.indexOf(g), t, s || '', u, k || '']; if (b || a) r.push(b || 0); if (a) r.push(a); i.push(r); };
    const cur = ix === 'all' ? null : ix;
    for (const p of lm.packs) add('course', `${p.adj} course`, `${p.counts.words} words · ${p.counts.grammar} grammar lessons${p.id === 'en' ? ' · for Spanish, Portuguese and Chinese speakers' : ''}`, p.hubUrl, `learn ${p.name} ${p.short}`, p.id === cur ? 30 : 0, p.id === 'zh' ? 'chinese mandarin 中文 汉语' : p.name);
    for (const l of lm.levels) add('lvl', `${l.pack.adj} ${l.name}`, l.words.length ? `${l.words.length} words · ${l.grammar.length} lessons` : `${l.grammar.length} lessons`, l.url, 'level vocabulary list', l.pack.id === cur ? 15 : 0);
    for (const g of lm.grammar) add('gram', g.t, `${g.pack.adj} · ${g.lvName}`, g.url, g.pack.adj, g.pack.id === cur ? 10 : 0);
    for (const [u, t, s, k] of PAGES) add('page', t, s, u, k);
    const seen = {}, words = lm.words.filter(w => cur ? w.pack.id === cur : (seen[w.pack.id] = (seen[w.pack.id] || 0) + 1) <= TOP);
    for (const w of words) {
      const zh = w.pack.id === 'zh', lab = cur ? w.lvName : `${w.pack.adj} ${w.lvName}`;
      const gl = w.pack.id === 'en' ? w.gl.map(x => x.short).join(' · ') : w.short;
      add('word', w.it.t, `${zh ? w.it.r + ' · ' : ''}${gl} · ${lab}`, w.url, '', 0, zh ? w.it.r : '');
    }
    if (cur === 'zh') for (const c of lm.chars) add('char', c.c.c, `${c.c.r.join(', ')} · ${c.g} · character`, c.url, '', 0, c.c.r.join(' '));
    const s = [];
    const hub = lm.packs.find(p => p.id === cur);
    if (hub) { s.push(i.findIndex(r => r[3] === hub.hubUrl)); s.push(...i.map((r, n) => [r, n]).filter(([r]) => r[0] === 1 && r[3].startsWith(hub.hubUrl)).slice(0, 3).map(([, n]) => n)); }
    else s.push(...['/mandarin/', '/spanish/', '/english/', '/french/', '/learn/'].map(u => i.findIndex(r => r[3] === u)).filter(n => n >= 0));
    return JSON.stringify({ g: G, w: W, i, s: s.filter(n => n >= 0) });
  }
};
