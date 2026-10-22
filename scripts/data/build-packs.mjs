// Builds the language packs (data/packs/<lang>.json) from the raw sources in data/raw
// (run scripts/data/fetch.mjs first) plus the original grammar in content/grammar/.
// Output is deterministic for the same inputs, so diffs show real content changes.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { isNoteSense, MAX_PRIMARY, lintPack, LINT_TOP } from './gloss-lint.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const RAW = path.join(ROOT, 'data/raw'), OUT = path.join(ROOT, 'data/packs');
fs.mkdirSync(OUT, { recursive: true });
const read = f => fs.readFileSync(path.join(RAW, f), 'utf8');
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

export const PACKS = {
  zh: { name: 'Mandarin Chinese', short: 'Mandarin', slug: 'mandarin', bases: ['en'], speech: 'zh-CN', levels: [['hsk1', 'HSK 1'], ['hsk2', 'HSK 2']], cluster: 8 },
  es: { name: 'Spanish', short: 'Spanish', slug: 'spanish', bases: ['en'], speech: 'es-ES', levels: [['a1', 'A1', 500], ['a2', 'A2', 750], ['b1', 'B1', 750]], cluster: 10 },
  en: { name: 'English', short: 'English', slug: 'english', bases: ['es', 'pt', 'zh'], speech: 'en-US', levels: [['a1', 'A1', 400], ['a2', 'A2', 400]], cluster: 10 },
  fr: { name: 'French', short: 'French', slug: 'french', bases: ['en'], speech: 'fr-FR', levels: [['a1', 'A1', 300], ['a2', 'A2', 300]], cluster: 10 },
  it: { name: 'Italian', short: 'Italian', slug: 'italian', bases: ['en'], speech: 'it-IT', levels: [['a1', 'A1', 300], ['a2', 'A2', 300]], cluster: 10 },
  pt: { name: 'Portuguese', short: 'Portuguese', slug: 'portuguese', bases: ['en'], speech: 'pt-BR', levels: [['a1', 'A1', 300], ['a2', 'A2', 300]], cluster: 10 },
  de: { name: 'German', short: 'German', slug: 'german', bases: ['en'], speech: 'de-DE', levels: [['a1', 'A1', 300], ['a2', 'A2', 300]], cluster: 10 },
};
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));
const want = l => !ONLY.length || ONLY.includes(l);

const CREDITS = {
  tatoeba: { name: 'Tatoeba', url: 'https://tatoeba.org/', license: 'CC BY 2.0 FR', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/', note: 'Example sentences and translations. Each sentence credits its author.' },
  freq: { name: 'FrequencyWords (hermitdave), OpenSubtitles 2018', url: 'https://github.com/hermitdave/FrequencyWords', license: 'CC BY-SA 4.0 (lists), MIT (code)', licenseUrl: 'https://github.com/hermitdave/FrequencyWords#license', note: 'Word frequency ranks used to order the core vocabulary.' },
  wiktionary: { name: 'Wiktionary via kaikki.org', url: 'https://kaikki.org/', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', note: 'Short English glosses, gender and IPA. Derived data is shared under CC BY-SA 4.0.' },
  hsk30: { name: 'ivankra/hsk30 (HSK 3.0 word list)', url: 'https://github.com/ivankra/hsk30', license: 'MIT', licenseUrl: 'https://github.com/ivankra/hsk30/blob/master/LICENSE', note: 'HSK 3.0 levels 1 and 2 (2021 standard) with pinyin and part of speech.' },
  cedict: { name: 'CC-CEDICT', url: 'https://cc-cedict.org/', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', note: 'English definitions and numbered pinyin. Derived data is shared under CC BY-SA 4.0.' },
  hanziwriter: { name: 'Hanzi Writer + hanzi-writer-data (Make Me a Hanzi)', url: 'https://hanziwriter.org/', license: 'MIT (code), Arphic Public License (stroke data)', licenseUrl: 'https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT', note: 'Stroke order animation and writing quizzes.' },
  original: { name: 'Original grammar lessons', url: '/about/', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', note: 'Grammar explanations and their example sentences are written for this site.' },
};

// ---------- Tatoeba ----------
const T3 = { es: 'spa', fr: 'fra', it: 'ita', pt: 'por', de: 'deu', en: 'eng', zh: 'cmn' };
function* lines(f) { const s = read(f); let i = 0; while (i < s.length) { let j = s.indexOf('\n', i); if (j < 0) j = s.length; yield s.slice(i, j); i = j + 1; } }
function loadLinks(l) { const m = new Map(); for (const ln of lines(`links-${l}-en.tsv`)) { const [a, b] = ln.split('\t'); if (!b) continue; if (!m.has(a)) m.set(a, []); m.get(a).push(b); } return m; }
function loadSentences(l, keep) { const m = new Map(); for (const ln of lines(`tatoeba-${l}.tsv`)) { const p = ln.split('\t'); if (p.length < 4) continue; if (keep && !keep(p[0], p[2])) continue; m.set(p[0], { t: p[2], a: p[3] }); } return m; }

const allLinks = {}; const enNeeded = new Set();
for (const l of ['zh', 'es', 'fr', 'it', 'pt', 'de']) { allLinks[l] = loadLinks(l); for (const v of allLinks[l].values()) for (const x of v) enNeeded.add(x); }
log('links loaded; english ids needed', enNeeded.size);
const EN = loadSentences('en', id => enNeeded.has(id));
log('english sentences', EN.size);

// ---------- helpers ----------
const tokRe = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
const toks = s => (s.toLowerCase().match(tokRe) || []);
function freqRank(l) { const r = new Map(); read(`freq-${l}.txt`).split('\n').forEach((x, i) => { const w = x.split(' ')[0]; if (w && !r.has(w)) r.set(w, i + 1); }); return r; }
const clean = s => s.replace(/\s+/g, ' ').trim();
function pickExamples(cands, n = 3) { const out = [], seen = new Set(); for (const c of cands) { const k = c.t.toLowerCase().replace(/[^\p{L}]/gu, ''); if (seen.has(k)) continue; seen.add(k); out.push(c); if (out.length >= n) break; } return out; }

// ---------- pinyin ----------
const TONE = { a: 'āáǎàa', e: 'ēéěèe', i: 'īíǐìi', o: 'ōóǒòo', u: 'ūúǔùu', ü: 'ǖǘǚǜü' };
export function markSyl(s) { // "hao3" -> "hǎo"
  const m = s.match(/^([a-zü:v]+)([1-5])$/i); if (!m) return s;
  let [, b, t] = m; b = b.replace(/u:|v/g, 'ü'); const ti = +t - 1; if (ti === 4) return b;
  const lower = b.toLowerCase(); let idx = lower.indexOf('a'); if (idx < 0) idx = lower.indexOf('e'); if (idx < 0 && lower.includes('ou')) idx = lower.indexOf('o');
  if (idx < 0) { for (let i = lower.length - 1; i >= 0; i--) if ('aeiouü'.includes(lower[i])) { idx = i; break; } }
  if (idx < 0) return b; const v = lower[idx]; return b.slice(0, idx) + TONE[v][ti] + b.slice(idx + 1);
}

// ---------- CC-CEDICT ----------
let CED = null;
function cedict() {
  if (CED) return CED; CED = { byFull: new Map(), bySimpPy: new Map(), bySimp: new Map(), trad: new Set() };
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(RAW, 'cedict.txt.gz'))).toString('utf8');
  for (const ln of txt.split('\n')) {
    if (!ln || ln[0] === '#') continue; const m = ln.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/); if (!m) continue;
    const [, trad, simp, py, defs] = m; const e = { trad, simp, py, defs: defs.split('/') };
    CED.byFull.set(`${trad}|${simp}[${py}]`, e); if (!CED.bySimpPy.has(`${simp}[${py}]`) || /^(variant|old variant|surname)/.test(CED.bySimpPy.get(`${simp}[${py}]`).defs[0])) CED.bySimpPy.set(`${simp}[${py}]`, e); const lk = `${simp}[${py.toLowerCase()}]`; if (!CED.bySimpPy.has(lk) || /^surname /.test(CED.bySimpPy.get(lk).defs[0])) CED.bySimpPy.set(lk, e); if (!CED.bySimp.has(simp)) CED.bySimp.set(simp, []); CED.bySimp.get(simp).push(e);
    if ([...trad].length === 1 && trad !== simp) CED.trad.add(trad);
  }
  for (const s of CED.bySimp.keys()) CED.trad.delete(s);
  return CED;
}
const goodDefs = defs => defs.filter(d => d && !/^(CL:|variant of|old variant|surname |\(old\)|see |used in |abbr\. for)/i.test(d)).map(d => /^\([^()]*\)$/.test(d.trim()) ? d.trim().slice(1, -1) : d).map(d => d.replace(/\s*\([^()]*\)/g, '').trim()).map(d => d.replace(/"/g, '')).filter(d => d && !/[\[\]()]|also pr\.|\{/.test(d));

// ---------- generic concept building ----------
const TRACKS = { core: 'Core words', nouns: 'Things and people', verbs: 'Actions', describing: 'Describing words' };
function trackOf(pos) { pos = (pos || '').toLowerCase(); if (/^(n|m|noun)$/.test(pos)) return 'nouns'; if (/^(v|verb)$/.test(pos)) return 'verbs'; if (/^(adj|adv)$/.test(pos)) return 'describing'; return 'core'; }
function buildVocabConcepts(lang, items, levels, size, rootPrereqs = []) {
  const concepts = []; const lastOfTrack = {}; let core1 = null;
  for (const [lv, lvName] of levels) {
    const its = items.filter(i => i.lvl === lv);
    const byTrack = {}; for (const i of its) (byTrack[trackOf(i.pos)] ||= []).push(i);
    for (const tr of ['core', 'nouns', 'verbs', 'describing']) {
      const arr = byTrack[tr] || []; let n = 0;
      for (let k = 0; k < arr.length; k += size) {
        let chunk = arr.slice(k, k + size); if (chunk.length < 3 && concepts.length && lastOfTrack[tr] && lastOfTrack[tr].level === lv) { lastOfTrack[tr].items.push(...chunk.map(x => x.id)); continue; }
        n++; const id = `${lang}.v.${lv}.${tr}.${n}`;
        const pre = []; if (lastOfTrack[tr]) pre.push(lastOfTrack[tr].id); else if (tr !== 'core' && core1) pre.push(core1); else pre.push(...rootPrereqs);
        const c = { id, kind: 'vocab', level: lv, track: tr, title: { en: `${lvName} ${TRACKS[tr]} ${n}` }, items: chunk.map(x => x.id), prereqs: [...new Set(pre)], threshold: { streak: Math.min(8, chunk.length + 2), sec: lang === 'zh' ? 9 : 8 } };
        concepts.push(c); lastOfTrack[tr] = c; if (tr === 'core' && !core1) core1 = id;
        for (const x of chunk) x.concept = id;
      }
    }
  }
  return concepts;
}
function grammarConcepts(lang, gram, items, concepts, sentences, sentPool, opts = {}) {
  const itemByText = new Map(items.map(i => [i.t.toLowerCase(), i]));
  // Inflected forms (quiero -> querer, hay -> haber) also point at their lemma's cluster.
  for (const i of items) for (const f of i.forms || []) if (!itemByText.has(f.toLowerCase())) itemByText.set(f.toLowerCase(), i);
  const order = new Map(concepts.map((c, i) => [c.id, i]));
  const out = [];
  for (const g of gram) {
    const answers = g.cloze.answers.map(a => a.toLowerCase());
    // Prerequisite vocab: the earliest cluster that teaches one of the answer words.
    const clusters = answers.map(a => itemByText.get(a)?.concept).filter(Boolean).sort((a, b) => order.get(a) - order.get(b));
    // No answer word in the vocab (rare): fall back to the first core cluster of the lesson's level.
    const fallback = concepts.find(c => c.level === g.level && c.track === 'core')?.id;
    const pre = new Set([...(clusters.length ? [clusters[0]] : fallback ? [fallback] : []), ...(g.after || []).map(x => `${lang}.g.${x}`), ...(opts.rootPrereqs || [])]);
    // Cloze sentences: exactly one answer token, short, with a translation.
    const sents = [];
    for (const s of sentPool) {
      if (opts.zh) {
        let hits = 0, ans = null; for (const a of answers) { const c = s.t.split(a).length - 1; if (c) { hits += c; ans = a; } }
        if (hits !== 1) continue;
        if ((opts.zhBlock.get(ans) || []).some(w => s.t.includes(w) && !(g.allow || []).includes(w))) continue;
      } else {
        const tk = toks(s.t); const hit = tk.filter(t => answers.includes(t)); if (hit.length !== 1) continue;
      }
      sents.push(s.id); if (sents.length >= 40) break;
    }
    out.push({ id: `${lang}.g.${g.id}`, kind: 'grammar', level: g.level, slug: g.slug, title: g.title, summary: g.summary, body: g.body, pattern: g.pattern, examples: g.examples, prereqs: [...pre], cloze: { answers: g.cloze.answers, pool: g.cloze.pool, sents }, threshold: { streak: 6, sec: 14 } });
    for (const id of sents) sentences.add(id);
  }
  return out;
}
// Insert grammar concepts right after their latest prerequisite so the course order is readable.
function mergeOrder(vocab, grammar, pre = []) {
  const all = [...pre, ...vocab]; const pos = id => all.findIndex(c => c.id === id);
  for (const g of grammar) { const idx = Math.max(-1, ...g.prereqs.map(pos)); all.splice(idx + 1, 0, g); }
  return all;
}

// ---------- Mandarin ----------
async function buildZh() {
  const P = PACKS.zh, C = cedict();
  const rows = []; { const txt = read('hsk30.csv'); const hdr = txt.split('\n')[0].split(','); }
  // tiny CSV parser (quoted fields)
  const csv = read('hsk30.csv'); const recs = []; let row = [], f = '', q = false;
  for (let i = 0; i < csv.length; i++) { const ch = csv[i]; if (q) { if (ch === '"') { if (csv[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f); recs.push(row); row = []; f = ''; } else if (ch !== '\r') f += ch; }
  const H = recs.shift(); const get = (r, k) => r[H.indexOf(k)];
  const hsk = recs.filter(r => ['1', '2'].includes(get(r, 'Level')));
  // Simplified sentence pool
  const zhLinks = allLinks.zh;
  const S = loadSentences('zh', (id, t) => zhLinks.has(id) && [...t].length <= 18 && ![...t].some(ch => C.trad.has(ch)) && !/[a-zA-Z0-9]/.test(t));
  const pool = [...S.entries()].map(([id, s]) => { const x = (zhLinks.get(id) || []).map(x => EN.get(x)).find(Boolean); return { id, ...s, tr: x && x.t, ta: x && x.a }; }).filter(s => s.tr).sort((a, b) => [...a.t].length - [...b.t].length || a.id - b.id);
  log('zh pool', pool.length);
  const items = [], used = new Set();
  for (const r of hsk) {
    let simp = get(r, 'Simplified'), py = get(r, 'Pinyin'), trad = get(r, 'Traditional'), pos = get(r, 'POS'), ced = get(r, 'CEDICT');
    const vars = get(r, 'Variants'); if (vars && vars.startsWith('[')) { const v = JSON.parse(vars)[0]; simp = v.Simplified; py = v.Pinyin; trad = v.Traditional; pos = v.POS || pos; ced = v.CEDICT || ced; }
    simp = simp.split('|')[0]; trad = trad.split('|')[0]; py = py.split('|')[0];
    if (!simp || used.has(simp) || /[（）…\d]/.test(simp)) continue;
    const m = (ced || '').match(/^([^|]+)\|([^[]+)\[([^\]]+)\]/); const e = m ? (C.byFull.get(`${m[1]}|${m[2]}[${m[3]}]`) || C.bySimpPy.get(`${m[2]}[${m[3]}]`) || C.bySimpPy.get(`${m[2]}[${m[3].toLowerCase()}]`)) : (C.bySimp.get(simp) || [])[0];
    if (!e) continue; const defs = goodDefs(e.defs); if (!defs.length) continue;
    used.add(simp);
    const syl = e.py.split(' ').map(x => x.toLowerCase());
    const cl = e.defs.filter(d => d.startsWith('CL:')).map(d => d.slice(3).split(',').map(x => x.split('|').pop().replace(/\[.*$/, ''))).flat().slice(0, 3);
    const web = get(r, 'WebPinyin').split('|')[0].replace(/∥/g, '').replace(/·/g, '');
    const spoken = !web.includes('(') && web.replace(/\s+/g, '') !== py.replace(/\s+/g, '') && /bú|yí|yì/.test(web) ? web : undefined;
    items.push({ id: `zh:${simp}`, t: simp, alt: trad !== simp ? trad : undefined, r: py, syl, sp: spoken, pos: (pos || '').split('/')[0] || 'Other', g: { en: defs.slice(0, 3).join('; ') }, cl: cl.length ? cl : undefined, lvl: 'hsk' + get(r, 'Level'), slug: simp });
  }
  // Frequency in the sentence pool (proxy for usefulness), then examples
  const zhBlock = new Map(); const multi = items.filter(i => [...i.t].length > 1);
  for (const i of items) { const ch = i.t; zhBlock.set(ch, multi.filter(w => w.t !== ch && w.t.includes(ch)).map(w => w.t)); }
  const sentences = new Map(); const usedS = new Set();
  for (const it of items) {
    const blk = zhBlock.get(it.t) || [];
    const hits = pool.filter(s => s.t.includes(it.t) && !blk.some(w => s.t.includes(w)));
    it.n = hits.length;
    const ex = pickExamples(hits.slice(0, 60), 3); it.ex = ex.map(s => s.id); ex.forEach(s => usedS.add(s.id));
  }
  for (const lv of ['hsk1', 'hsk2']) { const arr = items.filter(i => i.lvl === lv).sort((a, b) => b.n - a.n || a.t.localeCompare(b.t)); arr.forEach((x, k) => x.rank = k + 1); }
  items.sort((a, b) => a.lvl.localeCompare(b.lvl) || a.rank - b.rank);
  // Characters
  const chars = new Map();
  for (const it of items) for (const ch of [...it.t]) { if (!chars.has(ch)) chars.set(ch, { c: ch, words: [], lvl: it.lvl }); chars.get(ch).words.push(it.t); }
  const hwd = path.join(ROOT, 'node_modules/hanzi-writer-data');
  const charList = [];
  for (const [ch, o] of chars) {
    const es = C.bySimp.get(ch) || []; const readings = [...new Set(es.map(e => markSyl(e.py.toLowerCase())))].slice(0, 4);
    const main = es.find(e => goodDefs(e.defs).length) || es[0];
    const sf = path.join(hwd, ch + '.json'); const strokes = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')).strokes.length : undefined;
    charList.push({ c: ch, alt: main && main.trad !== ch ? main.trad : undefined, r: readings, g: { en: main ? goodDefs(main.defs).slice(0, 3).join('; ') : '' }, words: o.words.slice(0, 12), lvl: o.lvl, strokes });
  }
  // Concepts
  const G = (await import(path.join(ROOT, 'content/grammar/zh.mjs')));
  const found = G.foundations.map(f => ({ id: `zh.f.${f.id}`, kind: f.kind, level: 'foundations', slug: f.slug, title: f.title, summary: f.summary, body: f.body, toneMode: f.toneMode, chars: f.chars, prereqs: (f.after || []).map(x => `zh.f.${x}`), threshold: { streak: f.kind === 'write' ? 6 : 8, sec: f.kind === 'write' ? 40 : 8 } }));
  const vocab = buildVocabConcepts('zh', items, P.levels, P.cluster, ['zh.f.tones']);
  const gs = new Set();
  const grammar = grammarConcepts('zh', G.default.map(g => g.id === 'mei' ? { ...g, allow: ['没有'] } : g), items, vocab, gs, pool, { zh: true, zhBlock, rootPrereqs: ['zh.f.tones'] });
  for (const id of gs) usedS.add(id);
  for (const s of pool) if (usedS.has(s.id)) sentences.set(s.id, s);
  const concepts = mergeOrder(vocab, grammar, found);
  const levels = [['foundations', 'Foundations'], ...P.levels].map(([id, name]) => ({ id, name }));
  return finish('zh', { items, chars: charList, concepts, sentences, levels, credits: ['hsk30', 'cedict', 'tatoeba', 'hanziwriter', 'original'] });
}

// ---------- European languages (es, fr, it, pt, de) ----------
const ART = { es: { m: 'el', f: 'la' }, fr: { m: 'le', f: 'la' }, it: { m: 'il', f: 'la' }, pt: { m: 'o', f: 'a' }, de: { m: 'der', f: 'die', n: 'das' } };
const BAD_TAGS = /vulgar|offensive|derogatory|slur|obsolete|archaic|dated|rare/;
// Wiktionary sometimes writes an inflection as plain text instead of a form-of
// link ("third-person plural preterite indicative of ir", "apocopic form of bueno").
// Turn those into real form-of senses so the word maps to its lemma, and drop
// historical forms ("Old Italian form of ...").
const FORM_NOTE = /^(?:(?:first|second|third)[- ]person\b|(?:masculine|feminine|neuter)\b|plural\b|singular\b|(?:past|present) participle\b|gerund\b|apocopic\b|apocopated\b|preconsonantal\b|elided\b|inflection\b|(?:strong|weak|mixed) |nominalization\b)[^:;,]*?\bof ([\p{L}]+)\s*\.?$/iu;
const HIST = /^(old|middle|medieval) [\p{L}]+ form of/iu;
function normalizeSenses(e) {
  for (const s of e.senses) {
    if (HIST.test(s.g)) { s.tags = [...s.tags, 'obsolete']; continue; }
    if (s.form_of.length) continue;
    const m = s.g.match(FORM_NOTE); if (m) { s.form_of = [m[1]]; s.tags = [...s.tags, 'form-of']; }
  }
}
// Curated fixes, kept as data (CC BY-SA 4.0): content/gloss-overrides/<lang>.json
//   gloss:  { lemma: "short English meaning" }   replaces the Wiktionary-derived gloss
//   _lemma: { surface: lemma }                   forces how a frequency-list word is lemmatized
//   _drop:  [surface]                            leaves a word out (noise, interjections, names)
//   pos:    { lemma: "noun" }                    part of speech for curated lemmas with no entry
function glossOverrides(l) {
  const f = path.join(ROOT, `content/gloss-overrides/${l}.json`);
  const o = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  return { gloss: o.gloss || {}, _lemma: o._lemma || {}, _drop: o._drop || [], pos: o.pos || {} };
}
function kaikkiIndex(l) {
  const by = new Map();
  for (const ln of read(`kaikki-${l}.jsonl`).split('\n')) { if (!ln) continue; const e = JSON.parse(ln); normalizeSenses(e); const k = e.word.toLowerCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
  return by;
}
function lemmaList(l, max) {
  const K = kaikkiIndex(l), R = freqRank(l), OV = glossOverrides(l); const seen = new Map(); const order = [];
  const LETTER = /\bletter\b|alphabet|\bname of the\b/i;
  const ALT = /^(alternative|obsolete|archaic|dated|nonstandard|misspelling|eye dialect) (form|spelling|typography) of|^(abbreviation|initialism|acronym) of|\bmisspelling of\b/i;
  const goodSense = s => !s.form_of.length && !s.tags.includes('form-of') && !LETTER.test(s.g) && !ALT.test(s.g) && !s.tags.some(t => BAD_TAGS.test(t));
  const isLemmaEntry = e => e.senses.some(goodSense);
  const FUNC = /^(conj|adv|prep|pron|det|article|particle|intj|num|contraction|postp)$/;
  for (const [w, rank] of R) {
    if (order.length >= max * 1.6) break;
    if (!/^[\p{L}]+$/u.test(w) || (w.length < 2 && !['a', 'o', 'y', 'e', 'é', 'à', 'è', 'ò'].includes(w))) continue;
    const cap = w[0].toUpperCase() + w.slice(1);
    const es = (K.get(w) || []).filter(e => e.word === w || (l === 'de' && e.word === cap)); if (!es.length) continue;
    let lemma = null, entries = es.filter(isLemmaEntry);
    // Curated lemma (content/gloss-overrides/<lang>.json "_lemma"): "casa" is casa, not a form of casar.
    if (OV._lemma[w]) {
      const t = OV._lemma[w]; const lk0 = t.toLowerCase();
      if (seen.has(lk0)) { seen.get(lk0).forms.add(w); continue; }
      const le0 = (K.get(lk0) || []).filter(e => e.word === t).map(e => ({ ...e, senses: e.senses.filter(goodSense) })).filter(e => e.senses.length);
      const ent = le0.length ? le0 : [{ word: t, pos: (OV.pos || {})[t] || 'phrase', senses: [] }];
      const o = { lemma: t, rank, entries: ent, forms: new Set([w]) }; seen.set(lk0, o); order.push(o); continue;
    }
    if (OV._drop.includes(w)) continue;
    // Form-of target: the most frequent lemma this word is a form of (creo -> creer, not crear).
    const targets = es.flatMap(e => e.senses).flatMap(s => s.form_of).map(t => K.get(t.toLowerCase()) ? t : t.split(' ')[0]).filter(t => K.get(t.toLowerCase())?.some(isLemmaEntry));
    const rk = t => R.get(t.toLowerCase()) ?? Infinity;
    const f = targets.sort((a, b) => rk(a) - rk(b))[0];
    // Inflected forms of very common words (est = être, ha = avere) win over rare homographs,
    // but a real noun only loses to a very common lemma (casa stays casa, parte stays parte).
    const PROTECT = /^(conj|prep|pron|det|article|adv|particle|contraction|postp|num)$/;
    const protectedEntry = entries.some(e => PROTECT.test(e.pos));
    const nounOnly = entries.length && entries.every(e => e.pos === 'noun' || e.pos === 'name');
    // Measured on the frequency lists: pasa (159) -> pasar (323) and oublie (770) -> oublier (970) are verb forms,
    // casa (91) vs casar (2632) and porte (287) vs porter (839) are real nouns.
    const formWins = f && !protectedEntry && (!nounOnly || rk(f) <= 100 || rk(f) <= 2.5 * rank);
    if (entries.length && !formWins) lemma = entries[0].word;
    else if (f) lemma = K.get(f.toLowerCase()).find(isLemmaEntry).word;
    if (!lemma) continue; const lk = lemma.toLowerCase();
    if (seen.has(lk)) { seen.get(lk).forms.add(w); continue; }
    const le = (K.get(lk) || []).filter(e => e.word === lemma).filter(isLemmaEntry).map(e => ({ ...e, senses: e.senses.filter(goodSense) })); if (!le.length) continue;
    if (le.every(e => e.senses.every(s => s.tags.some(t => /vulgar|offensive|derogatory/.test(t))))) continue;
    if (rank < 400) le.sort((a, b) => (FUNC.test(b.pos) || b.pos === 'verb') - (FUNC.test(a.pos) || a.pos === 'verb'));
    const o = { lemma, rank, entries: le, forms: new Set([w]) }; seen.set(lk, o); order.push(o);
  }
  return order;
}
// Turn Wiktionary senses into a short, translation-like gloss. Grammar notes
// ("contraction of zu + dem", "third-person plural of ...", "Used to ...") rank
// after real meanings and are dropped when a real meaning exists. Overlong
// senses are cut to their first comma-separated synonyms.
function cleanSense(g) {
  let t = g.replace(/\s*\([^)]*\)/g, '').replace(/[()\[\]]/g, '').trim();
  t = t.replace(/^(with (accusative|dative|genitive)( or (accusative|dative|genitive))?|transitive|intransitive|reflexive|colloquial|informal|formal|figuratively|literally)\s*,?\s*/i, '');
  const lit = t.match(/literally\s+[“"]([^”"]+)[”"]/i); if (lit && /^contraction of/i.test(t)) t = lit[1];
  t = t.replace(/\.$/, '').trim();
  if (t.length > MAX_PRIMARY) {
    const parts = t.split(/,\s+/); let out = parts[0];
    for (const x of parts.slice(1)) { if ((out + ', ' + x).length > 45) break; out += ', ' + x; }
    t = out.length <= MAX_PRIMARY ? out : t;
  }
  return t;
}
function glossOf(entries) {
  const good = [], notes = [];
  for (const e of entries.slice(0, 3)) for (const s of e.senses) {
    if (s.form_of.length || s.tags.some(t => BAD_TAGS.test(t)) || /\bletter\b|alphabet/i.test(s.g)) continue;
    // One Wiktionary sense can hold several ("apocopic form of mucho; very"): judge each part.
    for (let part of s.g.split(/;\s+/)) {
      let t = cleanSense(part); if (!t) continue;
      // "contraction of su + il: on the", "apocopic form of uno: a, an" -> keep the meaning after the colon.
      if ((isNoteSense(t) || t.length > MAX_PRIMARY) && /:\s+\S/.test(t)) t = cleanSense(t.slice(t.lastIndexOf(':') + 1));
      if (!t) continue;
      (isNoteSense(t) || t.length > MAX_PRIMARY ? notes : good).push(t);
    }
  }
  const senses = [...new Set(good.length ? good : notes)].slice(0, 3);
  let g = senses.join('; '); if (g.length > 90) g = g.slice(0, 88).replace(/[;,]?\s+\S*$/, '') + '…';
  return g;
}
function genderOf(e) { if (e.pos !== 'noun') return undefined; const h = (e.head || '').replace(e.word, ''); const m = h.match(/^\s*(m|f|n)\b/) || h.match(/\b(m|f|n)\b(?!\.)/); return m ? m[1] : undefined; }
function sentencePool(l, R) {
  const links = allLinks[l];
  const S = loadSentences(l, (id, t) => links.has(id));
  const pool = [];
  for (const [id, s] of S) {
    const tk = toks(s.t); if (tk.length < 2 || tk.length > 10) continue;
    let mx = 0; let ok = true; for (const t of tk) { const r = R.get(t); if (!r || r > 8000) { ok = false; break; } if (r > mx) mx = r; } if (!ok) continue;
    const x = (links.get(id) || []).map(x => EN.get(x)).find(Boolean); if (!x) continue;
    pool.push({ id, t: s.t, a: s.a, tr: x.t, ta: x.a, tk, mx });
  }
  pool.sort((a, b) => a.mx - b.mx || a.tk.length - b.tk.length || a.id - b.id);
  return pool;
}
async function buildEuro(l) {
  const P = PACKS[l], R = freqRank(l); const total = P.levels.reduce((s, x) => s + x[2], 0);
  const OVR = glossOverrides(l); const lem = lemmaList(l, total); log(l, 'lemmas', lem.length);
  const pool = sentencePool(l, R); log(l, 'sentence pool', pool.length);
  const byTok = new Map(); for (const s of pool) for (const t of new Set(s.tk)) { if (!byTok.has(t)) byTok.set(t, []); const a = byTok.get(t); if (a.length < 40) a.push(s); }
  const items = []; const slugs = new Set();
  for (const o of lem) {
    if (items.length >= total) break;
    const ov = OVR.gloss[o.lemma]; const g = ov || glossOf(o.entries); if (!g) continue;
    if (ov) o.curated = true;
    const e = o.entries[0]; const pos = e.pos;
    const forms = [...o.forms]; const cands = forms.flatMap(f => byTok.get(f) || []).sort((a, b) => a.mx - b.mx || a.tk.length - b.tk.length);
    const ex = pickExamples(cands, 3);
    let slug = o.lemma.toLowerCase(); if (slugs.has(slug)) slug += '-' + pos; if (slugs.has(slug)) continue; slugs.add(slug);
    const gen = genderOf(e);
    items.push({ id: `${l}:${o.lemma}`, t: o.lemma, pos, gen, art: gen && ART[l][gen], ipa: e.ipa, g: { en: g }, forms: forms.filter(f => f !== o.lemma.toLowerCase()).slice(0, 6), rank: o.rank, ex: ex.map(s => s.id), slug, _ex: ex });
  }
  let k = 0; for (const [lv, , n] of P.levels) { for (const it of items.slice(k, k + n)) it.lvl = lv; k += n; }
  const vocab = buildVocabConcepts(l, items.filter(i => i.lvl), P.levels, P.cluster);
  const G = (await import(path.join(ROOT, `content/grammar/${l}.mjs`))).default;
  const gs = new Set(); const grammar = grammarConcepts(l, G, items, vocab, gs, pool);
  const sentences = new Map(); for (const it of items) for (const s of it._ex) sentences.set(s.id, s); for (const s of pool) if (gs.has(s.id)) sentences.set(s.id, s);
  for (const it of items) delete it._ex;
  const concepts = mergeOrder(vocab, grammar);
  return finish(l, { items: items.filter(i => i.lvl), concepts, sentences, levels: P.levels.map(([id, name]) => ({ id, name })), credits: ['freq', 'wiktionary', 'tatoeba', 'original'] });
}

// ---------- English for speakers of Spanish, Portuguese and Mandarin ----------
async function buildEn() {
  const P = PACKS.en, R = freqRank('en'); const total = P.levels.reduce((s, x) => s + x[2], 0);
  // Reverse glosses: English headword -> best target word, from the es / pt Wiktionary glosses and CC-CEDICT.
  const rev = {};
  for (const b of ['es', 'pt']) {
    const m = new Map(); const lem = lemmaList(b, 5000);
    for (const o of lem) for (const e of o.entries.slice(0, 2)) for (const s of e.senses.slice(0, 2)) {
      if (s.form_of.length || s.tags.some(t => BAD_TAGS.test(t))) continue;
      const si = e.senses.indexOf(s);
      s.g.replace(/\([^)]*\)/g, '').split(/[;,]/).forEach((w, wi) => { w = w.trim().toLowerCase().replace(/[?!.]/g, '').replace(/^(to|a|an|the) /, ''); if (!/^[a-z]+$/.test(w)) return; const score = o.rank + 2000 * si + 800 * wi; const prev = m.get(w); if (!prev || prev.score > score) m.set(w, { t: o.lemma, rank: o.rank, score, pos: e.pos }); });
    }
    rev[b] = m;
  }
  { const C = cedict(); const m = new Map(); const csv = read('hsk30.csv').split('\n').slice(1);
    for (const ln of csv) { const p = ln.split(','); const lvl = parseInt(p[5]); if (!(lvl <= 4)) continue; const simp = p[1].split('|')[0]; if (/[（）…\d]/.test(simp)) continue; const e = (C.bySimp.get(simp) || [])[0]; if (!e) continue;
      goodDefs(e.defs).slice(0, 3).forEach((d, di) => { d.split(/[;,]/).forEach((w, wi) => { w = w.trim().toLowerCase().replace(/[?!.]/g, '').replace(/^(to|a|an|the) /, ''); if (!/^[a-z]+$/.test(w)) return; const score = lvl * 10 + di * 5 + wi * 3 + [...simp].length; const prev = m.get(w); if (!prev || prev.score > score) m.set(w, { t: simp, py: e.py.toLowerCase().split(' ').map(markSyl).join(''), score }); }); }); }
    rev.zh = m; }
  // English sentences with translations into the base languages (reverse Tatoeba links).
  const trOf = {}; for (const b of ['es', 'pt', 'zh']) { trOf[b] = new Map(); const S = loadSentences(b, id => allLinks[b].has(id)); for (const [id, en] of allLinks[b]) { const s = S.get(id); if (!s) continue; for (const e of en) if (!trOf[b].has(e)) trOf[b].set(e, s); } }
  const pool = [];
  for (const [id, s] of EN) { const tk = toks(s.t); if (tk.length < 2 || tk.length > 9) continue; let mx = 0, ok = true; for (const t of tk) { const r = R.get(t); if (!r || r > 6000) { ok = false; break; } mx = Math.max(mx, r); } if (!ok) continue;
    const tr = {}, ta = {}; for (const b of ['es', 'pt', 'zh']) { const x = trOf[b].get(id); if (x) { tr[b] = x.t; ta[b] = x.a; } } if (Object.keys(tr).length < 2) continue;
    pool.push({ id, t: s.t, a: s.a, tr, ta, tk, mx }); }
  pool.sort((a, b) => a.mx - b.mx || a.tk.length - b.tk.length || a.id - b.id); log('en pool', pool.length);
  const byTok = new Map(); for (const s of pool) for (const t of new Set(s.tk)) { if (!byTok.has(t)) byTok.set(t, []); const a = byTok.get(t); if (a.length < 40) a.push(s); }
  // Hand-checked translations for the most common words, where reverse lookup is unreliable.
  const OV = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/en-overrides.json'), 'utf8'));
  // English Wiktionary translation tables (preferred): pick the first sense whose
  // table has Spanish, Portuguese and Mandarin, and take its first one or two words.
  const WT = new Map();
  if (fs.existsSync(path.join(RAW, 'kaikki-en-tr.jsonl'))) for (const ln of read('kaikki-en-tr.jsonl').split('\n')) {
    if (!ln) continue; const e = JSON.parse(ln); if (!WT.has(e.word)) WT.set(e.word, []); WT.get(e.word).push(e);
  }
  // Ranking helpers: common words first; Mandarin must be a real CEDICT word with valid
  // reading matching CC-CEDICT (drops Min Nan readings such as 狗 káu), HSK words preferred.
  const FR = { es: freqRank('es'), pt: freqRank('pt') };
  const wrank = (b, w) => Math.max(...w.toLowerCase().split(/\s+/).map(x => FR[b].get(x) || 1e9));
  const CE = cedict(), HSK = new Set(read('hsk30.csv').split('\n').slice(1).map(ln => (ln.split(',')[1] || '').split('|')[0]));
  const plain = r => r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
  const pyOk = (simp, r) => (CE.bySimp.get(simp) || []).some(e => plain(e.py.replace(/u:/g, 'u').replace(/\d/g, '')) === plain(r));
  const fromTables = w => {
    for (const e of WT.get(w) || []) {
      const labels = [...new Set(['es', 'pt', 'zh'].flatMap(b => (e.tr[b] || []).map(t => t.s)))];
      // Several senses can have full tables; prefer the one that agrees with the reverse lookup
      // ("heart": corazón, not coraje), then the earliest.
      let best = null;
      for (const [li, lab] of labels.entries()) {
        if (/slang|vulgar|informal|colloquial|derogatory|figurative|archaic|obsolete|dated|dialect/i.test(lab)) continue;
        const pick = b => (e.tr[b] || []).filter(t => t.s === lab && !/[,;(]/.test(t.w) && !(t.tags || []).some(x => /slang|vulgar|archaic|obsolete|dated|regional|dialect|Taiwan|Hong Kong|literary|formal/i.test(x)));
        const simp = t => t.w.split(/\s*\/\s*/).pop();
        const es = pick('es'), pt = pick('pt'), zh = pick('zh').filter(t => /\p{Script=Han}/u.test(t.w) && t.r && pyOk(simp(t), t.r));
        if (!es.length || !pt.length || !zh.length) continue;
        // First word by frequency; a second synonym only when it is also common (no "urbe", "nosocomio").
        const two = (b, a) => { const u = [...new Set(a.map(t => t.w))].map((x, i) => [x, wrank(b, x), i]).sort((p, q) => (p[1] > 5000) - (q[1] > 5000) || p[2] - q[2]); return u.filter((x, i) => i === 0 || x[1] <= 3000).slice(0, 2).map(x => x[0]).join(' / '); };
        const z = zh.find(t => HSK.has(simp(t))) || zh[0];
        const agree = ['es', 'pt', 'zh'].reduce((n, b) => { const r = rev[b].get(w); return n + (r && (b === 'zh' ? zh : b === 'es' ? es : pt).some(t => (b === 'zh' ? simp(t) : t.w) === r.t) ? 1 : 0); }, 0);
        const c = { pos: e.pos, es: two('es', es), pt: two('pt', pt), zh: simp(z), py: z.r.replace(/\s+/g, ''), score: agree * 10 - Math.min(li, 9) };
        if (!best || c.score > best.score) best = c;
      }
      if (best) return best;
    }
    return null;
  };
  const items = [];
  for (const [w, rank] of R) {
    if (items.length >= total) break; if (!/^[a-z]{2,}$/.test(w) && w !== 'i') continue; if (OV._skip.includes(w)) continue;
    const ov = OV[w], wt = !ov && fromTables(w);
    const es = ov ? { t: ov.es, pos: ov.pos } : wt ? { t: wt.es, pos: wt.pos } : rev.es.get(w), pt = ov ? { t: ov.pt } : wt ? { t: wt.pt } : rev.pt.get(w), zh = ov ? { t: ov.zh, py: ov.py } : wt ? { t: wt.zh, py: wt.py } : rev.zh.get(w); if (!es || !pt || !zh) continue;
    const ex = pickExamples(byTok.get(w) || [], 3);
    items.push({ id: `en:${w}`, t: w, pos: es.pos, g: { es: es.t, pt: pt.t, zh: `${zh.t} (${zh.py})` }, rank, ex: ex.map(s => s.id), slug: w, _ex: ex });
  }
  let k = 0; for (const [lv, , n] of P.levels) { for (const it of items.slice(k, k + n)) it.lvl = lv; k += n; }
  const vocab = buildVocabConcepts('en', items, P.levels, P.cluster);
  for (const c of vocab) { const [, , lv, tr, n] = c.id.split('.'); const L = lv.toUpperCase(); c.title = { en: c.title.en, es: `${L} ${{ core: 'Palabras básicas', nouns: 'Cosas y personas', verbs: 'Acciones', describing: 'Palabras para describir' }[tr]} ${n}`, pt: `${L} ${{ core: 'Palavras básicas', nouns: 'Coisas e pessoas', verbs: 'Ações', describing: 'Palavras para descrever' }[tr]} ${n}`, zh: `${L} ${{ core: '核心词', nouns: '人和物', verbs: '动作', describing: '描述词' }[tr]} ${n}` }; }
  const G = (await import(path.join(ROOT, 'content/grammar/en.mjs'))).default;
  const gs = new Set(); const grammar = grammarConcepts('en', G, items, vocab, gs, pool);
  const sentences = new Map(); for (const it of items) for (const s of it._ex) sentences.set(s.id, s); for (const s of pool) if (gs.has(s.id)) sentences.set(s.id, s);
  for (const it of items) delete it._ex;
  return finish('en', { items, concepts: mergeOrder(vocab, grammar), sentences, levels: P.levels.map(([id, name]) => ({ id, name })), credits: ['freq', 'wiktionary', 'cedict', 'hsk30', 'tatoeba', 'original'] });
}

function finish(l, { items, chars, concepts, sentences, levels, credits }) {
  const P = PACKS[l]; const sent = {};
  for (const [id, s] of [...sentences].sort((a, b) => a[0] - b[0])) sent[id] = typeof s.tr === 'string' ? { t: s.t, a: s.a, tr: { en: s.tr }, ta: { en: s.ta } } : { t: s.t, a: s.a, tr: s.tr, ta: s.ta };
  // Validate the graph: unique ids, known prereqs, no cycles.
  const ids = new Set(); for (const c of concepts) { if (ids.has(c.id)) throw new Error('dup concept ' + c.id); ids.add(c.id); }
  for (const c of concepts) for (const p of c.prereqs) if (!ids.has(p)) throw new Error(`${c.id}: unknown prereq ${p}`);
  const idx = new Map(concepts.map((c, i) => [c.id, i])); for (const c of concepts) for (const p of c.prereqs) if (idx.get(p) >= idx.get(c.id)) throw new Error(`${c.id}: prereq ${p} comes later (order must be topological)`);
  const pack = { id: l, target: l, name: P.name, short: P.short, slug: P.slug, bases: P.bases, speech: P.speech, version: 1, levels, concepts, items, chars, sentences: sent, credits: credits.map(k => CREDITS[k]) };
  // Gloss check: the top words must have short, translation-like primary glosses.
  // Fix flagged words in content/gloss-overrides/<lang>.json (or content/en-overrides.json).
  const flagged = lintPack(pack);
  if (flagged.length) log(`${l}: ${flagged.length} flagged glosses in top ${LINT_TOP}:`, flagged.map(f => `${f.word}[${f.base}] ${f.reason}`).join(', '));
  if (flagged.length && process.env.GLOSS_STRICT) throw new Error(`${l}: gloss check failed`);
  fs.writeFileSync(path.join(OUT, `${l}.json`), JSON.stringify(pack));
  const counts = { concepts: concepts.length, vocab: concepts.filter(c => c.kind === 'vocab').length, grammar: concepts.filter(c => c.kind === 'grammar').length, foundations: concepts.filter(c => c.kind === 'tone' || c.kind === 'write').length, items: items.length, chars: chars ? chars.length : 0, sentences: Object.keys(sent).length };
  log(l, JSON.stringify(counts));
  return counts;
}

const summary = {};
if (want('zh')) summary.zh = await buildZh();
for (const l of ['es', 'fr', 'it', 'pt', 'de']) if (want(l)) summary[l] = await buildEuro(l);
if (want('en')) summary.en = await buildEn();
const sf = path.join(OUT, 'summary.json'); const prev = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : {};
fs.writeFileSync(sf, JSON.stringify({ ...prev, ...summary }, null, 1));
log('done');
