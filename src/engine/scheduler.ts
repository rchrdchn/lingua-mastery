// What to do next. Ported from Mathua's scheduler idea (MIT): keep working the
// frontier of unlocked concepts, mix in due reviews (about 30% of a session),
// and run a short mastery check every 50 XP.
import type { Concept, Exercise, Progress } from './types';
import { frontier, isDone, type PackIndex } from './graph';
import { forConcept, forItem, writeDrill, type ExOpts } from './exercises';
import { applyDecay, stateOf } from './mastery';
import { dueKeys } from './review';
import { sample, shuffle } from './util';

export const SESSION = 10;
export const REVIEW_SHARE = 0.3;
export const CHECK_EVERY = 50;
export const CHECK_SIZE = 5;

export type Mode = 'new' | 'review' | 'check';
export interface Planned extends Exercise { mode: Mode }
export interface Plan { kind: 'lesson' | 'practice' | 'review' | 'check' | 'done'; concept?: Concept; exercises: Planned[] }

function reviewExercise(ix: PackIndex, p: Progress, key: string, o: ExOpts): Planned | null {
  if (key.startsWith('char:')) {
    const ch = key.slice(5);
    const c = ix.pack.concepts.find(x => x.kind === 'write' && x.chars?.includes(ch));
    return c ? { ...writeDrill(ix, c, ch, o), mode: 'review' } : null;
  }
  const it = ix.item.get(key); if (!it) return null;
  const c = ix.concept.get(it.concept); if (!c) return null;
  return { ...forItem(ix, c, it, 3, o), mode: 'review' };
}

export function plan(ix: PackIndex, p: Progress, o: ExOpts, now = Date.now()): Plan {
  applyDecay(p, now);
  const mastered = ix.pack.concepts.filter(c => isDone(p, c.id) && c.kind !== 'write');

  if (p.xpSinceCheck >= CHECK_EVERY && mastered.length) {
    const decaying = mastered.filter(c => stateOf(p, c.id).status === 'decaying');
    const picks = [...decaying, ...shuffle(mastered.filter(c => !decaying.includes(c)))].slice(0, CHECK_SIZE);
    const ex = picks.flatMap(c => forConcept(ix, c, 1, 5, o)).map(e => ({ ...e, mode: 'check' as Mode }));
    if (ex.length) return { kind: 'check', exercises: ex };
  }

  const due = dueKeys(p, now);
  const f = frontier(ix, p);
  const c = f[0];
  if (!c) {
    const ex = due.slice(0, SESSION).map(k => reviewExercise(ix, p, k, o)).filter((x): x is Planned => !!x);
    return ex.length ? { kind: 'review', exercises: ex } : { kind: 'done', exercises: [] };
  }
  const nReview = Math.min(due.length, Math.round(SESSION * REVIEW_SHARE));
  const reviews = due.slice(0, nReview).map(k => reviewExercise(ix, p, k, o)).filter((x): x is Planned => !!x);
  const st = stateOf(p, c.id);
  const fresh = forConcept(ix, c, SESSION - reviews.length, st.streak, o).map(e => ({ ...e, mode: 'new' as Mode }));
  // Interleave: reviews spread through the session, never first.
  const out: Planned[] = [...fresh];
  reviews.forEach((r, i) => out.splice(Math.min(out.length, 2 + i * 3), 0, r));
  return { kind: st.status === 'unseen' ? 'lesson' : 'practice', concept: c, exercises: out };
}

/** Practice one chosen concept (from a word or grammar page link). */
export function planConcept(ix: PackIndex, p: Progress, c: Concept, o: ExOpts): Plan {
  const st = stateOf(p, c.id);
  const ex = forConcept(ix, c, SESSION, isDone(p, c.id) ? 5 : st.streak, o).map(e => ({ ...e, mode: (isDone(p, c.id) ? 'review' : 'new') as Mode }));
  return { kind: st.status === 'unseen' ? 'lesson' : 'practice', concept: c, exercises: ex };
}

/** Quick overview numbers for the dashboard. */
export function summary(ix: PackIndex, p: Progress, now = Date.now()) {
  const total = ix.pack.concepts.length;
  const by: Record<'mastered' | 'decaying' | 'practicing' | 'learning' | 'unseen', number> = { mastered: 0, decaying: 0, practicing: 0, learning: 0, unseen: 0 };
  for (const c of ix.pack.concepts) by[(p.concepts[c.id]?.status ?? 'unseen') as keyof typeof by]++;
  return { total, ...by, due: dueKeys(p, now).length, xp: p.xp, toCheck: Math.max(0, CHECK_EVERY - p.xpSinceCheck) };
}

export { sample };
