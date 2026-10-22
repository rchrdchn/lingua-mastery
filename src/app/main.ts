// The /learn/ app: dashboard, lessons, practice, placement. Plain DOM, no framework.
import HanziWriter from 'hanzi-writer';
import type { Base, Concept, Pack, Progress } from '../engine/types';
import { indexPack, isDone, isUnlocked, statusOf, type PackIndex } from '../engine/graph';
import { plan, planConcept, summary, type Plan, type Planned } from '../engine/scheduler';
import { applyAnswer, finishCheck, streakDays } from '../engine/session';
import { bands, bandQuestions, passBand, finishPlacement, PASS_AT, PER_BAND } from '../engine/placement';
import { check, gloss, type ExOpts } from '../engine/exercises';
import { loadProgress, saveProgress, resetProgress, loadSettings, saveSettings, exportAll, importAll, type Settings } from '../engine/store';
import { initVoices, canSpeak, speak } from '../engine/speech';
import { t as tt, BASE_NAMES, type Key } from '../engine/i18n';
import { shortGloss } from '../engine/util';

const PACKS: { id: string; name: string }[] = [
  { id: 'zh', name: 'Mandarin Chinese' }, { id: 'es', name: 'Spanish' }, { id: 'en', name: 'English (ESL)' },
  { id: 'fr', name: 'French' }, { id: 'it', name: 'Italian' }, { id: 'pt', name: 'Portuguese' }, { id: 'de', name: 'German' },
];

const root = document.getElementById('app')!;
let ix: PackIndex, pack: Pack, p: Progress, base: Base, settings: Settings, speechOK = false;
const T = (k: Key) => tt(base ?? 'en', k);

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'class') el.className = v; else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c != null && c !== false) el.append(c as any);
  return el;
}
const mount = (...kids: Node[]) => { root.replaceChildren(...kids); window.scrollTo(0, 0); };
const opts = (): ExOpts => ({ base, speech: speechOK && settings.audio, typing: pack.target !== 'zh' });
const title = (c: Concept) => c.title[base] ?? c.title.en ?? c.id;
const save = () => saveProgress(p);
function speaker(text?: string) {
  if (!text || !speechOK || !settings.audio) return null;
  return h('button', { class: 'speak', type: 'button', 'aria-label': T('listen'), onclick: () => speak(text, pack.speech) }, '🔊');
}

async function boot() {
  const q = new URLSearchParams(location.search);
  settings = loadSettings();
  const packId = q.get('pack');
  if (!packId || !PACKS.some(x => x.id === packId)) return pickCourse();
  root.textContent = 'Loading…';
  const res = await fetch(`/packs/${packId}.json`);
  pack = await res.json();
  ix = indexPack(pack);
  const qb = q.get('base') as Base | null;
  base = (qb && pack.bases.includes(qb) ? qb : settings.base[pack.id]) ?? pack.bases[0];
  if (!pack.bases.includes(base)) base = pack.bases[0];
  if (pack.bases.length > 1 && !qb && !settings.base[pack.id]) return pickBase();
  settings.base[pack.id] = base; saveSettings(settings);
  document.documentElement.lang = base;
  p = loadProgress(pack.id, base);
  await initVoices(); speechOK = canSpeak(pack.speech);
  const cid = q.get('concept');
  const c = cid ? ix.concept.get(cid) : undefined;
  if (c) {
    if (isUnlocked(ix, p, c) || isDone(p, c.id)) return runPlan(planConcept(ix, p, c, opts()));
    return dashboard(`${title(c)}: ${T('locked')}. ${T('unlocks')} ${c.prereqs.filter(x => !isDone(p, x)).map(x => title(ix.concept.get(x)!)).join(', ')}`);
  }
  if (q.get('placement') === '1' && !p.placementDone) return placement();
  dashboard();
}

function pickCourse() {
  base = 'en';
  mount(h('section', { class: 'card' }, h('h1', {}, T('pickCourse')),
    h('div', { class: 'grid' }, ...PACKS.map(x => h('a', { class: 'btn big', href: `/learn/?pack=${x.id}`, 'data-pack': x.id }, x.name)))));
}

function pickBase() {
  mount(h('section', { class: 'card' }, h('h1', {}, `${pack.name}`), h('p', {}, 'I speak / Hablo / Eu falo / 我说'),
    h('div', { class: 'grid' }, ...pack.bases.map(b => h('a', { class: 'btn big', href: `/learn/?pack=${pack.id}&base=${b}`, 'data-base': b }, BASE_NAMES[b])))));
}

function statusLabel(c: Concept): string {
  const s = statusOf(p, c.id);
  if (s === 'unseen' && !isUnlocked(ix, p, c)) return T('locked');
  return T(s as Key);
}

function dashboard(notice?: string) {
  const s = summary(ix, p);
  const statBox = (n: string | number, label: string) => h('div', { class: 'stat' }, h('b', {}, String(n)), h('span', {}, label));
  const levelBlocks = pack.levels.map(lv => {
    const cs = pack.concepts.filter(c => c.level === lv.id);
    if (!cs.length) return null;
    const done = cs.filter(c => isDone(p, c.id)).length;
    return h('details', { class: 'level', open: cs.some(c => isUnlocked(ix, p, c) && !isDone(p, c.id)) ? '' : null },
      h('summary', {}, `${lv.name} · ${done}/${cs.length}`),
      h('ul', { class: 'concepts' }, ...cs.map(c => {
        const st = statusOf(p, c.id); const unlocked = isUnlocked(ix, p, c) || isDone(p, c.id);
        const label = h('span', { class: 'ct' }, title(c));
        const kind = h('span', { class: `kind k-${c.kind}` }, c.kind === 'vocab' ? T('words') : c.kind === 'grammar' ? T('grammar') : c.kind === 'tone' ? T('tone') : T('write'));
        return h('li', { class: `concept s-${unlocked ? st : 'locked'}`, 'data-concept': c.id },
          unlocked ? h('a', { href: `/learn/?pack=${pack.id}&base=${base}&concept=${encodeURIComponent(c.id)}` }, label) : label,
          kind, h('span', { class: 'st' }, statusLabel(c)));
      })));
  });
  const baseSel = pack.bases.length > 1 ? h('label', { class: 'basesel' }, `${T('base')}: `,
    h('select', { onchange: (e: Event) => { location.href = `/learn/?pack=${pack.id}&base=${(e.target as HTMLSelectElement).value}`; } },
      ...pack.bases.map(b => h('option', { value: b, selected: b === base ? '' : null }, BASE_NAMES[b])))) : null;
  const fresh = !p.placementDone && Object.keys(p.concepts).length === 0;
  mount(
    h('section', { class: 'card dash' },
      h('div', { class: 'row' }, h('h1', {}, pack.name), baseSel),
      notice ? h('p', { class: 'notice' }, notice) : null,
      h('div', { class: 'stats' }, statBox(s.xp, T('xp')), statBox(`${s.mastered + s.decaying}/${s.total}`, T('mastered')), statBox(s.due, T('due')), statBox(streakDays(p), T('streak')), statBox(`${s.toCheck} XP`, T('checkIn'))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', id: 'continue', onclick: () => runPlan(plan(ix, p, opts())) }, T('continue')),
        fresh ? h('button', { class: 'btn', id: 'placement', onclick: placement }, T('placement')) : null),
      !speechOK ? h('p', { class: 'muted small' }, T('noVoice')) : null,
      h('p', { class: 'muted small' }, T('progressNote'))),
    h('section', { class: 'card' }, h('h2', {}, T('map')), ...levelBlocks.filter(Boolean) as Node[]),
    settingsBlock());
}

function settingsBlock() {
  return h('details', { class: 'card settings' }, h('summary', {}, T('settings')),
    h('label', {}, h('input', { type: 'checkbox', checked: settings.audio ? '' : null, onchange: (e: Event) => { settings.audio = (e.target as HTMLInputElement).checked; saveSettings(settings); } }), ` ${T('audio')}`),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: () => { const blob = new Blob([exportAll()], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: 'lingua-progress.json' }); a.click(); } }, T('export')),
      h('label', { class: 'btn' }, T('import'), h('input', { type: 'file', accept: 'application/json', hidden: '', onchange: async (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { importAll(await f.text()); location.reload(); } } })),
      h('button', { class: 'btn danger', onclick: () => { if (confirm(T('resetConfirm'))) { resetProgress(pack.id, base); location.reload(); } } }, T('reset'))));
}

function lesson(c: Concept, then: () => void) {
  const parts: (Node | null)[] = [h('p', { class: 'eyebrow' }, `${T('lesson')} · ${pack.levels.find(l => l.id === c.level)?.name ?? c.level}`), h('h1', {}, title(c))];
  const sum = c.summary?.[base] ?? c.summary?.en; if (sum) parts.push(h('p', { class: 'lead' }, sum));
  for (const para of c.body?.[base] ?? c.body?.en ?? []) parts.push(h('p', {}, para));
  if (c.pattern) parts.push(h('p', { class: 'pattern' }, h('b', {}, `${T('pattern')}: `), c.pattern));
  if (c.examples?.length) parts.push(h('h2', {}, T('example')), h('ul', { class: 'examples' }, ...c.examples.map(e => h('li', {}, h('span', { class: 'tgt', lang: pack.target }, e.t), speaker(e.t), e.r ? h('span', { class: 'muted' }, ` ${e.r}`) : null, h('br'), h('span', { class: 'muted' }, e.tr[base] ?? e.tr.en ?? '')))));
  if (c.kind === 'vocab') {
    parts.push(h('table', { class: 'words' }, ...ix.itemsOf(c).map(it => h('tr', {},
      h('td', { class: 'tgt', lang: pack.target }, it.t, speaker(it.t)), h('td', {}, it.r ?? it.ipa ?? ''), h('td', {}, shortGloss(gloss(it, base), 70))))));
  }
  if (c.kind === 'write' && c.chars) parts.push(h('p', { class: 'tgt big', lang: 'zh' }, c.chars.join(' ')));
  parts.push(h('div', { class: 'actions' }, h('button', { class: 'btn primary', id: 'start', onclick: then }, T('start')), h('a', { class: 'btn', href: `/learn/?pack=${pack.id}&base=${base}` }, T('back'))));
  mount(h('section', { class: 'card lesson', 'data-lesson': c.id }, ...parts as Node[]));
}

function runPlan(pl: Plan) {
  if (pl.kind === 'done' || !pl.exercises.length) return dashboard(T('allDone'));
  const go = () => runExercises(pl.exercises, pl.kind === 'check' ? T('masteryCheck') : pl.concept ? title(pl.concept) : T('due'), (r) => {
    if (pl.kind === 'check') finishCheck(p);
    save(); results(r);
  });
  if (pl.kind === 'lesson' && pl.concept) return lesson(pl.concept, go);
  if (pl.kind === 'check') return mount(h('section', { class: 'card' }, h('h1', {}, T('masteryCheck')), h('p', {}, T('masteryCheckIntro')), h('button', { class: 'btn primary', id: 'start', onclick: go }, T('start'))));
  go();
}

interface RunResult { xp: number; correct: number; total: number; mastered: string[] }

function runExercises(list: Planned[], heading: string, done: (r: RunResult) => void, onAnswer?: (ex: Planned, ok: boolean, secs: number) => { xp: number; masteredNow: boolean }) {
  const r: RunResult = { xp: 0, correct: 0, total: list.length, mastered: [] };
  let i = 0;
  const step = () => {
    if (i >= list.length) return done(r);
    const ex = list[i];
    (window as any).__lmEx = ex;   // read by scripts/verify.mjs
    const started = performance.now();
    let answered = false;
    const feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
    const nextBtn = h('button', { class: 'btn primary', id: 'next', hidden: '', onclick: () => { i++; step(); } }, T('next'));
    const finish = (given: string, forced?: boolean) => {
      if (answered) return; answered = true;
      const secs = (performance.now() - started) / 1000;
      const res = forced != null ? { correct: forced, almost: false } : check(ex, given);
      const ok = res.correct || res.almost;
      const out = onAnswer ? onAnswer(ex, ok, secs) : applyAnswer(ix, p, ex, ok, secs);
      save();
      if (ok) r.correct++;
      r.xp += out.xp;
      if (out.masteredNow) r.mastered.push(ex.conceptId);
      feedback.className = `feedback ${ok ? 'ok' : 'bad'}`;
      feedback.replaceChildren(...[h('b', {}, res.almost ? T('almost') : ok ? T('correct') : T('wrong')),
        !ok || res.almost ? h('span', {}, ` · ${T('answerWas')}: `, h('span', { lang: pack.target }, ex.answer)) : null,
        ex.explain ? h('div', { class: 'muted' }, ex.explain) : null,
        ex.credit ? h('div', { class: 'credit' }, ex.credit) : null].filter((x): x is HTMLElement => !!x));
      body.querySelectorAll<HTMLButtonElement>('button.choice').forEach(b => {
        b.disabled = true; if (b.dataset.v === ex.answer) b.classList.add('right'); else if (b.dataset.v === given) b.classList.add('wrongpick');
      });
      if (ex.type === 'cloze' && ex.speak) speak(ex.speak, pack.speech);
      nextBtn.hidden = false; nextBtn.focus();
    };
    const instr: Record<string, string> = { recognition: T('meaning'), recall: `${T('which')}…`, typed: T('type'), cloze: T('fill'), listening: T('listen'), tone: T('tone'), write: T('write') };
    const body = h('div', { class: 'ex', 'data-type': ex.type, 'data-mode': ex.mode });
    body.append(h('p', { class: 'eyebrow' }, `${heading} · ${i + 1}/${list.length}`), h('div', { class: 'bar' }, h('i', { style: `width:${(i / list.length) * 100}%` })), h('p', { class: 'instr' }, instr[ex.type]));
    const promptLang = ex.type === 'recall' || ex.type === 'typed' ? base : pack.target;
    if (ex.type !== 'listening') body.append(h('div', { class: `prompt ${ex.type === 'cloze' ? 'cl' : ''}`, lang: promptLang }, ex.prompt, ex.type === 'recall' || ex.type === 'typed' ? null : speaker(ex.speak)));
    else { body.append(h('button', { class: 'btn big', onclick: () => speak(ex.speak!, pack.speech) }, '🔊 ' + T('listen'))); setTimeout(() => speak(ex.speak!, pack.speech), 250); }
    if (ex.sub) body.append(h('p', { class: 'sub muted' }, ex.sub));
    if (ex.type === 'write') {
      const box = h('div', { class: 'writer', id: 'writer' });
      body.append(box, h('button', { class: 'btn small', type: 'button', onclick: () => finish('', false) }, T('hint')));
      setTimeout(() => {
        const w = HanziWriter.create(box, ex.char!, { width: 240, height: 240, padding: 10, showOutline: true, showCharacter: false,
          charDataLoader: (ch: string, onLoad: (d: any) => void, onErr: (e?: any) => void) => { fetch(`/assets/strokes/${ch}.json`).then(r => r.json()).then(onLoad).catch(onErr); } });
        w.quiz({ onComplete: (s: { totalMistakes: number }) => finish('', s.totalMistakes <= 3) });
      }, 0);
    } else if (ex.type === 'typed') {
      const inp = h('input', { class: 'typed', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: pack.target, 'aria-label': T('type') }) as HTMLInputElement;
      const form = h('form', { onsubmit: (e: Event) => { e.preventDefault(); if (!answered) finish(inp.value); else nextBtn.click(); } }, inp, h('button', { class: 'btn primary', type: 'submit' }, T('check')));
      body.append(form); setTimeout(() => inp.focus(), 0);
    } else {
      body.append(h('div', { class: 'choices' }, ...(ex.choices ?? []).map((c, k) => h('button', { class: 'choice', 'data-v': c, lang: ex.type === 'recognition' || ex.type === 'listening' ? base : pack.target, onclick: () => finish(c) }, h('kbd', {}, String(k + 1)), ' ', c))));
    }
    body.append(feedback, nextBtn);
    mount(h('section', { class: 'card' }, body));
    document.onkeydown = (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (!answered && /^[1-9]$/.test(e.key)) { const b = body.querySelectorAll<HTMLButtonElement>('button.choice')[Number(e.key) - 1]; b?.click(); }
      else if (answered && e.key === 'Enter') { e.preventDefault(); nextBtn.click(); }
    };
  };
  step();
}

function results(r: RunResult) {
  document.onkeydown = null;
  mount(h('section', { class: 'card', id: 'results' }, h('h1', {}, T('sessionDone')),
    h('p', { class: 'lead' }, `${T('earned')} ${r.xp} XP · ${r.correct}/${r.total}`),
    r.mastered.length ? h('p', {}, h('b', {}, `${T('newlyMastered')}: `), [...new Set(r.mastered)].map(id => title(ix.concept.get(id)!)).join(', ')) : null,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', id: 'continue', onclick: () => runPlan(plan(ix, p, opts())) }, T('continue')),
      h('a', { class: 'btn', href: `/learn/?pack=${pack.id}&base=${base}` }, T('back')))));
}

function placement() {
  const bs = bands(ix);
  let k = 0; let placedAt = bs[0]?.label ?? '';
  const intro = () => mount(h('section', { class: 'card', id: 'placement-intro' }, h('h1', {}, T('placement')), h('p', {}, T('placementIntro')),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', id: 'start', onclick: nextBand }, T('start')),
      h('button', { class: 'btn', id: 'beginner', onclick: () => { finishPlacement(p); save(); runPlan(plan(ix, p, opts())); } }, T('beginner')))));
  const nextBand = () => {
    if (k >= bs.length) return end();
    const b = bs[k];
    const qs = bandQuestions(ix, b, opts()).map(e => ({ ...e, mode: 'check' as const }));
    let right = 0;
    runExercises(qs, `${T('placement')} · ${b.label}`, () => {
      if (right >= Math.min(PASS_AT, qs.length) && qs.length) { passBand(ix, p, b); save(); k++; placedAt = bs[k]?.label ?? b.label; nextBand(); }
      else end();
    }, (_ex, ok) => { if (ok) right++; return { xp: 0, masteredNow: false }; });
  };
  const end = () => {
    finishPlacement(p); save();
    mount(h('section', { class: 'card', id: 'placement-done' }, h('h1', {}, T('placed')), h('p', { class: 'lead' }, `${T('placedAt')}: ${placedAt}`),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', id: 'continue', onclick: () => runPlan(plan(ix, p, opts())) }, T('continue')),
        h('a', { class: 'btn', href: `/learn/?pack=${pack.id}&base=${base}` }, T('back')))));
  };
  void PER_BAND;
  intro();
}

boot().catch(err => { console.error(err); root.textContent = 'Something went wrong loading this course. Please reload.'; });
