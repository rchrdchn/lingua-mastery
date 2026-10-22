export const DAY = 86400000;

/** Deterministic-friendly random helpers. Tests can swap in a seeded rng. */
export let rng: () => number = Math.random;
export function setRng(f: () => number) { rng = f; }

export function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export function pick<T>(a: T[]): T { return a[Math.floor(rng() * a.length)]; }
export function sample<T>(a: T[], n: number): T[] { return shuffle(a).slice(0, n); }
export function uniq<T>(a: T[]): T[] { return [...new Set(a)]; }

export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lowercase, trim, collapse spaces, strip end punctuation. */
export function norm(s: string): string {
  return s.toLowerCase().normalize('NFC').replace(/[.!?¡¿,;:"“”«»]/g, '').replace(/\s+/g, ' ').trim();
}
/** Same as norm but also strips accents, for "almost right" feedback. */
export function fold(s: string): string {
  return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
}

/** First short gloss: "to be; to exist" -> "to be". Keeps it readable on buttons. */
export function shortGloss(g: string | undefined, max = 48): string {
  if (!g) return '';
  let s = g.split(';')[0].trim();
  if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}
