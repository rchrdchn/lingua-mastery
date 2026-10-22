// Builds everything the SEO pages need from data/packs/*.json (made by
// scripts/data/build-packs.mjs) plus the hand-written copy in lib/langs.js.
const fs = require('node:fs');
const path = require('node:path');
const langs = require('../../lib/langs.js');

const ORDER = ['zh', 'es', 'en', 'fr', 'it', 'pt', 'de'];
const BASE_NAME = { en: 'English', es: 'Spanish', pt: 'Portuguese', zh: 'Chinese' };
const MIN_EX_FOR_INDEX = 2;   // word pages with fewer example sentences are thin: noindex

const first = (g, n = 60) => { const s = String(g || '').split(';')[0].trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
const enc = s => String(s);   // raw UTF-8 paths: Cloudflare Pages serves them, browsers percent-encode on request

module.exports = function () {
  const dir = path.join(__dirname, '../../data/packs');
  const packs = [], hubs = [], levels = [], words = [], chars = [], grammar = [];
  for (const id of ORDER) {
    const file = path.join(dir, `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const P = JSON.parse(fs.readFileSync(file, 'utf8'));
    const L = langs[id] || {};
    const hubUrl = `/${P.slug}/`;
    const bases = P.bases;
    const baseLabel = bases.map(b => BASE_NAME[b]).join(', ');
    const learnUrl = (q = '') => `/learn/?pack=${id}${q}`;
    const levelUrl = lv => `${hubUrl}${(L.levelSlug || {})[lv] || lv}/`;
    const levelName = Object.fromEntries(P.levels.map(l => [l.id, l.name]));
    const conceptOf = Object.fromEntries(P.concepts.map(c => [c.id, c]));
    const sent = sid => { const s = P.sentences[sid]; return s && { t: s.t, a: s.a, tr: bases.map(b => s.tr[b] && { b, name: BASE_NAME[b], t: s.tr[b], by: s.ta[b] }).filter(Boolean) }; };
    const meta = { id, slug: P.slug, name: P.name, short: P.short, adj: L.adj || P.short, hubUrl, speech: P.speech, bases, baseLabel, credits: P.credits, target: P.target };

    // Words, ordered by level then rank.
    const ws = P.items.slice().sort((a, b) => P.levels.findIndex(l => l.id === a.lvl) - P.levels.findIndex(l => l.id === b.lvl) || a.rank - b.rank);
    const wUrl = it => `${hubUrl}words/${enc(it.slug)}/`;
    const byConcept = {};
    for (const it of ws) (byConcept[it.concept] ||= []).push(it);
    const charSet = new Set((P.chars || []).map(c => c.c));
    ws.forEach((it, i) => {
      const ex = (it.ex || []).map(sent).filter(Boolean);
      const gl = bases.map(b => it.g[b] && { b, name: BASE_NAME[b], g: it.g[b], short: first(it.g[b]) }).filter(Boolean);
      const lvName = levelName[it.lvl] || it.lvl;
      const short = gl[0] ? gl[0].short : '';
      const zh = id === 'zh';
      const label = zh ? `${it.t} (${it.r})` : it.t;
      let title, description;
      if (zh) { title = `${it.t} (${it.r}) meaning: ${short} | ${lvName} word`; description = `${it.t} (${it.r}) means "${short}" in Chinese. ${lvName} word with pinyin, tones, characters and ${ex.length} example sentences you can practice free.`; }
      else if (id === 'en') { title = `"${it.t}" in Spanish, Portuguese and Chinese | English ${lvName}`; description = `"${it.t}" means ${gl.map(x => `${x.short} (${x.name})`).join(', ')}. English ${lvName} word with example sentences and translations.`; }
      else { title = `"${it.t}" in English: meaning and examples | ${L.adj} ${lvName}`; description = `"${it.t}" means "${short}" in ${L.adj}. ${lvName} word #${it.rank} by frequency, with ${ex.length} example sentences, translations and free practice.`; }
      words.push({
        pack: meta, url: wUrl(it), it, label, gl, short, ex, lvName, levelUrl: levelUrl(it.lvl),
        conceptTitle: (conceptOf[it.concept]?.title || {}).en || '', practice: learnUrl(`&concept=${encodeURIComponent(it.concept)}`),
        related: (byConcept[it.concept] || []).filter(x => x.id !== it.id).slice(0, 12).map(x => ({ t: x.t, r: x.r, url: wUrl(x), g: first(x.g[bases[0]], 32) })),
        chars: zh ? [...it.t].filter(c => charSet.has(c)).map(c => ({ c, url: `${hubUrl}characters/${enc(c)}/` })) : [],
        prev: i > 0 ? { t: ws[i - 1].t, url: wUrl(ws[i - 1]) } : null,
        next: i < ws.length - 1 ? { t: ws[i + 1].t, url: wUrl(ws[i + 1]) } : null,
        noindex: ex.length < MIN_EX_FOR_INDEX || !gl.length,
        title, description,
      });
    });

    // Characters (Mandarin).
    const cs = (P.chars || []).slice().sort((a, b) => P.levels.findIndex(l => l.id === a.lvl) - P.levels.findIndex(l => l.id === b.lvl));
    const cUrl = c => `${hubUrl}characters/${enc(c)}/`;
    const itemByT = Object.fromEntries(P.items.map(x => [x.t, x]));
    cs.forEach((c, i) => {
      const ws2 = c.words.map(w => itemByT[w]).filter(Boolean).map(x => ({ t: x.t, r: x.r, url: wUrl(x), g: first(x.g.en, 40) }));
      const g = first(c.g.en, 50);
      chars.push({
        pack: meta, url: cUrl(c.c), c, g, words: ws2, lvName: levelName[c.lvl] || c.lvl, levelUrl: levelUrl(c.lvl),
        prev: i > 0 ? { t: cs[i - 1].c, url: cUrl(cs[i - 1].c) } : null, next: i < cs.length - 1 ? { t: cs[i + 1].c, url: cUrl(cs[i + 1].c) } : null,
        practice: itemByT[c.c] ? learnUrl(`&concept=${encodeURIComponent(itemByT[c.c].concept)}`) : learnUrl(),
        noindex: ws2.length < 2,
        title: `${c.c} Chinese character: stroke order, meaning and pinyin (${c.r.join(', ')})`,
        description: `${c.c} (${c.r.join(', ')}) means "${g}". ${c.strokes ? `${c.strokes} strokes. ` : ''}See the stroke order animation, ${ws2.length} HSK words that use it, and practice writing it free.`,
      });
    });

    // Grammar lessons.
    const gs = P.concepts.filter(c => c.kind === 'grammar' || (c.slug && (c.kind === 'tone' || c.kind === 'write')));
    const gUrl = c => `${hubUrl}grammar/${c.slug}/`;
    gs.forEach((c, i) => {
      const b0 = bases.includes('en') ? 'en' : 'en';
      const t = c.title[b0] || c.title.en;
      const sents = (c.cloze?.sents || []).slice(0, 6).map(sent).filter(Boolean);
      const translations = id === 'en' ? bases.map(b => c.title[b] && c.summary?.[b] && { b, name: BASE_NAME[b], title: c.title[b], summary: c.summary[b], body: c.body?.[b] || [] }).filter(Boolean) : [];
      grammar.push({
        pack: meta, url: gUrl(c), c, t, summary: c.summary?.en, body: c.body?.en || [], examples: (c.examples || []).map(e => ({ t: e.t, r: e.r, tr: bases.map(b => e.tr[b] && { name: BASE_NAME[b], t: e.tr[b] }).filter(Boolean) })),
        sents, translations, lvName: levelName[c.level] || c.level, levelUrl: levelUrl(c.level), practice: learnUrl(`&concept=${encodeURIComponent(c.id)}`),
        prereqs: c.prereqs.map(x => conceptOf[x]).filter(Boolean).map(x => ({ t: x.title.en, url: x.slug ? gUrl(x) : null })),
        prev: i > 0 ? { t: gs[i - 1].title.en, url: gUrl(gs[i - 1]) } : null, next: i < gs.length - 1 ? { t: gs[i + 1].title.en, url: gUrl(gs[i + 1]) } : null,
        title: `${t} | ${L.adj} ${c.kind === 'grammar' ? 'grammar' : 'pronunciation'} (${levelName[c.level] || c.level})`,
        description: `${c.summary?.en || t} Free ${L.adj} lesson with examples and practice.`,
        noindex: false,
      });
    });

    // Levels.
    const lvList = P.levels.map(lv => {
      const lw = words.filter(w => w.pack.id === id && w.it.lvl === lv.id);
      const lg = grammar.filter(g => g.pack.id === id && g.c.level === lv.id);
      const lc = chars.filter(c => c.pack.id === id && c.c.lvl === lv.id);
      const concepts = P.concepts.filter(c => c.level === lv.id).length;
      const zh = id === 'zh';
      const title = lv.id === 'foundations' ? `Mandarin tones and pinyin: the four tones, sandhi and stroke order` :
        zh ? `${lv.name} vocabulary list: all ${lw.length} words with pinyin and examples` :
        id === 'en' ? `English ${lv.name} vocabulary: ${lw.length} words in Spanish, Portuguese, Chinese` :
        `${L.adj} ${lv.name} vocabulary: ${lw.length} most common words with examples`;
      const description = (L.levels || {})[lv.id] || `${lv.name} words and grammar.`;
      return { pack: meta, id: lv.id, name: lv.name, url: levelUrl(lv.id), words: lw, grammar: lg, chars: lc, concepts, title, description, intro: description, practice: learnUrl(), placement: learnUrl('&placement=1') };
    });
    levels.push(...lvList);

    const counts = { concepts: P.concepts.length, words: P.items.length, chars: (P.chars || []).length, grammar: P.concepts.filter(c => c.kind === 'grammar').length, sentences: Object.keys(P.sentences).length };
    const gramFaq = { q: `What grammar does the ${L.adj} course cover?`, a: `${gs.filter(g => g.kind === 'grammar').length} lessons so far: ${gs.filter(g => g.kind === 'grammar').map(g => g.title.en).join('; ')}.` };
    const hub = {
      pack: meta, url: hubUrl, levels: lvList, grammar: grammar.filter(g => g.pack.id === id), counts, intro: L.hubIntro, more: L.hubMore || [], faqs: [...(L.faqs || []), gramFaq],
      title: id === 'zh' ? 'Learn Mandarin Chinese free: HSK 1 and 2 mastery course' : id === 'en' ? 'Learn English free from Spanish, Portuguese or Chinese' : `Learn ${L.adj} free: mastery course with ${counts.words} core words`,
      description: L.hubIntro, practice: learnUrl(), placement: learnUrl('&placement=1'),
      topWords: words.filter(w => w.pack.id === id).slice(0, 24),
    };
    hubs.push(hub);
    packs.push({ ...meta, counts, intro: L.hubIntro, levels: lvList.map(l => ({ name: l.name, url: l.url, words: l.words.length })) });
  }
  const pageCounts = Object.fromEntries(packs.map(p => {
    const w = words.filter(x => x.pack.id === p.id), c = chars.filter(x => x.pack.id === p.id), g = grammar.filter(x => x.pack.id === p.id), l = levels.filter(x => x.pack.id === p.id);
    const idx = a => a.filter(x => !x.noindex).length;
    return [p.id, { hub: 1, levels: l.length, words: w.length, wordsIndexed: idx(w), chars: c.length, charsIndexed: idx(c), grammar: g.length, total: 1 + l.length + w.length + c.length + g.length }];
  }));
  return { packs, hubs, levels, words, chars, grammar, pageCounts, BASE_NAME };
};
