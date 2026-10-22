// Numbered pinyin -> tone marks, and tone variants for tone drills.
const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'], e: ['ē', 'é', 'ě', 'è'], i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'], u: ['ū', 'ú', 'ǔ', 'ù'], ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/** "hao3" -> "hǎo", "lv4" / "lu:4" -> "lǜ", "ma5" -> "ma". */
export function markSyl(num: string): string {
  const m = /^([a-zü:]+?)([1-5])?$/i.exec(num.trim());
  if (!m) return num;
  let s = m[1].toLowerCase().replace(/u:|v/g, 'ü');
  const tone = Number(m[2] || 5);
  if (tone === 5) return s;
  let idx = -1;
  if (s.includes('a')) idx = s.indexOf('a');
  else if (s.includes('e')) idx = s.indexOf('e');
  else if (s.includes('ou')) idx = s.indexOf('o');
  else {
    for (let i = s.length - 1; i >= 0; i--) if ('iouü'.includes(s[i])) { idx = i; break; }
  }
  if (idx < 0) return s;
  return s.slice(0, idx) + MARKS[s[idx]][tone - 1] + s.slice(idx + 1);
}

export function toneOf(num: string): number { const m = /([1-5])$/.exec(num); return m ? Number(m[1]) : 5; }
export function baseSyl(num: string): string { return num.replace(/[1-5]$/, ''); }

/** All four tone spellings (plus neutral when asked) for a syllable. */
export function toneVariants(num: string, withNeutral = false): string[] {
  const b = baseSyl(num);
  const tones = withNeutral ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
  return tones.map(t => markSyl(b + t));
}

export function joinSyl(syl: string[]): string { return syl.map(markSyl).join(''); }
