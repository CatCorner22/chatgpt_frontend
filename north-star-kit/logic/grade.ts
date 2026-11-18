import type { Finding, RuleRecord } from "../types";

export interface Grade {
  label: "Below floor" | "Meets floor" | "Crafted" | null;
  complete: boolean;
  failed: string[];
  unmeasured: string[];
  summary: string;
}

/** Grades only the supplied rule scope. Missing evidence can never establish a floor. */
export function grade(findings: Finding[], rules: RuleRecord[] = []): Grade {
  const declared = new Set(rules.map((rule) => rule.id));
  const hasUnknownRules = findings.some((finding) => !declared.has(finding.ruleId));
  const floors = rules.filter((rule) => rule.group === "floor");
  const pageRules = rules.filter((rule) => rule.check.kind === "page-check");
  const failed = [
    ...new Set(
      findings.filter((finding) => finding.status === "fails").map((finding) => finding.ruleId),
    ),
  ];
  const unmeasured = rules
    .filter((rule) => {
      const rows = findings.filter((finding) => finding.ruleId === rule.id);
      return rows.length === 0 || rows.some((finding) => finding.status === "could-not-measure");
    })
    .map((rule) => rule.id);
  const floorFailure = floors.some((rule) => failed.includes(rule.id));
  const complete =
    !hasUnknownRules &&
    pageRules.length > 0 &&
    !pageRules.some((rule) => unmeasured.includes(rule.id));
  if (floorFailure)
    return {
      label: "Below floor",
      complete,
      failed,
      unmeasured,
      summary: "At least one supplied floor check failed.",
    };
  if (hasUnknownRules)
    return {
      label: null,
      complete: false,
      failed,
      unmeasured,
      summary:
        "Some findings name rules outside the supplied scope. Check the rule IDs and include the full rule scope before grading.",
    };
  if (floors.length === 0 || floors.some((rule) => unmeasured.includes(rule.id))) {
    return {
      label: null,
      complete: false,
      failed,
      unmeasured,
      summary: "There is not enough evidence to establish every supplied floor.",
    };
  }
  const craft = rules.filter((rule) => rule.group === "craft" && rule.check.kind === "page-check");
  const measuredScope = pageRules.filter((rule) => !/^(?:tell|tells)-/.test(rule.id));
  const crafted =
    craft.length > 0 &&
    craft.some((rule) =>
      findings.some((finding) => finding.ruleId === rule.id && finding.status === "holds"),
    ) &&
    measuredScope.every((rule) => !failed.includes(rule.id) && !unmeasured.includes(rule.id));
  return {
    label: crafted ? "Crafted" : "Meets floor",
    complete,
    failed,
    unmeasured,
    summary: crafted
      ? "The supplied floor and measurable craft checks hold. Human review remains necessary."
      : "The supplied floor checks hold. Craft checks or human review remain.",
  };
}
