// Browser speech synthesis. Listening drills are only offered when a voice
// for the pack's language exists, so headless or voiceless browsers still work.
let voices: SpeechSynthesisVoice[] = [];
const synth = (): SpeechSynthesis | null => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);

export function initVoices(): Promise<void> {
  const s = synth(); if (!s) return Promise.resolve();
  voices = s.getVoices();
  if (voices.length) return Promise.resolve();
  return new Promise(res => {
    const done = () => { voices = s.getVoices(); res(); };
    s.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 800);
  });
}

export function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const l = lang.toLowerCase(); const short = l.split('-')[0];
  return voices.find(v => v.lang.toLowerCase() === l) ?? voices.find(v => v.lang.toLowerCase().startsWith(short));
}

export function canSpeak(lang: string): boolean { return !!synth() && !!voiceFor(lang); }

export function speak(text: string, lang: string, rate = 0.85) {
  const s = synth(); const v = voiceFor(lang); if (!s || !v) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = rate;
  s.speak(u);
}
