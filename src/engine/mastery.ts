// Mastery tracking, ported from Mathua's model (MIT): a concept is mastered
// when the learner gets `threshold.streak` answers right in a row AND their
// average time on that streak is under `threshold.sec`. Mastered concepts not
// practiced for DECAY_DAYS become "decaying" and are pulled back into review.
import type { Concept, ConceptState, Progress } from './types';
import { DAY } from './util';

export const DECAY_DAYS = 14;
export const PRACTICING_AT = 3;    // correct streak that moves learning -> practicing

export function blank(): ConceptState {
  return { status: 'unseen', streak: 0, attempts: 0, correct: 0, times: [], last: 0 };
}

export function stateOf(p: Progress, id: string): ConceptState {
  return p.concepts[id] ?? (p.concepts[id] = blank());
}

export function startLearning(p: Progress, c: Concept, now = Date.now()) {
  const s = stateOf(p, c.id);
  if (s.status === 'unseen') { s.status = 'learning'; s.last = now; }
}

export interface AttemptResult { masteredNow: boolean; lost: boolean }

export function recordAttempt(p: Progress, c: Concept, correct: boolean, seconds: number, now = Date.now()): AttemptResult {
  const s = stateOf(p, c.id);
  const before = s.status;
  if (s.status === 'unseen') s.status = 'learning';
  s.attempts++; s.last = now;
  if (correct) {
    s.correct++; s.streak++;
    s.times.push(Math.min(seconds, 120));
    if (s.times.length > c.threshold.streak) s.times.shift();
  } else {
    s.streak = 0; s.times = [];
  }
  const avg = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : Infinity;
  let masteredNow = false, lost = false;
  if (before === 'mastered' || before === 'decaying') {
    if (correct) s.status = 'mastered';
    else { s.status = 'practicing'; lost = true; s.placed = false; }
  } else if (s.streak >= c.threshold.streak && avg <= c.threshold.sec) {
    s.status = 'mastered'; masteredNow = true;
  } else if (s.streak >= PRACTICING_AT || s.status === 'practicing') {
    s.status = 'practicing';
  }
  return { masteredNow, lost };
}

export function markMastered(p: Progress, id: string, placed = false, now = Date.now()) {
  const s = stateOf(p, id);
  s.status = 'mastered'; s.last = now; if (placed) s.placed = true;
}

/** Flip long-unseen mastered concepts to decaying. Returns ids that changed. */
export function applyDecay(p: Progress, now = Date.now()): string[] {
  const out: string[] = [];
  for (const [id, s] of Object.entries(p.concepts)) {
    if (s.status === 'mastered' && now - s.last > DECAY_DAYS * DAY) { s.status = 'decaying'; out.push(id); }
  }
  return out;
}

export function avgTime(s: ConceptState): number {
  return s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : 0;
}
