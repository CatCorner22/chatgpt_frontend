// Taste memory: the owner's earlier picks and reasons, kept in this browser and offered to the AI.
import type { Pick } from "./design";
export const TASTE_KEY = "refraction:taste:v1";
export type TasteEntry = Pick & { brand: string; passed?: boolean };
const MAX = 30;

export function parseTaste(raw: string | null): TasteEntry[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v)
      ? v
          .filter((e) => e && typeof e.step === "string" && typeof e.label === "string")
          .map((e) => ({
            step: e.step,
            label: e.label,
            reason: String(e.reason ?? ""),
            brand: String(e.brand ?? ""),
            ...(e.passed === true ? { passed: true } : {}),
          }))
      : [];
  } catch {
    return [];
  }
}

// Newest last; a repeat of the same step+label+brand replaces the old one.
export function rememberTaste(list: TasteEntry[], picks: Pick[], brand: string): TasteEntry[] {
  const add = picks.map((p) => ({ ...p, brand }));
  const key = (e: TasteEntry) => `${e.step}|${e.label}|${e.brand}`;
  const keys = new Set(add.map(key));
  return [...list.filter((e) => !keys.has(key(e))), ...add].slice(-MAX);
}

// Short text for the AI; only entries with a reason carry real taste signal, so they come first.
export function tasteText(list: TasteEntry[], max = 600) {
  const newest = [...list].reverse();
  // Choices behind a site that earned its badge are the strongest signal, then choices with reasons.
  const sorted = [
    ...newest.filter((e) => e.passed),
    ...newest.filter((e) => !e.passed && e.reason),
    ...newest.filter((e) => !e.passed && !e.reason),
  ];
  let out = "";
  for (const e of sorted) {
    const line = `${e.step}: ${e.label}${e.reason ? ` (${e.reason})` : ""}${e.passed ? " [used on a site that passed its Focus badge]" : ""}`;
    if ((out + "; " + line).length > max) break;
    out = out ? `${out}; ${line}` : line;
  }
  return out;
}

/** Marks a design's choices as having produced a site that passed its badge. */
export function markPassed(list: TasteEntry[], picks: Pick[], brand: string): TasteEntry[] {
  return rememberTaste(list, picks, brand).map((e) =>
    e.brand === brand && picks.some((p) => p.step === e.step && p.label === e.label) ? { ...e, passed: true } : e,
  );
}

/** "Your style so far": the most chosen answer for each question, with how often and how many passed. */
export function styleSoFar(list: TasteEntry[]) {
  const byStep = new Map<string, Map<string, { n: number; passed: number }>>();
  for (const e of list) {
    const m = byStep.get(e.step) ?? new Map();
    const c = m.get(e.label) ?? { n: 0, passed: 0 };
    m.set(e.label, { n: c.n + 1, passed: c.passed + (e.passed ? 1 : 0) });
    byStep.set(e.step, m);
  }
  return [...byStep.entries()].map(([step, m]) => {
    const [label, c] = [...m.entries()].sort((a, b) => b[1].passed - a[1].passed || b[1].n - a[1].n)[0]!;
    return { step, label, times: c.n, passed: c.passed };
  });
}
