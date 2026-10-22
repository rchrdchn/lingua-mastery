// Gloss quality rules shared by the pack builder, the tests and `npm run data:lint`.
// A primary gloss is the first sense (text before the first ";"), which is what
// buttons and word lists show. It must read like a translation, not a grammar note.
export const LINT_TOP = 600;          // check the 600 most frequent words of each pack
export const MAX_PRIMARY = 60;

const GRAMMAR_NOTE = new RegExp([
  String.raw`\b(alternative|archaic|obsolete|dated|apocopic|apocopated|elided|contracted|clipped|diminutive|augmentative|abbreviated)\s+(form|spelling)\b`,
  String.raw`\b(form|plural|singular|feminine|masculine|neuter|dative|accusative|genitive|nominative|vocative|oblique|participle|gerund|infinitive|imperative|subjunctive|conjugation|inflection|contraction|abbreviation|misspelling|superlative|comparative|diminutive|compound|ellipsis|clipping|short)\s+(of|for)\b`,
  String.raw`\b(first|second|third)[- ]person\b`,
  String.raw`^a term of address\b`,
  String.raw`^(used|indicates|denotes|expresses|introduces|forms|substitutes|refers|links|followed by|placed|see|with (dative|accusative|genitive))\b`,
  String.raw`\bpronoun\b.*\b(of|for)\b`,
].join('|'), 'i');

export function primary(g) { return String(g || '').split(';')[0].trim(); }

/** Returns a reason string if the gloss is bad, else null. */
export function lintGloss(g) {
  const p = primary(g);
  if (!p) return 'empty';
  if (GRAMMAR_NOTE.test(p)) return 'grammar-note';
  if (p.length > MAX_PRIMARY) return `long(${p.length})`;
  return null;
}

/** Lint the top words of a built pack. Returns [{ word, base, gloss, reason }]. */
export function lintPack(pack, top = LINT_TOP) {
  const out = [];
  const items = pack.items.slice().sort((a, b) => a.rank - b.rank).slice(0, top);
  for (const it of items) for (const b of pack.bases) {
    const r = lintGloss(it.g[b]); if (r) out.push({ word: it.t, base: b, gloss: it.g[b], reason: r });
  }
  return out;
}

/** Sense-level test used while building: senses that are grammar notes rank last. */
export function isNoteSense(g) { return GRAMMAR_NOTE.test(String(g).trim()); }
