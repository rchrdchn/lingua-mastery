// Site-wide enhancements: listen buttons, the home demo and the example carousel. Small on purpose.
import { RM, tick, burst, shake, floatText } from './fx';
import { play, load } from '../engine/audio';

document.addEventListener('click', e => {
  const b = (e.target as Element).closest?.('[data-say]') as HTMLElement | null;
  if (b) { e.preventDefault(); play(b.dataset.say!, b.dataset.lang || 'en', b.dataset.a || null, b); }
});

// ---- Home demo: a 3-question micro-lesson with instant feedback ----
interface DQ { w: string; r: string; a: string; choices: string[] }
interface DL { id: string; name: string; speech: string; start: string; hub: string; audio: string; qs: DQ[] }
const demo = document.getElementById('demo');
const data = document.getElementById('demo-data');
if (demo && data) {
  const langs: DL[] = JSON.parse(data.textContent || '[]');
  const card = demo.querySelector('.dcard')!, bar = demo.querySelector('.bar i') as HTMLElement, xpEl = demo.querySelector('.xp .n')!, xpBox = demo.querySelector('.xp')!;
  const sayIcon = demo.querySelector('.say')?.innerHTML ?? '';
  let L = langs[0], qi = 0, xp = 0, right = 0;
  const el = (tag: string, cls = '', text = '') => { const x = document.createElement(tag); if (cls) x.className = cls; if (text) x.textContent = text; return x; };
  const show = () => {
    const q = L.qs[qi];
    const dq = el('div', 'dq'); dq.append(el('div', 'i', 'Tap the meaning'));
    const w = el('div', 'w'); w.lang = L.id; w.append(q.w);
    const sb = el('button', 'say') as HTMLButtonElement; sb.type = 'button'; sb.setAttribute('aria-label', 'Listen'); sb.dataset.say = q.w; sb.dataset.lang = L.speech; sb.dataset.a = L.audio; sb.innerHTML = sayIcon;
    w.append(sb); dq.append(w, el('div', 'r', q.r));
    const ch = el('div', 'dch');
    for (const c of q.choices) {
      const b = el('button', 'choice', c) as HTMLButtonElement; b.type = 'button';
      b.onclick = () => pick(b, c === q.a, q, ch); ch.append(b);
    }
    const wrap = el('div', 'ex'); wrap.append(dq, ch);
    card.replaceChildren(wrap);
  };
  const pick = (b: HTMLButtonElement, ok: boolean, q: DQ, ch: Element) => {
    ch.querySelectorAll('button').forEach(x => { (x as HTMLButtonElement).disabled = true; if (x.textContent === q.a) x.classList.add('right'); });
    if (ok) { right++; const was = xp; xp += 10; tick(xpEl, was, xp, 500); xpBox.classList.remove('bump'); void (xpBox as HTMLElement).offsetWidth; xpBox.classList.add('bump'); floatText(xpBox, '+10'); play(q.w, L.speech, L.audio); }
    else { b.classList.add('wrongpick'); shake(card); }
    qi++; bar.style.width = `${(qi / L.qs.length) * 100}%`;
    setTimeout(() => (qi < L.qs.length ? show() : finish()), ok ? 850 : 1300);
  };
  const finish = () => {
    const f = el('div', 'dfin ex');
    const perfect = right === L.qs.length;
    f.append(el('h3', '', perfect ? 'Mastered! 3/3' : `${right}/3. Nice start!`), el('p', '', perfect ? 'That is how every lesson works: nail it, unlock the next.' : 'Miss one and it comes back until you nail it.'));
    const u = el('div', 'unlock'); u.innerHTML = '<svg class="lock open" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="3" fill="currentColor"/><path class="sh" d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    u.append(`Next lesson unlocked`); f.append(u);
    const go = el('a', 'btn primary wide', `Keep going in ${L.name}`) as HTMLAnchorElement; go.href = L.start;
    const again = el('button', 'btn wide', 'Try another language') as HTMLButtonElement; again.type = 'button'; again.style.marginTop = '8px';
    again.onclick = () => { const i = (langs.indexOf(L) + 1) % langs.length; setLang(langs[i]); };
    f.append(go, again); (card as HTMLElement).style.minHeight = `${(card as HTMLElement).offsetHeight}px`; card.replaceChildren(f);
    if (perfect) burst(u);
  };
  const setLang = (l: DL) => {
    L = l; qi = 0; right = 0; bar.style.width = '0%'; (card as HTMLElement).style.minHeight = '';
    demo.querySelectorAll<HTMLButtonElement>('.dlangs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === l.id)));
    show();
  };
  demo.querySelectorAll<HTMLButtonElement>('.dlangs button').forEach(b => b.onclick = () => setLang(langs.find(x => x.id === b.dataset.l)!));
  // Wire the server-rendered first question.
  const ch0 = card.querySelector('.dch'); ch0?.querySelectorAll<HTMLButtonElement>('button.choice').forEach(b => b.onclick = () => pick(b, b.textContent === L.qs[0].a, L.qs[0], ch0));
}

// ---- Example carousel: auto-advance, pause on touch/hover, dots ----
const car = document.getElementById('cards');
const dots = document.getElementById('dots');
if (car && dots) {
  const items = [...car.children] as HTMLElement[];
  const N = Math.min(items.length, 12);
  for (let i = 0; i < N; i++) dots.append(document.createElement('i'));
  let cur = 0, paused = false;
  const mark = () => { const w = items[0].offsetWidth + 12; cur = Math.round(car.scrollLeft / w); [...dots.children].forEach((d, i) => d.classList.toggle('on', i === cur % N)); };
  car.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true }); mark();
  ['pointerdown', 'mouseenter', 'focusin'].forEach(ev => car.addEventListener(ev, () => { paused = true; }));
  car.addEventListener('mouseleave', () => { paused = false; });
  if (!RM) setInterval(() => {
    if (paused || document.hidden) return;
    const r = car.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const next = cur + 1 >= items.length ? 0 : cur + 1;
    car.scrollTo({ left: items[next].offsetLeft - items[0].offsetLeft, behavior: 'smooth' });
  }, 3200);
}

// Warm audio bundles for listen buttons as they come into view (small files, cached).
const seen = new Set<string>();
const warm = (b: Element) => { const a = (b as HTMLElement).dataset.a; if (a && !seen.has(a)) { seen.add(a); load(a); } };
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { warm(e.target); io.unobserve(e.target); } }), { rootMargin: '200px' });
  const scan = () => document.querySelectorAll('[data-a]').forEach(b => { if (!seen.has((b as HTMLElement).dataset.a!)) io.observe(b); });
  scan(); new MutationObserver(scan).observe(document.getElementById('demo') ?? document.body, { childList: true, subtree: true });
} else document.querySelectorAll('[data-a]').forEach(warm);

// ---- FAQ accordion: native <details>, with a smooth height animation (skipped for reduced motion) ----
if (!RM) document.querySelectorAll<HTMLDetailsElement>('details.qa').forEach(d => {
  const sum = d.querySelector('summary'), ans = d.querySelector<HTMLElement>('.ans');
  if (!sum || !ans || !ans.animate) return;
  let anim: Animation | null = null, closing = false;
  sum.addEventListener('click', e => {
    e.preventDefault();
    anim?.cancel();
    const opening = !d.open || closing;
    closing = !opening;
    if (opening) d.open = true;
    const h = ans.scrollHeight;
    anim = ans.animate(opening ? [{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }] : [{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: opening ? 280 : 200, easing: 'cubic-bezier(.2,.8,.3,1)' });
    anim.onfinish = () => { anim = null; if (!opening) { d.open = false; closing = false; } };
  });
});
