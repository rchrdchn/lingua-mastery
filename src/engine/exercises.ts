// Exercise generators. Everything is built from pack data at runtime, so a new
// pack gets recognition, recall, cloze and listening drills for free.
import type { Base, Concept, Exercise, ExerciseType, Item, Sentence } from './types';
import type { PackIndex } from './graph';
import { joinSyl, markSyl, toneOf, toneVariants, baseSyl } from './pinyin';
import { pick, sample, shuffle, shortGloss, uniq, rng, norm, fold } from './util';

export interface ExOpts { base: Base; speech: boolean; typing?: boolean }

export const BLANK = '＿＿＿';

export function gloss(it: Item, base: Base): string { return it.g[base] ?? it.g.en ?? ''; }
export function tr(s: Sentence, base: Base): string { return s.tr[base] ?? s.tr.en ?? ''; }
const isZh = (ix: PackIndex) => ix.pack.target === 'zh';

function credit(s: Sentence, base: Base): string {
  const t = s.ta[base] ?? s.ta.en;
  return `Tatoeba: ${s.a}${t ? ` / ${t}` : ''} (CC BY 2.0 FR)`;
}

/** Items for distractors: same level first, then the whole pack. */
function pool(ix: PackIndex, it: Item): Item[] {
  const same = ix.pack.items.filter(x => x.lvl === it.lvl && x.id !== it.id);
  return same.length >= 6 ? same : ix.pack.items.filter(x => x.id !== it.id);
}

function choicesFrom(correct: string, candidates: string[], n = 4): string[] {
  const seen = new Set([correct.toLowerCase()]);
  const out = [correct];
  for (const c of shuffle(candidates)) {
    if (out.length >= n) break;
    const k = c.toLowerCase();
    if (!c || seen.has(k)) continue;
    seen.add(k); out.push(c);
  }
  return shuffle(out);
}

export function recognition(ix: PackIndex, c: Concept, it: Item, o: ExOpts): Exercise {
  const ans = shortGloss(gloss(it, o.base));
  return {
    type: 'recognition', conceptId: c.id, itemId: it.id, prompt: it.t,
    speak: it.t, answer: ans,
    choices: choicesFrom(ans, pool(ix, it).map(x => shortGloss(gloss(x, o.base)))),
    explain: explainItem(it, o.base),
  };
}

export function recall(ix: PackIndex, c: Concept, it: Item, o: ExOpts): Exercise {
  const prompt = shortGloss(gloss(it, o.base), 80);
  if (o.typing && !isZh(ix)) {
    return { type: 'typed', conceptId: c.id, itemId: it.id, prompt, answer: it.t, accept: it.forms ?? [], speak: it.t, explain: explainItem(it, o.base) };
  }
  const label = (x: Item) => (isZh(ix) && x.r ? `${x.t}  ${x.r}` : x.t);
  return {
    type: 'recall', conceptId: c.id, itemId: it.id, prompt, answer: label(it), speak: it.t,
    choices: choicesFrom(label(it), pool(ix, it).map(label)), explain: explainItem(it, o.base),
  };
}

export function listening(ix: PackIndex, c: Concept, it: Item, o: ExOpts): Exercise {
  const ex = recognition(ix, c, it, o);
  return { ...ex, type: 'listening', prompt: '🔊', sub: undefined };
}

/** Find `word` in a sentence and blank it. Word-boundary aware for spaced scripts. */
export function blankOut(text: string, word: string, zh: boolean): string | null {
  if (zh) { const i = text.indexOf(word); return i < 0 ? null : text.slice(0, i) + BLANK + text.slice(i + word.length); }
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}\\p{M}'])(${esc})(?=$|[^\\p{L}\\p{M}])`, 'iu');
  const m = re.exec(text); if (!m) return null;
  const start = m.index + m[1].length;
  return text.slice(0, start) + BLANK + text.slice(start + m[2].length);
}

/** Vocabulary cloze from an item's example sentences. */
export function itemCloze(ix: PackIndex, c: Concept, it: Item, o: ExOpts): Exercise | null {
  const zh = isZh(ix);
  for (const sid of shuffle(it.ex ?? [])) {
    const s = ix.pack.sentences[sid]; if (!s) continue;
    const forms = uniq([it.t, ...(it.forms ?? [])]);
    for (const f of forms) {
      const b = blankOut(s.t, f, zh); if (!b) continue;
      const others = ix.itemsOf(c).filter(x => x.id !== it.id).map(x => x.t);
      const extra = pool(ix, it).filter(x => x.pos === it.pos).map(x => x.t);
      return {
        type: 'cloze', conceptId: c.id, itemId: it.id, prompt: b, sub: tr(s, o.base), speak: s.t,
        answer: f, choices: choicesFrom(f, [...others, ...extra]), explain: explainItem(it, o.base), credit: credit(s, o.base),
      };
    }
  }
  return null;
}

/** Grammar cloze: blank one of the concept's answer tokens in a Tatoeba sentence. */
export function grammarCloze(ix: PackIndex, c: Concept, o: ExOpts): Exercise | null {
  const cl = c.cloze; if (!cl) return null;
  const zh = isZh(ix);
  for (const sid of shuffle(cl.sents ?? [])) {
    const s = ix.pack.sentences[sid]; if (!s) continue;
    for (const a of shuffle(cl.answers)) {
      const b = blankOut(s.t, a, zh); if (!b) continue;
      const actual = zh ? a : (s.t.match(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu'))?.[0] ?? a);
      const opts = choicesFrom(actual, cl.pool.filter(x => x.toLowerCase() !== a.toLowerCase()));
      return { type: 'cloze', conceptId: c.id, prompt: b, sub: tr(s, o.base), speak: s.t, answer: actual, choices: opts, credit: credit(s, o.base), explain: c.pattern };
    }
  }
  // Fallback to the concept's own examples (written for this site).
  for (const e of shuffle(c.examples ?? [])) for (const a of cl.answers) {
    const b = blankOut(e.t, a, zh); if (!b) continue;
    return { type: 'cloze', conceptId: c.id, prompt: b, sub: e.tr[o.base] ?? e.tr.en, speak: e.t, answer: a, choices: choicesFrom(a, cl.pool), explain: c.pattern };
  }
  return null;
}

function explainItem(it: Item, base: Base): string {
  return [it.t, it.r, it.ipa, it.pos ? `(${it.pos})` : '', '·', gloss(it, base)].filter(Boolean).join(' ');
}

/** Tone drills for Mandarin foundations. */
export function toneDrill(ix: PackIndex, c: Concept, o: ExOpts): Exercise | null {
  const items = ix.pack.items.filter(i => i.syl && i.lvl === 'hsk1');
  const mode = c.toneMode ?? 'single';
  let it: Item | undefined, answer = '', choices: string[] = [];
  if (mode === 'single') {
    it = pick(items.filter(i => i.syl!.length === 1 && toneOf(i.syl![0]) !== 5));
    answer = markSyl(it.syl![0]); choices = shuffle(toneVariants(it.syl![0]));
  } else if (mode === 'neutral') {
    it = pick(items.filter(i => i.syl!.some(s => toneOf(s) === 5)));
    answer = joinSyl(it.syl!);
    const k = it.syl!.findIndex(s => toneOf(s) === 5);
    choices = shuffle(uniq([answer, ...[1, 2, 3, 4].map(t => joinSyl(it!.syl!.map((s, j) => (j === k ? baseSyl(s) + t : s))))]).slice(0, 4));
    if (!choices.includes(answer)) choices[0] = answer;
  } else if (mode === 'pair') {
    it = pick(items.filter(i => i.syl!.length === 2 && i.syl!.every(s => toneOf(s) !== 5)));
    answer = joinSyl(it.syl!);
    const alts = new Set<string>([answer]);
    let guard = 0;
    while (alts.size < 4 && guard++ < 50) {
      const t1 = 1 + Math.floor(rng() * 4), t2 = 1 + Math.floor(rng() * 4);
      alts.add(markSyl(baseSyl(it.syl![0]) + t1) + markSyl(baseSyl(it.syl![1]) + t2));
    }
    choices = shuffle([...alts]);
  } else {
    const sand = ix.pack.items.filter(i => i.sp && i.sp !== i.r);
    if (!sand.length) return null;
    it = pick(sand);
    answer = it.sp!;
    choices = shuffle(uniq([answer, it.r!, ...sample(sand.filter(x => x.id !== it!.id), 4).map(x => x.sp!)]).slice(0, 4));
    if (!choices.includes(answer)) choices[0] = answer;
    return { type: 'tone', conceptId: c.id, prompt: it.t, sub: `${it.r} · ${shortGloss(gloss(it, o.base))}`, speak: it.t, answer, choices, explain: `${it.t}: written ${it.r}, said ${it.sp}` };
  }
  return { type: 'tone', conceptId: c.id, prompt: it.t, sub: shortGloss(gloss(it, o.base)), speak: it.t, answer, choices, explain: explainItem(it, o.base) };
}

export function writeDrill(ix: PackIndex, c: Concept, ch: string, o: ExOpts): Exercise {
  const info = ix.pack.chars?.find(x => x.c === ch);
  return { type: 'write', conceptId: c.id, itemId: `char:${ch}`, char: ch, prompt: ch, sub: info ? `${info.r.join(', ')} · ${shortGloss(info.g[o.base] ?? info.g.en)}` : '', answer: ch, speak: ch };
}

/** Choose an exercise type for a vocab item given how far along the concept is. */
export function forItem(ix: PackIndex, c: Concept, it: Item, streak: number, o: ExOpts, prefer?: ExerciseType): Exercise {
  const options: ExerciseType[] = streak < 2 ? ['recognition'] : ['recognition', 'recall', 'cloze', ...(o.speech ? ['listening' as const] : [])];
  if (streak >= 4) options.push('recall', 'cloze');
  const t = prefer ?? pick(options);
  if (t === 'cloze') { const e = itemCloze(ix, c, it, o); if (e) return e; return recall(ix, c, it, { ...o, typing: o.typing && streak >= 4 }); }
  if (t === 'recall') return recall(ix, c, it, { ...o, typing: o.typing && streak >= 4 });
  if (t === 'listening' && o.speech) return listening(ix, c, it, o);
  return recognition(ix, c, it, o);
}

/** A batch of exercises for one concept. */
export function forConcept(ix: PackIndex, c: Concept, n: number, streak: number, o: ExOpts): Exercise[] {
  const out: Exercise[] = [];
  if (c.kind === 'vocab') {
    const items = ix.itemsOf(c);
    let bag: Item[] = [];
    for (let i = 0; i < n; i++) {
      if (!bag.length) bag = shuffle(items);
      out.push(forItem(ix, c, bag.pop()!, streak + i, o));
    }
  } else if (c.kind === 'grammar') {
    for (let i = 0; i < n; i++) { const e = grammarCloze(ix, c, o); if (e) out.push(e); }
  } else if (c.kind === 'tone') {
    for (let i = 0; i < n; i++) { const e = toneDrill(ix, c, o); if (e) out.push(e); }
  } else if (c.kind === 'write') {
    const chars = shuffle(c.chars ?? []);
    for (let i = 0; i < Math.min(n, chars.length); i++) out.push(writeDrill(ix, c, chars[i], o));
  }
  return out;
}

/** Answer checking with accent-tolerant "almost" feedback for typed answers. */
export function check(ex: Exercise, given: string): { correct: boolean; almost: boolean } {
  if (ex.type === 'typed') {
    const ok = [ex.answer, ...(ex.accept ?? [])];
    if (ok.some(a => norm(a) === norm(given))) return { correct: true, almost: false };
    if (ok.some(a => fold(a) === fold(given))) return { correct: false, almost: true };
    return { correct: false, almost: false };
  }
  return { correct: given === ex.answer, almost: false };
}
