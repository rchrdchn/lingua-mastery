// Lists every text the site can speak, grouped into small per-owner bundles, and writes
// data/audio/plan.json for scripts/audio/build.py. Owners: i:<item id>, ch:<char>, c:<concept id>, d:<pack>.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { bundlePath, AUDIO_V } = require('../../lib/audiokey.js');
const demo = require('../../src/_data/demo.js')();

const TONES = { 'ā': 'a1', 'á': 'a2', 'ǎ': 'a3', 'à': 'a4', 'ē': 'e1', 'é': 'e2', 'ě': 'e3', 'è': 'e4', 'ī': 'i1', 'í': 'i2', 'ǐ': 'i3', 'ì': 'i4', 'ō': 'o1', 'ó': 'o2', 'ǒ': 'o3', 'ò': 'o4', 'ū': 'u1', 'ú': 'u2', 'ǔ': 'u3', 'ù': 'u4', 'ǖ': 'v1', 'ǘ': 'v2', 'ǚ': 'v3', 'ǜ': 'v4', 'ü': 'v5' };
/** 'nǐ' -> 'ni3', 'ma' -> 'ma5' (one syllable). */
export function numSyl(s) {
  let tone = 5, out = '';
  for (const ch of s.toLowerCase()) { const t = TONES[ch]; if (t) { out += t[0]; if (t[1] !== '5') tone = +t[1]; } else out += ch; }
  return out.replace(/[^a-zv]/g, '') + tone;
}

const plan = { v: AUDIO_V, packs: {} };
for (const id of ['zh', 'es', 'en', 'fr', 'it', 'pt', 'de']) {
  const P = JSON.parse(fs.readFileSync(`data/packs/${id}.json`, 'utf8'));
  const bundles = {};
  const add = (owner, clip) => {
    const b = (bundles[owner] ||= { file: bundlePath(id, owner), clips: [] });
    if (!clip.t || b.clips.some(c => c.t === clip.t)) return;
    b.clips.push(clip);
  };
  const S = sid => P.sentences[sid]?.t;
  for (const it of P.items) {
    add(`i:${it.id}`, { t: it.t, k: 'w', ...(it.syl ? { syl: it.syl } : {}) });
    for (const sid of it.ex || []) add(`i:${it.id}`, { t: S(sid), k: 's' });
  }
  for (const c of P.chars || []) add(`ch:${c.c}`, { t: c.c, k: 'w', syl: [numSyl(c.r[0])] });
  for (const c of P.concepts) {
    if (!(c.examples?.length || c.cloze?.sents?.length)) continue;
    for (const e of c.examples || []) add(`c:${c.id}`, { t: e.t, k: 's' });
    for (const sid of c.cloze?.sents || []) add(`c:${c.id}`, { t: S(sid), k: 's' });
  }
  const L = demo.langs.find(l => l.id === id);
  const sylOf = w => P.items.find(it => it.t === w)?.syl;
  for (const q of L?.qs || []) add(`d:${id}`, { t: q.w, k: 'w', ...(id === 'zh' ? { syl: sylOf(q.w) || q.r.split(/\s+/).map(numSyl) } : {}) });
  for (const c of demo.byLang[id] || []) add(`d:${id}`, { t: c.t, k: 's' });
  // Multi-character words with known pinyin, so sentence readings can be corrected.
  const lex = id === 'zh' ? Object.fromEntries(P.items.filter(it => it.syl && [...it.t].length === it.syl.length).map(it => [it.t, it.syl])) : undefined;
  plan.packs[id] = { speech: P.speech, bundles, ...(lex ? { lex } : {}) };
  const n = Object.values(bundles).reduce((a, b) => a + b.clips.length, 0);
  console.log(id, Object.keys(bundles).length, 'bundles', n, 'clips');
}
fs.writeFileSync('data/audio/plan.json', JSON.stringify(plan));
