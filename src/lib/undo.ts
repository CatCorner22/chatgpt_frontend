// Studio undo/redo across questions. Pure and bounded so saved history can't grow without limit.
export const UNDO_LIMIT = 30;
export type Timeline<S> = { past: S[]; future: S[] };

export function record<S>(t: Timeline<S>, before: S): Timeline<S> {
  return { past: [...t.past, before].slice(-UNDO_LIMIT), future: [] };
}
export function undo<S>(t: Timeline<S>, now: S): { t: Timeline<S>; state: S } | null {
  const prev = t.past[t.past.length - 1];
  if (prev === undefined) return null;
  return {
    t: { past: t.past.slice(0, -1), future: [now, ...t.future].slice(0, UNDO_LIMIT) },
    state: prev,
  };
}
export function redo<S>(t: Timeline<S>, now: S): { t: Timeline<S>; state: S } | null {
  const next = t.future[0];
  if (next === undefined) return null;
  return {
    t: { past: [...t.past, now].slice(-UNDO_LIMIT), future: t.future.slice(1) },
    state: next,
  };
}
/** Keys whose change counts as one undoable design step. */
export const UNDO_KEYS = [
  "stage",
  "stepIndex",
  "tokens",
  "picks",
  "quick",
  "direction",
  "content",
  "page",
  "nav",
  "purpose",
  "integration",
] as const;
export function isDesignStep(a: Record<string, unknown>, b: Record<string, unknown>) {
  return UNDO_KEYS.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
