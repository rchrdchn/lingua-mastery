// localStorage persistence. No accounts: progress lives in this browser only.
import type { Base, Progress } from './types';

export const SETTINGS_KEY = 'lm:settings';
const key = (pack: string, base: Base) => `lm:v1:${pack}:${base}`;

export interface Settings { base: Partial<Record<string, Base>>; audio: boolean; uiBase?: Base }

function ls(): Storage | null { try { return globalThis.localStorage ?? null; } catch { return null; } }

export function newProgress(pack: string, base: Base): Progress {
  return { v: 1, pack, base, xp: 0, xpSinceCheck: 0, placementDone: false, concepts: {}, cards: {}, days: {}, created: Date.now() };
}

export function loadProgress(pack: string, base: Base): Progress {
  const raw = ls()?.getItem(key(pack, base));
  if (raw) { try { const p = JSON.parse(raw); if (p && p.v === 1) return p; } catch { /* fall through */ } }
  return newProgress(pack, base);
}

export function saveProgress(p: Progress) { ls()?.setItem(key(p.pack, p.base), JSON.stringify(p)); }
export function resetProgress(pack: string, base: Base) { ls()?.removeItem(key(pack, base)); }

export function loadSettings(): Settings {
  try { const s = JSON.parse(ls()?.getItem(SETTINGS_KEY) || '{}'); return { base: s.base ?? {}, audio: s.audio ?? true, uiBase: s.uiBase }; }
  catch { return { base: {}, audio: true }; }
}
export function saveSettings(s: Settings) { ls()?.setItem(SETTINGS_KEY, JSON.stringify(s)); }

/** Export/import so learners can move progress between browsers by hand. */
export function exportAll(): string {
  const out: Record<string, string> = {}; const s = ls(); if (!s) return '{}';
  for (let i = 0; i < s.length; i++) { const k = s.key(i)!; if (k.startsWith('lm:')) out[k] = s.getItem(k)!; }
  return JSON.stringify(out);
}
export function importAll(json: string) {
  const data = JSON.parse(json) as Record<string, string>; const s = ls(); if (!s) return;
  for (const [k, v] of Object.entries(data)) if (k.startsWith('lm:')) s.setItem(k, v);
}
