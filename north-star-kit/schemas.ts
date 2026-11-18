import { z } from "zod";
import type { RuleRecord } from "./types";

export const sourceRefSchema = z.object({
  title: z.string().trim().min(1),
  url: z.url().optional(),
  section: z.string().min(1).optional(),
  basis: z.enum(["read", "abstract", "snippet", "builder"]),
});
export const ruleRecordSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
    group: z.enum(["craft", "state", "behavior", "neuro", "floor"]),
    plain: z.string().trim().min(1),
    why: z.string().trim().min(1),
    appliesWhen: z.string().min(1).optional(),
    check: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("page-check"), fn: z.string().regex(/^[A-Za-z_$][\w$]*$/) }),
      z.object({ kind: z.literal("person"), ask: z.string().trim().min(1) }),
    ]),
    overridable: z.boolean(),
    evidence: z.enum(["measured", "convention", "expert-opinion"]),
    sources: z.array(sourceRefSchema).min(1),
    reviewed: z.iso.date(),
  })
  .superRefine((rule, ctx) => {
    if (rule.group === "floor" && rule.overridable) {
      ctx.addIssue({
        code: "custom",
        path: ["overridable"],
        message: "A floor cannot be overridden.",
      });
    }
    if (
      rule.sources.every((source) => source.basis === "builder") &&
      rule.evidence !== "expert-opinion"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "A rule supported only by the builder is expert opinion.",
      });
    }
  });
export const findingSchema = z.object({
  ruleId: z.string().min(1),
  status: z.enum(["fails", "holds", "not-applicable", "could-not-measure"]),
  where: z.string().optional(),
  measured: z.string().optional(),
  required: z.string().optional(),
  fix: z.string().optional(),
});
export const tokensSchema = z.record(
  z.string().regex(/^--[a-zA-Z_][\w-]*$/, "Use CSS custom property names."),
  z.string().trim().min(1).max(2000),
);

/** Rejects duplicate IDs as well as invalid records. It never repairs rule data silently. */
export function validateRules(input: unknown): RuleRecord[] {
  const parsed = z.array(ruleRecordSchema).parse(input);
  const seen = new Set<string>();
  for (const rule of parsed) {
    if (seen.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
    seen.add(rule.id);
  }
  return parsed;
}
