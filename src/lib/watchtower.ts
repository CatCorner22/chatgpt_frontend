import { safeUrl, type Finding } from "./critic";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export function watchAddress(input: string): string {
  const u = safeUrl(input);
  if (!u) throw new Error("Enter a public website or app address.");
  u.hash = "";
  return u.toString();
}
export function changedFindings(before: Finding[], after: Finding[]) {
  const old = new Map(before.map((f) => [f.id, f.ok]));
  return {
    newIssues: after.filter((f) => !f.ok && old.get(f.id) === true),
    resolved: after.filter((f) => f.ok && old.get(f.id) === false),
  };
}
export function parseFindings(value: unknown): Finding[] {
  return Array.isArray(value)
    ? value.filter(
        (f): f is Finding =>
          !!f &&
          typeof f.id === "string" &&
          typeof f.ok === "boolean" &&
          typeof f.area === "string" &&
          typeof f.detail === "string" &&
          typeof f.fix === "string" &&
          ["high", "medium", "low"].includes(f.severity),
      )
    : [];
}

// Compares the Focus design code between the last two checks of a page.
export function tagChange(history: unknown[]): "missing" | "changed" | null {
  const ids = history
    .slice(-2)
    .map((h) => (h && typeof h === "object" && "designId" in h ? (h as { designId: unknown }).designId : null))
    .map((v) => (typeof v === "string" ? v : null));
  if (ids.length < 2) return null;
  const [before, now] = ids;
  if (before && !now) return "missing";
  if (before && now && before !== now) return "changed";
  return null;
}

/** Valid dated scores from a page's stored history, oldest first, for the timeline. */
export function scoreTimeline(history: unknown[]): { at: string; score: number }[] {
  return history.flatMap((h) => {
    if (!h || typeof h !== "object") return [];
    const { at, score } = h as { at?: unknown; score?: unknown };
    return typeof at === "string" && typeof score === "number" && !Number.isNaN(Date.parse(at))
      ? [{ at, score: Math.max(0, Math.min(100, Math.round(score))) }]
      : [];
  });
}
