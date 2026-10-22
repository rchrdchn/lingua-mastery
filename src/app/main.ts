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
import { RM, tick, burst, shake, floatText, toast } from './fx';

const PACKS: { id: string; name: string }[] = [
  { id: 'zh', name: 'Mandarin Chinese' }, { id: 'es', name: 'Spanish' }, { id: 'en', name: 'English (ESL)' },
  { id: 'fr', name: 'French' }, { id: 'it', name: 'Italian' }, { id: 'pt', name: 'Portuguese' }, { id: 'de', name: 'German' },
];

const root = document.getElementById('app')!;
let ix: PackIndex, pack: Pack, p: Progress, base: Base, settings: Settings, speechOK = false;
const T = (k: Key) => tt(base ?? 'en', k);
const SAMPLE: Record<string, string> = { zh: '你好', es: 'hola', en: 'hello', fr: 'bonjour', it: 'ciao', pt: 'olá', de: 'Hallo' };
let justUnlocked = new Set<string>();

// Inline icons (no icon font, no requests).
const I = {
  say: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6"/><path class="w" d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#ffb703" stroke="#c98a00" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="#ff7a1a"/><path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5.8-2.5 1.6-3 .1 1 .6 1.5 1.1 1.5 0-1.6-.3-2.6.3-4z" fill="#ffcf3f"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="3" fill="currentColor"/><path class="sh" d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const KIND_ICON: Record<string, string> = { vocab: '📚', grammar: '🧩', tone: '🎵', write: '✍️' };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c != null && c !== false) el.append(c as any);
  return el;
}
const mount = (...kids: Node[]) => { root.replaceChildren(...kids); window.scrollTo(0, 0); };
const opts = (): ExOpts => ({ base, speech: speechOK && settings.audio, typing: pack.target !== 'zh' });
const title = (c: Concept) => c.title[base] ?? c.title.en ?? c.id;
const save = () => saveProgress(p);
const mapUrl = () => `/learn/?pack=${pack.id}&base=${base}`;
const backLink = (cls = 'btn', label = T('back')) => h('a', { class: cls, href: mapUrl(), 'aria-label': label === '×' ? T('back') : null, onclick: (e: Event) => { e.preventDefault(); document.onkeydown = null; dashboard(); } }, label);
function speaker(text?: string) {
  if (!text || !speechOK || !settings.audio) return null;
  return h('button', { class: 'speak say', type: 'button', 'aria-label': T('listen'), html: I.say, onclick: (e: Event) => { const b = e.currentTarget as HTMLElement; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 1200); speak(text, pack.speech); } });
}
function ring(pct: number, cls = '') {
  const w = h('span', { class: 'ringwrap', html: `<svg class="ring ${cls}" viewBox="0 0 36 36" aria-hidden="true"><circle class="t" cx="18" cy="18" r="15.9"/><circle class="v" cx="18" cy="18" r="15.9" pathLength="100"/></svg>` });
  const v = w.querySelector('.v') as SVGCircleElement;
  const set = () => { v.style.strokeDashoffset = String(100 - Math.max(0, Math.min(100, pct))); };
  if (RM) set(); else requestAnimationFrame(() => requestAnimationFrame(set));
  return w;
}
const unlockedSet = () => new Set(pack.concepts.filter(c => isUnlocked(ix, p, c) || isDone(p, c.id)).map(c => c.id));

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
  mount(h('section', {}, h('h1', {}, T('pickCourse')),
    h('div', { class: 'grid' }, ...PACKS.map((x, i) => h('a', { class: 'tile', href: `/learn/?pack=${x.id}`, 'data-pack': x.id, style: `--i:${i}` }, h('span', { class: 'big', lang: x.id }, SAMPLE[x.id]), x.name)))));
}

function pickBase() {
  mount(h('section', {}, h('h1', {}, `${pack.name}`), h('p', { class: 'lead' }, 'I speak / Hablo / Eu falo / 我说'),
    h('div', { class: 'grid' }, ...pack.bases.map((b, i) => h('a', { class: 'tile', href: `/learn/?pack=${pack.id}&base=${b}`, 'data-base': b, style: `--i:${i}` }, BASE_NAMES[b])))));
}

function statusLabel(c: Concept): string {
  const s = statusOf(p, c.id);
  if (s === 'unseen' && !isUnlocked(ix, p, c)) return T('locked');
  return T(s as Key);
}

const ZIG = [0, 46, 70, 46, 0, -46, -70, -46];
function dashboard(notice?: string) {
  document.onkeydown = null;
  const s = summary(ix, p); const streak = streakDays(p); const mastered = s.mastered + s.decaying;
  const stat = (b: Node, label: string) => h('div', { class: 'stat' }, b, h('span', {}, label));
  const cur = pack.concepts.find(c => isUnlocked(ix, p, c) && !isDone(p, c.id));
  const xpN = h('span', {}, String(s.xp));
  const levelBlocks = pack.levels.map(lv => {
    const cs = pack.concepts.filter(c => c.level === lv.id);
    if (!cs.length) return null;
    const done = cs.filter(c => isDone(p, c.id)).length;
    const open = (cur && cur.level === lv.id) || (!cur && lv === pack.levels[0]);
    return h('details', { class: 'level', open: open ? '' : null },
      h('summary', {}, ring((done / cs.length) * 100), lv.name, h('small', {}, `${done}/${cs.length}`)),
      h('ol', { class: 'tree concepts' }, ...cs.map((c, i) => {
        const st = statusOf(p, c.id); const unlocked = isUnlocked(ix, p, c) || isDone(p, c.id);
        const cls = unlocked ? st : 'locked';
        const icon = !unlocked ? I.lock : isDone(p, c.id) ? I.check : `<span aria-hidden="true">${KIND_ICON[c.kind] ?? '•'}</span>`;
        const dot = unlocked ? h('a', { class: 'dot', href: `/learn/?pack=${pack.id}&base=${base}&concept=${encodeURIComponent(c.id)}`, 'aria-label': title(c), html: icon }) : h('span', { class: 'dot', html: icon });
        return h('li', { class: `node concept s-${cls}${c === cur ? ' cur' : ''}${justUnlocked.has(c.id) ? ' fresh' : ''}`, 'data-concept': c.id, style: `--i:${i};--x:${ZIG[i % ZIG.length]}px` },
          dot, h('span', { class: 'lbl ct' }, title(c)), h('span', { class: 'st' }, statusLabel(c)));
      })));
  });
  const baseSel = pack.bases.length > 1 ? h('label', { class: 'basesel' }, h('span', { class: 'sr' }, T('base')),
    h('select', { 'aria-label': T('base'), onchange: (e: Event) => { location.href = `/learn/?pack=${pack.id}&base=${(e.target as HTMLSelectElement).value}`; } },
      ...pack.bases.map(b => h('option', { value: b, selected: b === base ? '' : null }, BASE_NAMES[b])))) : null;
  const fresh = !p.placementDone && Object.keys(p.concepts).length === 0;
  mount(
    h('section', { class: 'card dash' },
      h('div', { class: 'row' }, h('h1', {}, pack.name), baseSel),
      notice ? h('p', { class: 'notice' }, notice) : null,
      h('div', { class: 'stats' },
        stat(h('b', { html: I.bolt }, xpN), T('xp')),
        stat(h('b', { html: I.flame.replace('<svg', `<svg class="flame${streak ? '' : ' off'}"`) }, String(streak)), T('streak')),
        stat(h('b', {}, `${mastered}/${s.total}`), T('mastered')),
        stat(h('b', {}, String(s.due)), T('due'))),
      h('button', { class: 'btn primary big wide', id: 'continue', onclick: () => runPlan(plan(ix, p, opts())) }, T('continue')),
      fresh ? h('button', { class: 'btn wide', id: 'placement', style: 'margin-top:10px', onclick: placement }, T('placement')) : null,
      !speechOK ? h('p', { class: 'muted small center' }, T('noVoice')) : null),
    h('section', { class: 'card' }, h('h2', { class: 'sr' }, T('map')), ...levelBlocks.filter(Boolean) as Node[]),
    settingsBlock());
  tick(xpN, Math.max(0, s.xp - 60), s.xp, 800);
  justUnlocked = new Set();
}

function settingsBlock() {
  return h('details', { class: 'card settings' }, h('summary', {}, T('settings')),
    h('label', {}, h('input', { type: 'checkbox', checked: settings.audio ? '' : null, onchange: (e: Event) => { settings.audio = (e.target as HTMLInputElement).checked; saveSettings(settings); } }), ` ${T('audio')}`),
    h('p', { class: 'muted small' }, T('progressNote')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn small', onclick: () => { const blob = new Blob([exportAll()], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: 'lingua-progress.json' }); a.click(); } }, T('export')),
      h('label', { class: 'btn small' }, T('import'), h('input', { type: 'file', accept: 'application/json', hidden: '', onchange: async (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { importAll(await f.text()); location.reload(); } } })),
      h('button', { class: 'btn small danger', onclick: () => { if (confirm(T('resetConfirm'))) { resetProgress(pack.id, base); location.reload(); } } }, T('reset'))));
}

function lesson(c: Concept, then: () => void) {
  const parts: (Node | null)[] = [h('p', { class: 'eyebrow' }, `${T('lesson')} · ${pack.levels.find(l => l.id === c.level)?.name ?? c.level}`), h('h1', {}, title(c))];
  const sum = c.summary?.[base] ?? c.summary?.en; if (sum) parts.push(h('p', { class: 'lead' }, sum));
  if (c.pattern) parts.push(h('p', { class: 'pattern', lang: pack.target }, c.pattern));
  if (c.examples?.length) parts.push(h('ul', { class: 'exlist' }, ...c.examples.map(e => h('li', { class: 'exc' },
    h('span', { class: 's', lang: pack.target }, e.t), speaker(e.t), e.r ? h('span', { class: 'r' }, e.r) : null, h('span', { class: 'tr' }, e.tr[base] ?? e.tr.en ?? '')))));
  if (c.kind === 'vocab') {
    parts.push(h('div', { class: 'wcards' }, ...ix.itemsOf(c).map((it, i) => {
      const card: HTMLButtonElement = h('button', { class: 'flip', type: 'button', style: `--i:${i}`, 'aria-label': `${it.t}: ${shortGloss(gloss(it, base), 70)}`, onclick: () => { card.classList.toggle('on'); if (card.classList.contains('on') && speechOK && settings.audio) speak(it.t, pack.speech); } },
        h('span', { class: 'in' }, h('span', { class: 'f' }, h('b', { lang: pack.target }, it.t), it.r || it.ipa ? h('small', {}, it.r ?? it.ipa ?? '') : null), h('span', { class: 'b' }, shortGloss(gloss(it, base), 70))));
      return card;
    })), h('p', { class: 'hint' }, T('tapFlip')));
  }
  if (c.kind === 'write' && c.chars) parts.push(h('p', { class: 'tgt big center', lang: 'zh' }, c.chars.join(' ')));
  const body = c.body?.[base] ?? c.body?.en ?? [];
  if (body.length) parts.push(h('details', { class: 'more' }, h('summary', {}, T('more')), ...body.map(para => h('p', {}, para))));
  parts.push(h('div', { class: 'actions' }, h('button', { class: 'btn primary big wide', id: 'start', onclick: then }, T('start')), backLink('btn wide')));
  mount(h('section', { class: 'card lesson', 'data-lesson': c.id }, ...parts as Node[]));
}

function runPlan(pl: Plan) {
  if (pl.kind === 'done' || !pl.exercises.length) return dashboard(T('allDone'));
  const before = unlockedSet();
  const go = () => runExercises(pl.exercises, pl.kind === 'check' ? T('masteryCheck') : pl.concept ? title(pl.concept) : T('due'), (r) => {
    if (pl.kind === 'check') finishCheck(p);
    save();
    const after = unlockedSet(); const fresh = pack.concepts.filter(c => after.has(c.id) && !before.has(c.id));
    justUnlocked = new Set(fresh.map(c => c.id));
    results(r, fresh);
  });
  if (pl.kind === 'lesson' && pl.concept) return lesson(pl.concept, go);
  if (pl.kind === 'check') return mount(h('section', { class: 'card center' }, h('div', { class: 'levelpick', html: '<i style="--i:0">✓</i><i style="--i:1">✓</i><i style="--i:2">?</i>' }), h('h1', {}, T('masteryCheck')), h('p', { class: 'lead' }, T('masteryCheckIntro')), h('button', { class: 'btn primary big wide', id: 'start', onclick: go }, T('start'))));
  go();
}

interface RunResult { xp: number; correct: number; total: number; mastered: string[] }

function runExercises(list: Planned[], heading: string, done: (r: RunResult) => void, onAnswer?: (ex: Planned, ok: boolean, secs: number) => { xp: number; masteredNow: boolean }) {
  const r: RunResult = { xp: 0, correct: 0, total: list.length, mastered: [] };
  let i = 0;
  const barI = h('i', { style: 'width:0%' });
  const xpN = h('span', { class: 'n' }, '0'); const xpBox = h('span', { class: 'xp', html: I.bolt }, xpN);
  const holder = h('div', { class: 'exwrap' });
  const card = h('section', { class: 'card' }, h('div', { class: 'extop' }, backLink('x', '×'), h('div', { class: 'bar' }, barI), onAnswer ? null : xpBox), holder);
  mount(card);
  const step = () => {
    if (i >= list.length) return done(r);
    const ex = list[i];
    (window as any).__lmEx = ex;   // read by scripts/verify.mjs
    barI.style.width = `${(i / list.length) * 100}%`;
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
      const was = r.xp; r.xp += out.xp;
      barI.style.width = `${((i + 1) / list.length) * 100}%`;
      if (out.xp > 0) { tick(xpN, was, r.xp, 500); xpBox.classList.remove('bump'); void xpBox.offsetWidth; xpBox.classList.add('bump'); floatText(xpBox, `+${out.xp}`); }
      if (!ok) shake(body);
      if (out.masteredNow) { r.mastered.push(ex.conceptId); const c = ix.concept.get(ex.conceptId); burst(feedback); if (c) toast(`🏆 ${T('mastered')}: ${title(c)}`); }
      feedback.className = `feedback ${ok ? 'ok' : 'bad'}`;
      feedback.replaceChildren(...[h('b', {}, res.almost ? T('almost') : ok ? T('correct') : T('wrong')),
        !ok || res.almost ? h('span', {}, ` · ${T('answerWas')}: `, h('span', { lang: pack.target }, ex.answer)) : null,
        ex.explain ? h('div', { class: 'muted' }, ex.explain) : null,
        ex.credit ? h('div', { class: 'credit' }, ex.credit) : null].filter((x): x is HTMLElement => !!x));
      body.querySelectorAll<HTMLButtonElement>('button.choice').forEach(b => {
        b.disabled = true; if (b.dataset.v === ex.answer) b.classList.add('right'); else if (b.dataset.v === given) b.classList.add('wrongpick');
      });
      if (ex.type === 'cloze' && ex.speak && speechOK && settings.audio) speak(ex.speak, pack.speech);
      nextBtn.hidden = false; nextBtn.focus({ preventScroll: true });
      if (nextBtn.getBoundingClientRect().bottom > innerHeight) nextBtn.scrollIntoView({ block: 'end', behavior: RM ? 'auto' : 'smooth' });
    };
    const instr: Record<string, string> = { recognition: T('meaning'), recall: `${T('which')}…`, typed: T('type'), cloze: T('fill'), listening: T('listen'), tone: T('tone'), write: T('write') };
    const body = h('div', { class: 'ex', 'data-type': ex.type, 'data-mode': ex.mode });
    body.append(h('p', { class: 'eyebrow' }, `${heading} · ${i + 1}/${list.length}`), h('p', { class: 'instr' }, instr[ex.type]));
    const promptLang = ex.type === 'recall' || ex.type === 'typed' ? base : pack.target;
    if (ex.type !== 'listening') body.append(h('div', { class: `prompt ${ex.type === 'cloze' ? 'cl' : ''}`, lang: promptLang }, ex.prompt, ex.type === 'recall' || ex.type === 'typed' ? null : speaker(ex.speak)));
    else { body.append(h('button', { class: 'btn big', onclick: () => speak(ex.speak!, pack.speech), html: I.say + ' ' + T('listen') })); setTimeout(() => speak(ex.speak!, pack.speech), 250); }
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
      const form = h('form', { onsubmit: (e: Event) => { e.preventDefault(); if (!answered) finish(inp.value); else nextBtn.click(); } }, inp, h('button', { class: 'btn primary wide', type: 'submit' }, T('check')));
      body.append(form); setTimeout(() => inp.focus(), 0);
    } else {
      body.append(h('div', { class: 'choices' }, ...(ex.choices ?? []).map((c, k) => h('button', { class: 'choice', 'data-v': c, lang: ex.type === 'recognition' || ex.type === 'listening' ? base : pack.target, onclick: () => finish(c) }, h('kbd', {}, String(k + 1)), ' ', c))));
    }
    body.append(feedback, nextBtn);
    holder.replaceChildren(body);
    if (card.getBoundingClientRect().top < 0) window.scrollTo(0, 0);
    document.onkeydown = (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (!answered && /^[1-9]$/.test(e.key)) { const b = body.querySelectorAll<HTMLButtonElement>('button.choice')[Number(e.key) - 1]; b?.click(); }
      else if (answered && e.key === 'Enter') { e.preventDefault(); nextBtn.click(); }
    };
  };
  step();
}

function results(r: RunResult, unlocked: Concept[] = []) {
  document.onkeydown = null;
  const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
  const pctN = h('b', {}, '0');
  const rw = ring(pct, 'big'); rw.append(pctN);
  const mastered = [...new Set(r.mastered)].map(id => ix.concept.get(id)!).filter(Boolean);
  mount(h('section', { class: 'card results', id: 'results' }, rw, h('h1', {}, T('sessionDone')),
    h('p', { class: 'lead' }, `${T('earned')} ${r.xp} XP · ${r.correct}/${r.total}`),
    mastered.length ? h('div', {}, h('p', { class: 'eyebrow' }, T('newlyMastered')), h('ul', { class: 'mast' }, ...mastered.map(c => h('li', {}, `🏆 ${title(c)}`)))) : null,
    unlocked.length ? h('div', {}, h('p', { class: 'eyebrow' }, T('unlocked')), h('ul', { class: 'unl', style: 'list-style:none;padding:0' }, ...unlocked.slice(0, 4).map((c, i) => h('li', { style: `--i:${i}`, html: I.lock.replace('class="lock"', `class="lock open" style="animation-delay:${0.9 + i * 0.15}s"`) }, title(c))))) : null,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary big wide', id: 'continue', onclick: () => runPlan(plan(ix, p, opts())) }, T('continue')), backLink('btn wide'))));
  tick(pctN, 0, pct, 900); setTimeout(() => { pctN.textContent = `${pct}%`; }, RM ? 0 : 950);
  if (mastered.length || pct === 100) setTimeout(() => burst(rw, 48), RM ? 0 : 500);
}

function placement() {
  const bs = bands(ix);
  let k = 0; let placedAt = bs[0]?.label ?? '';
  const intro = () => mount(h('section', { class: 'card center', id: 'placement-intro' },
    h('div', { class: 'levelpick' }, ...bs.slice(0, 6).map((b, i) => h('i', { style: `--i:${i}`, title: b.label }, String(i + 1)))),
    h('h1', {}, T('findLevel')), h('p', { class: 'lead' }, T('placementIntro')),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary big wide', id: 'start', onclick: nextBand }, T('start')),
      h('button', { class: 'btn wide', id: 'beginner', onclick: () => { finishPlacement(p); save(); runPlan(plan(ix, p, opts())); } }, T('beginner')))));
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
    const sec = h('section', { class: 'card center', id: 'placement-done' }, h('div', { class: 'levelpick', html: '<i style="--i:0">🎯</i>' }), h('h1', {}, T('placed')), h('p', { class: 'lead' }, `${T('placedAt')}: ${placedAt}`),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary big wide', id: 'continue', onclick: () => runPlan(plan(ix, p, opts())) }, T('continue')), backLink('btn wide')));
    mount(sec); setTimeout(() => burst(sec.querySelector('.levelpick'), 40), RM ? 0 : 300);
  };
  void PER_BAND;
  intro();
}

boot().catch(err => { console.error(err); root.textContent = 'Something went wrong loading this course. Please reload.'; });
