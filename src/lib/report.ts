// Critic score history (kept in the browser) and the client-ready report text. Pure, tested.
export type HistoryEntry = { host: string; score: number; fails: number; at: string };
export const HISTORY_KEY = "refraction:critic-history:v1";
const MAX_PER_HOST = 10;

export function parseHistory(raw: string | null): HistoryEntry[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (e) =>
          e && typeof e.host === "string" && Number.isFinite(e.score) && typeof e.at === "string",
      )
      .map((e) => ({
        host: e.host,
        score: Math.round(e.score),
        fails: Number(e.fails) || 0,
        at: e.at,
      }));
  } catch {
    return [];
  }
}

// Adds a run; keeps at most MAX_PER_HOST runs per site, newest last.
export function addRun(list: HistoryEntry[], run: HistoryEntry): HistoryEntry[] {
  const next = [...list, run];
  const same = next.filter((e) => e.host === run.host);
  const drop = new Set(same.slice(0, Math.max(0, same.length - MAX_PER_HOST)));
  return next.filter((e) => !drop.has(e));
}

export function runsFor(list: HistoryEntry[], host: string) {
  return list.filter((e) => e.host === host);
}

// Change versus the previous run of the same site, or null for a first review.
export function scoreChange(
  list: HistoryEntry[],
  host: string,
): { before: number; after: number; delta: number } | null {
  const r = runsFor(list, host);
  if (r.length < 2) return null;
  const before = r[r.length - 2]!.score,
    after = r[r.length - 1]!.score;
  return { before, after, delta: after - before };
}

type Finding = { area: string; detail: string; fix: string; ok: boolean; severity?: string };
type Priority = { title: string; why: string; fix: string };
export function clientReport(o: {
  host: string;
  title: string;
  score: number;
  date: string;
  findings: Finding[];
  verdict?: string | undefined;
  priorities?: Priority[] | undefined;
  strengths?: string[] | undefined;
  change?: { before: number; after: number; delta: number } | null;
  brief: string;
}): string {
  const fails = o.findings.filter((f) => !f.ok),
    passes = o.findings.filter((f) => f.ok);
  const L: string[] = [
    `# Design review: ${o.title || o.host}`,
    ``,
    `Site: ${o.host}  `,
    `Date: ${o.date}  `,
    `Quality score: **${o.score} / 100**`,
  ];
  if (o.change)
    L.push(
      `Change since last review: ${o.change.before} → ${o.change.after} (${o.change.delta >= 0 ? "+" : ""}${o.change.delta})`,
    );
  L.push(
    ``,
    `## Summary`,
    o.verdict ?? "Measured findings only; the art director review was unavailable.",
    ``,
  );
  if (o.priorities?.length) {
    L.push(`## Top fixes, in order`);
    o.priorities.forEach((p, i) => L.push(`${i + 1}. **${p.title}** — ${p.why} *Fix:* ${p.fix}`));
    L.push(``);
  }
  if (o.strengths?.length) {
    L.push(`## What already works`);
    o.strengths.forEach((s) => L.push(`- ${s}`));
    L.push(``);
  }
  L.push(`## Measured issues (${fails.length})`);
  if (!fails.length) L.push(`- None found.`);
  fails.forEach((f) => L.push(`- **${f.area}**: ${f.detail} — ${f.fix}`));
  L.push(``, `## Passed checks (${passes.length})`);
  passes.forEach((f) => L.push(`- ${f.area}: ${f.detail}`));
  L.push(
    ``,
    `## Repair brief for the site's builder`,
    "```",
    o.brief,
    "```",
    ``,
    `_Measured checks come from code; the summary and top fixes are an AI art director's opinion. Prepared with Focus._`,
  );
  return L.join("\n");
}
