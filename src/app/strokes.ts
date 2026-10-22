// Stroke order animation + writing quiz on /mandarin/characters/<c>/ pages.
import HanziWriter from 'hanzi-writer';

const el = document.getElementById('stroke');
if (el) {
  const ch = el.dataset.char!;
  const loader = (c: string, onLoad: (d: any) => void, onErr: (e?: any) => void) => { fetch(`/assets/strokes/${c}.json`).then(r => r.json()).then(onLoad).catch(onErr); };
  const w = HanziWriter.create(el, ch, { width: 200, height: 200, padding: 8, strokeAnimationSpeed: 1, delayBetweenStrokes: 250, charDataLoader: loader });
  w.animateCharacter();
  document.getElementById('replay')?.addEventListener('click', () => { w.showCharacter(); w.animateCharacter(); });
  document.getElementById('quiz')?.addEventListener('click', () => { w.hideCharacter(); w.quiz(); });
}
