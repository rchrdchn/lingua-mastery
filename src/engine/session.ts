// Applies an answer: updates concept mastery, FSRS cards and XP.
import type { Progress } from './types';
import type { PackIndex } from './graph';
import type { Planned } from './scheduler';
import { recordAttempt, startLearning, stateOf } from './mastery';
import { ensureCard, gradeFor, review } from './review';
import { dayKey } from './util';

export const XP = { new: 2, review: 1, check: 2, mastered: 10 };

export interface Outcome { xp: number; masteredNow: boolean; lost: boolean }

export function applyAnswer(ix: PackIndex, p: Progress, ex: Planned, correct: boolean, seconds: number, now = Date.now()): Outcome {
  const c = ix.concept.get(ex.conceptId)!;
  let xp = 0, masteredNow = false, lost = false;
  if (ex.mode === 'review') {
    // Item-level review: FSRS only, plus refresh the concept's decay clock.
    if (correct) { xp += XP.review; stateOf(p, c.id).last = now; }
  } else {
    startLearning(p, c, now);
    const r = recordAttempt(p, c, correct, seconds, now);
    masteredNow = r.masteredNow; lost = r.lost;
    if (correct) xp += ex.mode === 'check' ? XP.check : XP.new;
    if (masteredNow) xp += XP.mastered;
  }
  if (ex.itemId) {
    ensureCard(p, ex.itemId, now);
    review(p, ex.itemId, gradeFor(correct, seconds, c.threshold.sec), now);
  }
  p.xp += xp;
  if (ex.mode !== 'check') p.xpSinceCheck += xp;
  const d = dayKey(now); p.days[d] = (p.days[d] ?? 0) + xp;
  return { xp, masteredNow, lost };
}

/** Called once a mastery check finishes, whatever the result. */
export function finishCheck(p: Progress) { p.xpSinceCheck = 0; }

export function streakDays(p: Progress, now = Date.now()): number {
  let n = 0; let t = now;
  if (!p.days[dayKey(t)]) t -= 86400000;
  while (p.days[dayKey(t)]) { n++; t -= 86400000; }
  return n;
}
