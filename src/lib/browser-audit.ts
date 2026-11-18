import { z } from "zod";

export const MAX_BROWSER_AUDIT_BYTES = 5 * 1024 * 1024;

const auditFindingSchema = z.object({
  ruleId: z.string().min(1).max(120),
  status: z.enum(["fails", "holds", "not-applicable", "could-not-measure"]),
  where: z.string().max(2000).optional(),
  measured: z.string().max(5000).optional(),
  required: z.string().max(5000).optional(),
  fix: z.string().max(5000).optional(),
});
const countsSchema = z.object({
  failureCount: z.number().int().nonnegative().max(10000),
  unknownCount: z.number().int().nonnegative().max(10000),
  scenarioCount: z.number().int().nonnegative().max(16),
});

/** Imported data is caller-supplied evidence, never proof of the target's identity. */
export const browserAuditSchema = z
  .object({
    kind: z.literal("north-star-browser-audit"),
    version: z.literal(1),
    target: z.string().trim().min(1).max(2048),
    startedAt: z.iso.datetime({ offset: true }),
    scenarios: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          label: z.string().min(1).max(200),
          viewport: z.object({
            width: z.number().int().min(1).max(20000),
            height: z.number().int().min(1).max(20000),
          }),
          preferences: z.object({
            reducedMotion: z.enum(["reduce", "no-preference"]).optional(),
            forcedColors: z.enum(["active", "none"]).optional(),
          }),
          findings: z.array(auditFindingSchema).max(1000),
          observations: z.record(z.string().max(100), z.unknown()).optional(),
          screenshots: z.object({ fullPage: z.string().min(1).max(1024).optional() }),
        }),
      )
      .min(1)
      .max(16),
    summary: countsSchema,
    limitations: z.array(z.string().min(1).max(3000)).max(40),
  })
  .superRefine((report, ctx) => {
    const ids = report.scenarios.map((scenario) => scenario.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["scenarios"],
        message: "Scenario identifiers must be unique.",
      });
    }
    if (report.scenarios.reduce((total, scenario) => total + scenario.findings.length, 0) > 10000) {
      ctx.addIssue({
        code: "custom",
        path: ["scenarios"],
        message: "The receipt has too many findings.",
      });
    }
  });

export type BrowserAudit = z.infer<typeof browserAuditSchema>;
export type BrowserAuditFinding = z.infer<typeof auditFindingSchema>;

/** Never trust summary totals supplied by a file; derive them from its findings. */
export function auditCounts(findings: readonly BrowserAuditFinding[]) {
  return {
    failureCount: findings.filter((finding) => finding.status === "fails").length,
    unknownCount: findings.filter((finding) => finding.status === "could-not-measure").length,
    holdsCount: findings.filter((finding) => finding.status === "holds").length,
    notApplicableCount: findings.filter((finding) => finding.status === "not-applicable").length,
  };
}

export function parseBrowserAudit(text: string): BrowserAudit {
  if (
    text.length > MAX_BROWSER_AUDIT_BYTES ||
    new TextEncoder().encode(text).length > MAX_BROWSER_AUDIT_BYTES
  ) {
    throw new Error("Choose a browser audit JSON file smaller than 5 MB.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose the report.json written by the browser audit command.",
    );
  }
  const result = browserAuditSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".") || "report";
    throw new Error(
      `This is not a supported browser audit receipt. Check ${field} or create a new report with the browser audit command.`,
    );
  }
  const report = result.data;
  const counts = auditCounts(report.scenarios.flatMap((scenario) => scenario.findings));
  return {
    ...report,
    summary: {
      failureCount: counts.failureCount,
      unknownCount: counts.unknownCount,
      scenarioCount: report.scenarios.length,
    },
  };
}

/** A filename is display text only: imported screenshot paths are never loaded. */
export function auditScreenshotName(path: string | undefined): string {
  if (!path) return "Not captured";
  return path.split(/[\\/]/).at(-1)?.split(/[?#]/)[0] || "Screenshot filename not supplied";
}
