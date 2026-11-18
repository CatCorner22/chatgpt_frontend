import { focusLocalStorage } from "./browser-storage";
import {
  launchDetailsSchema,
  parseProgress,
  PROGRESS_KEY,
  type LaunchDetails,
  type ProgressRecord,
} from "./launch";

/** Display valid history without silently treating corrupt storage as an empty collection. */
export function readHorizonProgress(storage: Pick<Storage, "getItem"> = focusLocalStorage): {
  records: ProgressRecord[];
  issue: "unavailable" | "invalid" | null;
} {
  let raw: string | null;
  try {
    raw = storage.getItem(PROGRESS_KEY);
  } catch {
    return { records: [], issue: "unavailable" };
  }
  if (raw === null) return { records: [], issue: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { records: [], issue: "invalid" };
    const container = value as Record<string, unknown>;
    if (container["version"] !== 1 || !Array.isArray(container["records"]))
      return { records: [], issue: "invalid" };
    const rows: unknown[] = container["records"];
    const validDetails = rows.filter(
      (row) =>
        row &&
        typeof row === "object" &&
        !Array.isArray(row) &&
        launchDetailsSchema.safeParse((row as Record<string, unknown>)["details"]).success,
    );
    // Reuse the existing record parser for identity/date/fingerprint validation.
    const records = parseProgress(JSON.stringify({ version: 1, records: validDetails }));
    return { records, issue: records.length === rows.length ? null : "invalid" };
  } catch {
    return { records: [], issue: "invalid" };
  }
}

/** Guidance is descriptive only. It never changes evidence or approves a release. */
export function horizonGuidance(details: LaunchDetails): { label: string; next: string } {
  const latest = details.reviews.at(-1);
  const latestHasIssues =
    latest &&
    (latest.checks.some((check) => !check.ok) || latest.prescription.some((check) => !check.ok));
  switch (details.status) {
    case "ready":
      return {
        label: "Vision completed",
        next: "Reopen this design in My designs. Keep a backup, prepare the handoff, and try one page in an isolated preview before changing the live project.",
      };
    case "built":
      return {
        label: "Build recorded",
        next: "Reopen the design's Vision to review the build. Test the original visitor tasks on phone, desktop and keyboard in the isolated preview, then keep the results with the design.",
      };
    case "reviewed":
      return {
        label: "Review recorded",
        next: latestHasIssues
          ? "The latest saved review has unresolved findings. Fix them in the isolated preview and review the same build again. Then verify the visitor tasks and selective rollback before an owner-reviewed release."
          : "Review evidence is a starting point. Complete the original visitor tasks, including private workflows, and demonstrate selective rollback in the isolated preview before the owner reviews a release.",
      };
    case "launched":
      return {
        label: "Launch recorded by owner",
        next: latestHasIssues
          ? "This is a historical owner-recorded launch, and the latest saved review contains findings. Revisit those findings and the affected tasks; this record does not certify the current site."
          : "Keep the approved revision and rollback plan. Recheck the published page and important journeys after changes, and watch your own error logs and user feedback. This historical record does not certify the current site.",
      };
  }
}
