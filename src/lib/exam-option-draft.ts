import { NUDGES, type Nudge } from "./refine";

export type ExamOptionDraft = { reason: string; nudges: Nudge[] };

/** Older saved options have no draft. Ignore malformed optional data without losing the design. */
export function readExamOptionDraft(value: unknown): ExamOptionDraft | undefined {
  if (!value || typeof value !== "object") return;
  const { reason, nudges } = value as Partial<Record<keyof ExamOptionDraft, unknown>>;
  if (
    typeof reason !== "string" ||
    reason.length > 140 ||
    !Array.isArray(nudges) ||
    nudges.length > 6 ||
    !nudges.every((nudge): nudge is Nudge => NUDGES.some(({ id }) => nudge === id))
  )
    return;
  return { reason, nudges };
}
