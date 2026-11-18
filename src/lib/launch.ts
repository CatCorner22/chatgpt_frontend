import { focusLocalStorage } from "@/lib/browser-storage";
import { z } from "zod";
import { normalizeTokens } from "./design";
import { safeUrl } from "./critic";

export const TASKS = [
  { id: "main", label: "The main visitor task works from start to finish" },
  { id: "phone", label: "The task works on a phone without sideways scrolling" },
  { id: "keyboard", label: "The task works with a keyboard and visible focus" },
  { id: "states", label: "Loading, empty, error and successful outcomes are clear" },
] as const;
export const reviewEvidenceSchema = z.object({
  kind: z.enum(["page", "screenshot"]),
  target: z.string().max(500),
  at: z.string().datetime(),
  score: z.number().min(0).max(100).nullable(),
  summary: z.string().max(4000),
  checks: z
    .array(
      z.object({
        name: z.string().max(200),
        ok: z.boolean(),
        possible: z.boolean().optional(),
        detail: z.string().max(2000),
        fix: z.string().max(3000),
      }),
    )
    .max(40),
  prescription: z.array(z.object({ name: z.string().max(200), ok: z.boolean() })).max(30),
  priorities: z
    .array(
      z.object({
        title: z.string().max(300),
        why: z.string().max(2000),
        fix: z.string().max(3000),
      }),
    )
    .max(6),
  repair: z.string().max(20000),
});
export type ReviewEvidence = z.infer<typeof reviewEvidenceSchema>;
export const launchDetailsSchema = z.object({
  version: z.literal(1),
  status: z.enum(["ready", "built", "reviewed", "launched"]),
  url: z.string().max(500),
  tasks: z.array(z.enum(["main", "phone", "keyboard", "states"])).max(4),
  reviews: z.array(reviewEvidenceSchema).max(20),
  launchedAt: z.string().datetime().nullable(),
});
export type LaunchDetails = z.infer<typeof launchDetailsSchema>;
export const EMPTY_LAUNCH: LaunchDetails = {
  version: 1,
  status: "ready",
  url: "",
  tasks: [],
  reviews: [],
  launchedAt: null,
};
export const PROGRESS_KEY = "refraction:launch:v1";
export type ProgressRecord = {
  id: string;
  title: string;
  completedAt: string;
  details: LaunchDetails;
  fingerprint: string;
};

export function parseDetails(value: unknown): LaunchDetails {
  const result = launchDetailsSchema.safeParse(value);
  return result.success ? result.data : { ...EMPTY_LAUNCH, tasks: [], reviews: [] };
}
export function designFingerprint(tokens: unknown) {
  return JSON.stringify(normalizeTokens(tokens));
}
/**
 * A stable change detector for the whole reviewed build, not an authenticity proof.
 * Object key order is irrelevant; array order and owner text remain meaningful.
 * The bounded value also fits existing cloud records without storing content there.
 */
export function launchFingerprint(tokens: unknown, artifact?: unknown): string {
  if (artifact === undefined) return designFingerprint(tokens);
  const canonical = JSON.stringify(
    { tokens: normalizeTokens(tokens), artifact },
    (_key, value: unknown) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        );
      }
      return value;
    },
  );
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x85ebca6b) >>> 0;
  }
  return `artifact-v1:${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}
// Short public code for a design: same values, same code; reveals none of the values.
export function designId(tokens: unknown) {
  const str = designFingerprint(tokens);
  let a = 0x811c9dc5,
    b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 + 2) >>> 0;
  }
  return `f-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0").slice(0, 2)}`;
}
export function addEvidence(d: LaunchDetails, review: ReviewEvidence): LaunchDetails {
  return {
    ...d,
    status: "reviewed",
    launchedAt: null,
    reviews: [...d.reviews, review].slice(-20),
    tasks: [],
  };
}
/** Readiness concerns this exact reviewed URL; owner confirmations cannot clear known failures. */
export function launchBlocker(d: LaunchDetails): string | null {
  const target = safeUrl(d.url)?.href;
  if (!target) return "Add the public address of your built page first.";
  const pageReviews = d.reviews
    .filter((review) => review.kind === "page" && safeUrl(review.target)?.href === target)
    .map((review) => ({ ...review, target }));
  if (!pageReviews.at(-1)?.checks.some((check) => !check.possible))
    return "Review this exact built page first. Screenshot feedback does not verify a live address.";
  if (!fixPlan(pageReviews)?.passed)
    return "Resolve and recheck the recorded findings for this page before recording a launch.";
  if (!TASKS.every((task) => d.tasks.includes(task.id)))
    return "Complete all four task confirmations on the reviewed result before recording a launch.";
  return null;
}
export function canLaunch(d: LaunchDetails): boolean {
  return launchBlocker(d) === null;
}
export function markLaunched(d: LaunchDetails, at: string): LaunchDetails {
  const blocker = launchBlocker(d);
  if (blocker) throw new Error(blocker);
  return { ...d, status: "launched", launchedAt: d.launchedAt ?? at };
}
export function evidenceChange(reviews: ReviewEvidence[]) {
  const last = reviews.at(-1);
  if (!last) return null;
  const prior = reviews
    .slice(0, -1)
    .reverse()
    .find((r) => r.kind === last.kind && r.target === last.target);
  if (!prior) return null;
  const before = new Map(prior.checks.map((c) => [c.name, c.ok]));
  return {
    resolved: last.checks.filter((c) => c.ok && before.get(c.name) === false).length,
    newIssues: last.checks.filter((c) => !c.ok && before.get(c.name) === true).length,
    scoreDelta: last.score !== null && prior.score !== null ? last.score - prior.score : null,
  };
}
export function parseProgress(raw: string | null): ProgressRecord[] {
  try {
    const v = JSON.parse(raw ?? "null");
    if (v?.version !== 1 || !Array.isArray(v.records)) return [];
    return v.records.flatMap((r: ProgressRecord) =>
      typeof r?.id === "string" &&
      typeof r.title === "string" &&
      typeof r.fingerprint === "string" &&
      Number.isFinite(Date.parse(r.completedAt))
        ? [{ ...r, details: parseDetails(r.details) }]
        : [],
    );
  } catch {
    return [];
  }
}
export function upsertProgress(
  list: ProgressRecord[],
  id: string,
  title: string,
  tokens: unknown,
  at: string,
  artifact?: unknown,
): ProgressRecord[] {
  const old = list.find((r) => r.id === id);
  const fingerprint = launchFingerprint(tokens, artifact);
  const record: ProgressRecord = {
    id,
    title,
    completedAt: old?.completedAt ?? at,
    fingerprint,
    details:
      old?.fingerprint === fingerprint ? old.details : { ...EMPTY_LAUNCH, reviews: [], tasks: [] },
  };
  return old ? list.map((r) => (r.id === id ? record : r)) : [...list, record];
}
export function readProgress() {
  return parseProgress(focusLocalStorage.getItem(PROGRESS_KEY));
}
export function writeProgress(records: ProgressRecord[]) {
  focusLocalStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, records }));
}
export function weeklyTotals(records: ProgressRecord[], now: string) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - ((day + 6) % 7),
  );
  const inWeek = (value: string) =>
    Date.parse(value) >= start && Date.parse(value) < start + 604800000;
  return {
    completed: records.filter((r) => inWeek(r.completedAt)).length,
    launched: records.filter((r) => r.details.launchedAt && inWeek(r.details.launchedAt)).length,
  };
}
export function repairPack(title: string, review: ReviewEvidence) {
  return `# Result repair — ${title}\n\nScreen/page: ${review.target}\nEvidence: ${review.kind === "page" ? "Downloaded page measurements plus optional AI opinion" : "Screenshot AI opinion; interactions unverified"}\n\nKeep all existing copy, prices, records, permissions and working actions.\n\n${review.repair || "No repair items were identified."}\n\n## Verify after editing\nComplete the affected task on phone and desktop, with keyboard only. Test loading, empty, error and success states. Return this same page or screen to Focus for another review.\n`;
}

// Fix-until-it-passes: what still needs attention after the latest review, what got fixed since
// the previous review of the same page, and the order to work in (Vision mismatches first,
// then measured failures in the Critic's order). Pure so every round is predictable and tested.
export type FixItem = {
  key: string;
  title: string;
  fix: string;
  source: "prescription" | "measured";
};
export function fixPlan(reviews: ReviewEvidence[]) {
  const last = reviews.at(-1);
  if (!last) return null;
  const same = reviews.filter((r) => r.kind === last.kind && r.target === last.target);
  // Older records omitted this classification. A fresh same-page review may identify a
  // finding as advisory, but an omitted check alone can never clear an earlier failure.
  const advisoryChecks = new Set<string>();
  for (const review of same) {
    for (const check of review.checks) {
      if (check.possible) advisoryChecks.add(check.name);
      else advisoryChecks.delete(check.name);
    }
  }
  const items = (review: ReviewEvidence): { item: FixItem; ok: boolean }[] => [
    ...review.prescription.map((p) => ({
      ok: p.ok,
      item: {
        key: `rx:${p.name}`,
        title: `Doesn't match your design: ${p.name}`,
        fix: `Make the built page use the Vision's ${p.name} exactly.`,
        source: "prescription" as const,
      },
    })),
    ...review.checks
      .filter((c) => !c.possible && !advisoryChecks.has(c.name))
      .map((c) => ({
        ok: c.ok,
        item: {
          key: `m:${c.name}`,
          title: c.detail,
          fix: c.fix,
          source: "measured" as const,
        },
      })),
  ];
  // Keep an issue open until a later review explicitly reports that same check holds.
  // A partial review that omits the check provides no evidence of a repair.
  const outstanding = new Map<string, FixItem>();
  for (const review of same.slice(0, -1)) {
    for (const { item, ok } of items(review)) {
      if (ok) outstanding.delete(item.key);
      else outstanding.set(item.key, item);
    }
  }
  const wasFailing = new Set(outstanding.keys());
  const latest = items(last);
  const nowPassing = new Set(latest.filter((row) => row.ok).map((row) => row.item.key));
  for (const { item, ok } of latest) {
    if (ok) outstanding.delete(item.key);
    else outstanding.set(item.key, item);
  }
  const measuredNow = new Set(latest.map((row) => row.item.key));
  const still = [...outstanding.values()]
    .map((item) =>
      measuredNow.has(item.key)
        ? item
        : {
            ...item,
            title: `Not rechecked: ${item.key.replace(/^(m|rx):/, "")}`,
            fix: `Run this check again to verify the earlier repair. ${item.fix}`,
          },
    )
    .sort((a, b) => Number(a.source === "measured") - Number(b.source === "measured"));
  const fixed = [...wasFailing]
    .filter((k) => nowPassing.has(k))
    .map((k) => k.replace(/^(m|rx):/, ""));
  const fresh =
    same.length > 1 ? still.filter((s) => !wasFailing.has(s.key)).map((s) => s.key) : [];
  return {
    round: same.length,
    still,
    fixed,
    fresh,
    passed: latest.length > 0 && still.length === 0,
  };
}

export function fixMessage(tool: string, title: string, item: FixItem) {
  return `In ${title}, fix one thing and change nothing else (keep all words, prices, links and working buttons).\n\nProblem: ${item.title}\nFix: ${item.fix}\n\nThen check the page at phone and computer widths. (Prepared by Focus for ${tool}.)`;
}
