// Audio playback: pre-generated MP3 clips (Lingua Libre recordings or Piper TTS) packed into
// small per-owner bundles (see scripts/audio/). iOS rules followed here:
//  - play() is called synchronously inside the tap handler on one shared <audio> element;
//  - if a bundle is still loading, the element is unlocked with a silent clip in the gesture
//    and the real clip plays as soon as the bundle arrives;
//  - speechSynthesis is only a fallback when no clip exists.
// Keep AUDIO_V and cyrb53 in sync with lib/audiokey.js.
export const AUDIO_V = 1;
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export const bundlePath = (pack: string, owner: string) => `/a/${pack}/${cyrb53(`${owner}|${AUDIO_V}`).toString(36)}.bin`;

const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/83DAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAACWAB6enp6enp6enp6enp6enp6enp6enp6enqmpqampqampqampqampqampqampqampqam09PT09PT09PT09PT09PT09PT09PT09PT0/////////////////////////////////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAJxAAAAAAAAAlj7+meXAAAAAAAAAAAAAAAAAP/zQMQAAAADSAAAAABMQU1FMy4xMDBVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxFsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NAxKQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEowAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
type Clips = Map<string, string>;
const loading = new Map<string, Promise<Clips | null>>();
const ready = new Map<string, Clips | null>();

function parse(buf: ArrayBuffer): Clips | null {
  const u8 = new Uint8Array(buf);
  if (u8.length < 8 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'LMA1') return null;
  const n = new DataView(buf).getUint32(4, true);
  const idx = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + n))) as Record<string, [number, number]>;
  const m: Clips = new Map(); const base = 8 + n;
  for (const [t, [o, l]] of Object.entries(idx)) m.set(t, URL.createObjectURL(new Blob([u8.subarray(base + o, base + o + l)], { type: 'audio/mpeg' })));
  return m;
}
/** Fetch a bundle (once). Safe to call early to warm the cache. */
export function load(path: string): Promise<Clips | null> {
  let p = loading.get(path);
  if (!p) {
    p = fetch(path).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => (b ? parse(b) : null)).catch(() => null);
    p.then(m => ready.set(path, m));
    loading.set(path, p);
  }
  return p;
}
export function prefetch(paths: Iterable<string>) {
  const run = () => { for (const p of paths) load(p); };
  const ric = (window as any).requestIdleCallback as ((f: () => void, o?: object) => void) | undefined;
  if (ric) ric(run, { timeout: 2000 }); else setTimeout(run, 600);
}

let el: HTMLAudioElement | null = null;
let curBtn: Element | null = null;
function player(): HTMLAudioElement {
  if (el) return el;
  // iOS 17+: treat this as media playback.
  try { const s = (navigator as any).audioSession; if (s) s.type = 'playback'; } catch { /* older browsers */ }
  el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', '');
  const off = () => { curBtn?.classList.remove('on'); curBtn = null; };
  el.addEventListener('playing', () => { if (el && el.src !== SILENT) { audioStat.playing++; audioStat.src = el.src.slice(0, 5); } });
  el.addEventListener('ended', off); el.addEventListener('error', off); el.addEventListener('pause', () => { if (el && el.src !== SILENT) off(); });
  return el;
}
function mark(btn?: Element | null) { curBtn?.classList.remove('on'); curBtn = btn ?? null; curBtn?.classList.add('on'); }
function start(a: HTMLAudioElement, url: string, text: string, lang: string, btn?: Element | null) {
  a.src = url; mark(btn);
  const p = a.play();
  p?.then(() => { audioStat.resolved++; }, () => { audioStat.failed++; mark(null); tts(text, lang, btn); });
}
/** Last stat, for tests: 'file' | 'tts' | 'none'. */
export const audioStat = { last: '' as string, files: 0, tts: 0, playing: 0, resolved: 0, failed: 0, src: '' as string };
if (typeof window !== 'undefined') (window as any).__lmAudio = audioStat;

/** Play text. Call directly from a click/tap handler. */
export function play(text: string, lang: string, path?: string | null, btn?: Element | null): void {
  const a = player();
  synth()?.cancel();
  if (path) {
    const m = ready.get(path);
    const url = m?.get(text);
    if (url) { audioStat.last = 'file'; audioStat.files++; start(a, url, text, lang, btn); return; }
    if (m === undefined) {
      // Bundle not here yet: unlock the element now (inside the gesture), play when it lands.
      a.src = SILENT; a.play()?.catch(() => {});
      mark(btn);
      load(path).then(mm => {
        const u = mm?.get(text);
        if (u) { audioStat.last = 'file'; audioStat.files++; start(a, u, text, lang, btn); } else { mark(null); tts(text, lang, btn); }
      });
      return;
    }
  }
  tts(text, lang, btn);
}

// ---- speechSynthesis fallback ----
let voices: SpeechSynthesisVoice[] = [];
const synth = (): SpeechSynthesis | null => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
function loadVoices() { const s = synth(); if (s) voices = s.getVoices(); }
if (typeof window !== 'undefined') { loadVoices(); synth()?.addEventListener?.('voiceschanged', loadVoices); }
export function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  if (!voices.length) loadVoices();
  const l = lang.toLowerCase().replace('_', '-'), short = l.split('-')[0];
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  return voices.find(v => norm(v) === l && v.localService) ?? voices.find(v => norm(v) === l) ?? voices.find(v => norm(v).startsWith(short));
}
function tts(text: string, lang: string, btn?: Element | null) {
  const s = synth(); if (!s) { audioStat.last = 'none'; return; }
  const v = voiceFor(lang);
  s.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = v?.lang ?? lang; if (v) u.voice = v; u.rate = 0.85;
  mark(btn); u.onend = u.onerror = () => mark(null); setTimeout(() => { if (curBtn === btn) mark(null); }, 5000);
  s.speak(u); if (s.paused) s.resume();
  audioStat.last = 'tts'; audioStat.tts++;
}
