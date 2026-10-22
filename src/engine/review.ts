// Item-level spaced review with FSRS (ts-fsrs, MIT). Each vocabulary item (and
// each character for write drills) gets a card once its concept is practiced.
import { fsrs, createEmptyCard, Rating, type Card, type Grade } from 'ts-fsrs';
import type { CardState, Progress } from './types';

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

function toCard(s: CardState): Card {
  return {
    due: new Date(s.due), stability: s.stability, difficulty: s.difficulty,
    elapsed_days: s.elapsed_days, scheduled_days: s.scheduled_days, learning_steps: s.learning_steps,
    reps: s.reps, lapses: s.lapses, state: s.state, last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as Card;
}
function fromCard(c: Card): CardState {
  return {
    due: +c.due, stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days, learning_steps: (c as any).learning_steps ?? 0, reps: c.reps,
    lapses: c.lapses, state: c.state as number, last_review: c.last_review ? +c.last_review : undefined,
  };
}

/** Grade from correctness and speed relative to the concept's time target. */
export function gradeFor(correct: boolean, seconds: number, targetSec: number): Grade {
  if (!correct) return Rating.Again;
  if (seconds <= targetSec * 0.5) return Rating.Easy;
  if (seconds <= targetSec * 1.5) return Rating.Good;
  return Rating.Hard;
}

export function ensureCard(p: Progress, key: string, now = Date.now()) {
  if (!p.cards[key]) p.cards[key] = fromCard(createEmptyCard(new Date(now)));
}

export function review(p: Progress, key: string, grade: Grade, now = Date.now()) {
  ensureCard(p, key, now);
  const next = scheduler.next(toCard(p.cards[key]), new Date(now), grade);
  p.cards[key] = fromCard(next.card);
}

/** Seed a card as if answered "Good" (used by placement for skipped material). */
export function seedKnown(p: Progress, key: string, now = Date.now()) {
  if (p.cards[key]) return;
  ensureCard(p, key, now);
  review(p, key, Rating.Good, now);
}

export function dueKeys(p: Progress, now = Date.now()): string[] {
  return Object.entries(p.cards).filter(([, c]) => c.due <= now).sort((a, b) => a[1].due - b[1].due).map(([k]) => k);
}

export { Rating };
export type { Grade };
