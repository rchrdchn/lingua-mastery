// Shared types for language packs and learner state.
// A pack is a JSON file built by scripts/data/build-packs.mjs. Everything a
// learner sees is keyed by "base" language (the language explanations and
// translations are shown in), so the same engine can teach English from
// Spanish or Mandarin from English.

export type Base = 'en' | 'es' | 'pt' | 'zh';
export type Text = Partial<Record<Base, string>>;
export type TextList = Partial<Record<Base, string[]>>;

export type ConceptKind = 'vocab' | 'grammar' | 'tone' | 'write';
export type ToneMode = 'single' | 'neutral' | 'pair' | 'sandhi';

export interface Threshold { streak: number; sec: number }

export interface Concept {
  id: string;
  kind: ConceptKind;
  level: string;
  track?: string;
  slug?: string;
  title: Text;
  summary?: Text;
  body?: TextList;
  pattern?: string;
  examples?: { t: string; r?: string; tr: Text }[];
  items?: string[];
  chars?: string[];
  toneMode?: ToneMode;
  cloze?: { answers: string[]; pool: string[]; sents?: string[] };
  prereqs: string[];
  threshold: Threshold;
}

export interface Item {
  id: string;
  t: string;          // target form
  alt?: string;       // traditional form (zh)
  r?: string;         // pinyin with tone marks (zh)
  syl?: string[];     // numbered pinyin syllables (zh)
  sp?: string;        // pinyin as spoken after tone sandhi (zh)
  ipa?: string;
  pos?: string;
  g: Text;            // gloss by base language
  lvl: string;
  slug: string;
  rank: number;
  ex?: string[];      // sentence ids
  forms?: string[];
  concept: string;
}

export interface CharInfo { c: string; r: string[]; g: Text; words: string[]; lvl: string; strokes?: number }

export interface Sentence { t: string; a: string; tr: Text; ta: Text }

export interface Pack {
  id: string;
  target: string;
  name: string;
  short: string;
  slug: string;
  bases: Base[];
  speech: string;
  version: number;
  levels: { id: string; name: string }[];
  concepts: Concept[];
  items: Item[];
  chars?: CharInfo[];
  sentences: Record<string, Sentence>;
  credits: { name: string; url: string; license: string; licenseUrl: string; note: string }[];
}

// Mastery states ported from Mathua (MIT): unseen -> learning -> practicing ->
// mastered, and mastered concepts decay if not seen for DECAY_DAYS.
export type Status = 'unseen' | 'learning' | 'practicing' | 'mastered' | 'decaying';

export interface ConceptState {
  status: Status;
  streak: number;
  attempts: number;
  correct: number;
  times: number[];     // seconds for recent correct answers
  last: number;        // epoch ms last practiced
  placed?: boolean;    // marked mastered by the placement quiz
}

export interface CardState {
  due: number; stability: number; difficulty: number; elapsed_days: number;
  scheduled_days: number; learning_steps: number; reps: number; lapses: number;
  state: number; last_review?: number;
}

export interface Progress {
  v: 1;
  pack: string;
  base: Base;
  xp: number;
  xpSinceCheck: number;
  placementDone: boolean;
  concepts: Record<string, ConceptState>;
  cards: Record<string, CardState>;   // keyed by item id (or "char:<c>")
  days: Record<string, number>;       // yyyy-mm-dd -> xp
  created: number;
}

export type ExerciseType = 'recognition' | 'recall' | 'typed' | 'cloze' | 'listening' | 'tone' | 'write';

export interface Exercise {
  type: ExerciseType;
  conceptId: string;
  itemId?: string;       // item reviewed by this exercise (for FSRS)
  prompt: string;        // main prompt text
  sub?: string;          // secondary line (pinyin, translation)
  speak?: string;        // text to speak with speechSynthesis
  choices?: string[];
  answer: string;
  accept?: string[];     // other accepted typed answers
  explain?: string;      // shown after answering
  char?: string;         // write drills
  credit?: string;       // sentence attribution
}
