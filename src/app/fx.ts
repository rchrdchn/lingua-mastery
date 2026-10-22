// Small animation helpers shared by the site and the practice app. All respect
// prefers-reduced-motion: confetti is skipped and counters jump to their value.
export const RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Count a number up inside el. */
export function tick(el: Element, from: number, to: number, ms = 700) {
  if (RM || from === to) { el.textContent = String(to); return; }
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const COLORS = ['#ff4f64', '#ffb703', '#0f7a5c', '#2fbf8a', '#5b8cff', '#ff8a98'];
/** Confetti burst from an element (or the screen center). DOM + Web Animations, removed after. */
export function burst(from?: Element | null, n = 36) {
  if (RM || typeof document === 'undefined') return;
  const r = from?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 3;
  const box = document.createElement('div'); box.className = 'burst'; box.style.transform = `translate(${x}px,${y}px)`;
  document.body.append(box);
  let left = n;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.style.background = COLORS[i % COLORS.length];
    box.append(p);
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5, d = 70 + Math.random() * 120;
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 60;
    p.animate([{ transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${360 + Math.random() * 360}deg) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx * 1.15}px,${dy + 140}px) rotate(${720}deg) scale(.6)`, opacity: 0 }],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => { if (--left === 0) box.remove(); };
  }
}

/** Shake an element once (re-triggerable). */
export function shake(el: Element) { el.classList.remove('shake'); void (el as HTMLElement).offsetWidth; el.classList.add('shake'); }

/** "+10" floating label inside a positioned parent. */
export function floatText(parent: Element, text: string) {
  if (RM) return; const s = document.createElement('span'); s.className = 'float'; s.textContent = text; parent.append(s); setTimeout(() => s.remove(), 1000);
}

export function toast(text: string) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
  document.body.append(t); setTimeout(() => t.remove(), 2700);
}

// Speech: pick a voice for the language if the browser has one.
let voices: SpeechSynthesisVoice[] = [];
const synth = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
function loadVoices() { const s = synth(); if (s) voices = s.getVoices(); }
loadVoices(); synth()?.addEventListener?.('voiceschanged', loadVoices);
export function say(text: string, lang: string, btn?: Element | null) {
  const s = synth(); if (!s) return false; if (!voices.length) loadVoices();
  const l = lang.toLowerCase(), short = l.split('-')[0];
  const v = voices.find(x => x.lang.toLowerCase().replace('_', '-') === l) ?? voices.find(x => x.lang.toLowerCase().startsWith(short));
  s.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = v?.lang ?? lang; if (v) u.voice = v; u.rate = 0.85;
  if (btn) { btn.classList.add('on'); u.onend = u.onerror = () => btn.classList.remove('on'); setTimeout(() => btn.classList.remove('on'), 4000); }
  s.speak(u); return true;
}
