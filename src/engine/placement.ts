// Placement quiz. The vocabulary of each level is split into two bands (first
// and second half of the level). Each band asks 5 recognition questions; 4/5
// passes the band, marks its concepts (and their prerequisites) as mastered,
// and moves on. The quiz stops at the first failed band.
import type { Concept, Exercise, Progress } from './types';
import { ancestors, isDone, type PackIndex } from './graph';
import { recognition, recall, type ExOpts } from './exercises';
import { markMastered } from './mastery';
import { seedKnown } from './review';
import { sample } from './util';

export const PER_BAND = 5;
export const PASS_AT = 4;

export interface Band { id: string; label: string; level: string; concepts: Concept[]; last: boolean }

export function bands(ix: PackIndex): Band[] {
  const out: Band[] = [];
  for (const lv of ix.pack.levels) {
    const vocab = ix.pack.concepts.filter(c => c.level === lv.id && c.kind === 'vocab');
    if (!vocab.length) continue;
    const half = Math.ceil(vocab.length / 2);
    out.push({ id: `${lv.id}-1`, label: `${lv.name} (1/2)`, level: lv.id, concepts: vocab.slice(0, half), last: false });
    out.push({ id: `${lv.id}-2`, label: `${lv.name} (2/2)`, level: lv.id, concepts: vocab.slice(half), last: true });
  }
  return out;
}

export function bandQuestions(ix: PackIndex, b: Band, o: ExOpts): Exercise[] {
  const items = b.concepts.flatMap(c => ix.itemsOf(c).map(it => ({ c, it })));
  return sample(items, PER_BAND).map(({ c, it }, i) => (i % 2 ? recall(ix, c, it, { ...o, typing: false }) : recognition(ix, c, it, o)));
}

/** Apply a passed band to progress. */
export function passBand(ix: PackIndex, p: Progress, b: Band, now = Date.now()) {
  const ids = new Set<string>();
  for (const c of b.concepts) { ids.add(c.id); for (const a of ancestors(ix, c.id)) ids.add(a); }
  // Passing a band also covers every concept in earlier levels (e.g. Mandarin foundations).
  const bIdx = ix.pack.levels.findIndex(l => l.id === b.level);
  for (const c of ix.pack.concepts) if (ix.pack.levels.findIndex(l => l.id === c.level) < bIdx) ids.add(c.id);
  for (const id of ids) {
    if (isDone(p, id)) continue;
    markMastered(p, id, true, now);
    for (const it of ix.itemsOf(ix.concept.get(id)!)) seedKnown(p, it.id, now);
  }
  // A fully passed level also covers its grammar/tone/write concepts once their prerequisites hold.
  if (b.last) {
    for (const c of ix.pack.concepts) {
      if (c.kind === 'vocab' || isDone(p, c.id)) continue;
      const lvIdx = ix.pack.levels.findIndex(l => l.id === c.level);
      if (lvIdx <= bIdx && c.prereqs.every(x => isDone(p, x))) markMastered(p, c.id, true, now);
    }
  }
}

export function finishPlacement(p: Progress) { p.placementDone = true; }
