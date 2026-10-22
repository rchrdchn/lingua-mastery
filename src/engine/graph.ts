// Concept graph: index a pack, check prerequisites, compute the frontier.
import type { Pack, Concept, Item, Progress, Status } from './types';

export interface PackIndex {
  pack: Pack;
  concept: Map<string, Concept>;
  item: Map<string, Item>;
  order: Map<string, number>;          // topological position
  depth: Map<string, number>;          // longest prerequisite chain; frontier sorts by this so tracks interleave
  dependents: Map<string, string[]>;
  itemsOf: (c: Concept) => Item[];
}

export function indexPack(pack: Pack): PackIndex {
  const concept = new Map(pack.concepts.map(c => [c.id, c]));
  const item = new Map(pack.items.map(i => [i.id, i]));
  const order = new Map(pack.concepts.map((c, i) => [c.id, i]));
  const dependents = new Map<string, string[]>();
  for (const c of pack.concepts) for (const p of c.prereqs) {
    if (!concept.has(p)) throw new Error(`Concept ${c.id} has unknown prereq ${p}`);
    if ((order.get(p) ?? 0) >= (order.get(c.id) ?? 0)) throw new Error(`Concept ${c.id} listed before its prereq ${p}`);
    (dependents.get(p) ?? dependents.set(p, []).get(p)!).push(c.id);
  }
  const depth = new Map<string, number>();
  for (const c of pack.concepts) depth.set(c.id, c.prereqs.reduce((m, id) => Math.max(m, (depth.get(id) ?? 0) + 1), 0));
  const itemsOf = (c: Concept) => (c.items ?? []).map(id => item.get(id)).filter((x): x is Item => !!x);
  return { pack, concept, item, order, depth, dependents, itemsOf };
}

export function statusOf(p: Progress, id: string): Status { return p.concepts[id]?.status ?? 'unseen'; }

/** Mastered (or mastered-but-decaying) concepts satisfy prerequisites. */
export function isDone(p: Progress, id: string): boolean {
  const s = statusOf(p, id); return s === 'mastered' || s === 'decaying';
}

export function isUnlocked(ix: PackIndex, p: Progress, c: Concept): boolean {
  return c.prereqs.every(id => isDone(p, id));
}

/** Unlocked, not yet mastered concepts: in-progress first, then by level, depth and pack order. */
export function frontier(ix: PackIndex, p: Progress): Concept[] {
  const rank = (c: Concept) => {
    const s = statusOf(p, c.id);
    const active = s === 'learning' || s === 'practicing' ? 0 : 1;
    const lvl = ix.pack.levels.findIndex(l => l.id === c.level);
    return active * 1e9 + lvl * 1e6 + (ix.depth.get(c.id) ?? 0) * 1e3 + (ix.order.get(c.id) ?? 0);
  };
  return ix.pack.concepts.filter(c => !isDone(p, c.id) && isUnlocked(ix, p, c)).sort((a, b) => rank(a) - rank(b));
}

/** All transitive prerequisites of a concept. */
export function ancestors(ix: PackIndex, id: string, out = new Set<string>()): Set<string> {
  for (const p of ix.concept.get(id)?.prereqs ?? []) if (!out.has(p)) { out.add(p); ancestors(ix, p, out); }
  return out;
}
