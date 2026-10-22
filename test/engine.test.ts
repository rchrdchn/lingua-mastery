// Engine tests: graph validity for every pack, mastery rules, placement and scheduling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { Pack } from '../src/engine/types';
import { indexPack, frontier, isUnlocked } from '../src/engine/graph';
import { recordAttempt, applyDecay, DECAY_DAYS } from '../src/engine/mastery';
import { newProgress } from '../src/engine/store';
import { plan, CHECK_EVERY } from '../src/engine/scheduler';
import { applyAnswer } from '../src/engine/session';
import { bands, passBand } from '../src/engine/placement';
import { forConcept, check, blankOut } from '../src/engine/exercises';
import { markSyl } from '../src/engine/pinyin';
import { dueKeys } from '../src/engine/review';

const load = (id: string): Pack => JSON.parse(fs.readFileSync(`data/packs/${id}.json`, 'utf8'));
const IDS = ['zh', 'es', 'en', 'fr', 'it', 'pt', 'de'];

test('pinyin tone marks', () => {
  assert.equal(markSyl('hao3'), 'hǎo'); assert.equal(markSyl('lv4'), 'lǜ'); assert.equal(markSyl('gou3'), 'gǒu');
  assert.equal(markSyl('ma5'), 'ma'); assert.equal(markSyl('xie4'), 'xiè'); assert.equal(markSyl('dui4'), 'duì');
});

test('blankOut respects word boundaries', () => {
  assert.equal(blankOut('Él es mi amigo.', 'es', false), 'Él ＿＿＿ mi amigo.');
  assert.equal(blankOut('Esto es', 'es', false), 'Esto ＿＿＿');
  assert.equal(blankOut('我是学生。', '是', true), '我＿＿＿学生。');
});

for (const id of IDS) {
  test(`${id}: pack graph is valid and every concept yields exercises`, () => {
    const pack = load(id); const ix = indexPack(pack);
    for (const base of pack.bases) {
      const o = { base, speech: false, typing: id !== 'zh' };
      for (const c of pack.concepts) {
        const ex = forConcept(ix, c, 4, 5, o);
        assert.ok(ex.length > 0, `${c.id} produced no exercises for base ${base}`);
        for (const e of ex) {
          assert.ok(e.answer, `${c.id} empty answer`);
          if (e.choices) assert.ok(e.choices.includes(e.answer), `${c.id}: answer missing from choices (${e.type})`);
          if (e.choices) assert.equal(new Set(e.choices).size, e.choices.length, `${c.id}: duplicate choices`);
        }
      }
    }
    const p = newProgress(id, pack.bases[0]);
    assert.ok(frontier(ix, p).length > 0, 'something is unlocked at the start');
  });
}

test('mastery needs a streak and speed; a miss resets the streak', () => {
  const ix = indexPack(load('zh')); const c = ix.pack.concepts.find(x => x.kind === 'vocab')!;
  const p = newProgress('zh', 'en');
  for (let i = 0; i < c.threshold.streak - 1; i++) recordAttempt(p, c, true, 2);
  assert.equal(p.concepts[c.id].status, 'practicing');
  recordAttempt(p, c, false, 2); assert.equal(p.concepts[c.id].streak, 0);
  for (let i = 0; i < c.threshold.streak; i++) recordAttempt(p, c, true, c.threshold.sec * 3);
  assert.notEqual(p.concepts[c.id].status, 'mastered', 'too slow to count as mastered');
  for (let i = 0; i < c.threshold.streak; i++) recordAttempt(p, c, true, 1);
  assert.equal(p.concepts[c.id].status, 'mastered');
  applyDecay(p, Date.now() + (DECAY_DAYS + 1) * 86400000);
  assert.equal(p.concepts[c.id].status, 'decaying');
});

test('mastering prerequisites unlocks dependents', () => {
  const ix = indexPack(load('zh')); const p = newProgress('zh', 'en');
  const c2 = ix.concept.get('zh.v.hsk1.core.2')!;
  assert.equal(isUnlocked(ix, p, c2), false);
  for (const id of ['zh.f.tones', 'zh.v.hsk1.core.1']) { const c = ix.concept.get(id)!; for (let i = 0; i < 12; i++) recordAttempt(p, c, true, 1); }
  assert.equal(isUnlocked(ix, p, c2), true);
});

test('placement band pass marks concepts and seeds review cards', () => {
  const ix = indexPack(load('zh')); const p = newProgress('zh', 'en');
  const b = bands(ix)[0]; passBand(ix, p, b);
  for (const c of b.concepts) assert.equal(p.concepts[c.id].status, 'mastered');
  assert.equal(p.concepts['zh.f.tones'].status, 'mastered', 'ancestors are placed too');
  assert.ok(Object.keys(p.cards).length >= b.concepts.length * 5);
  assert.equal(dueKeys(p).length, 0, 'seeded cards are not due today');
  assert.ok(dueKeys(p, Date.now() + 30 * 86400000).length > 0, 'seeded cards come due later');
});

test('scheduler: lesson first, reviews mixed in, mastery check at 50 XP', () => {
  const ix = indexPack(load('es')); const p = newProgress('es', 'en'); const o = { base: 'en' as const, speech: false, typing: true };
  const pl = plan(ix, p, o);
  assert.equal(pl.kind, 'lesson'); assert.equal(pl.exercises.length, 10);
  for (let k = 0; k < 4; k++) for (const e of plan(ix, p, o).exercises) applyAnswer(ix, p, e, true, 1);
  assert.ok(p.xp > 0);
  assert.ok(Object.keys(p.cards).length > 0, 'practiced items get review cards');
  p.xpSinceCheck = 0;
  const later = Date.now() + 40 * 86400000;
  const pl2 = plan(ix, p, o, later);
  assert.ok(pl2.exercises.some(e => e.mode === 'review') || pl2.kind === 'check');
  p.xpSinceCheck = CHECK_EVERY;
  const c = ix.pack.concepts[0]; for (let i = 0; i < 12; i++) recordAttempt(p, c, true, 1);
  assert.equal(plan(ix, p, o).kind, 'check');
});

test('typed answers accept missing accents as almost right', () => {
  const r = check({ type: 'typed', conceptId: 'x', prompt: '', answer: 'está' }, 'esta');
  assert.deepEqual(r, { correct: false, almost: true });
  assert.equal(check({ type: 'typed', conceptId: 'x', prompt: '', answer: 'está' }, ' Está ').correct, true);
});
