import type { Finding, RuleRecord } from "../types";

export interface RepairItem {
  key: string;
  ruleId: string;
  where?: string;
  fix: string;
  priority: number;
  status: Finding["status"];
}
const keyOf = (finding: Finding) => `${finding.ruleId}\u0000${finding.where ?? ""}`;

/** Within a round, adverse evidence wins regardless of input order. */
function roundEvidence(findings: Finding[]): Map<string, Finding> {
  const priority: Record<Finding["status"], number> = {
    fails: 3,
    "could-not-measure": 2,
    holds: 1,
    "not-applicable": 0,
  };
  const evidence = new Map<string, Finding>();
  for (const finding of findings) {
    const key = keyOf(finding);
    const existing = evidence.get(key);
    if (!existing || priority[finding.status] > priority[existing.status])
      evidence.set(key, finding);
  }
  return evidence;
}

/** A missing finding is unresolved; only an explicit later hold confirms a repair. */
export function repairPlan(
  findings: Finding[],
  previousRounds: Finding[][] = [],
  rules: RuleRecord[] = [],
) {
  const history = new Map<string, Finding>();
  for (const round of previousRounds)
    for (const [key, finding] of roundEvidence(round)) history.set(key, finding);
  const latest = roundEvidence(findings);
  const fixed = [...latest.values()]
    .filter(
      (finding) => finding.status === "holds" && history.get(keyOf(finding))?.status === "fails",
    )
    .map(keyOf);
  const current = new Map(history);
  for (const [key, finding] of latest) current.set(key, finding);
  const currentKeys = new Set(latest.keys());
  const priority = (finding: Finding) => {
    const rule = rules.find((candidate) => candidate.id === finding.ruleId);
    if (rule?.group === "floor") return 0;
    if (/^(?:fit|spec)-/.test(finding.ruleId)) return 1;
    if (/^(?:tell|tells)-/.test(finding.ruleId)) return 3;
    return 2;
  };
  const remaining: RepairItem[] = [...current.values()]
    .filter((finding) => finding.status === "fails" || finding.status === "could-not-measure")
    .map((finding) => ({
      key: keyOf(finding),
      ruleId: finding.ruleId,
      ...(finding.where === undefined ? {} : { where: finding.where }),
      fix: currentKeys.has(keyOf(finding))
        ? finding.fix ||
          "Measure this check again and make the smallest change supported by the result."
        : "Run this check again; the latest round did not establish whether the earlier problem is resolved.",
      priority: priority(finding),
      status: currentKeys.has(keyOf(finding)) ? finding.status : "could-not-measure",
    }))
    .sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  const stopped = previousRounds.length >= 3;
  return {
    round: previousRounds.length + 1,
    stopped,
    items: stopped ? [] : remaining,
    remaining,
    fixed,
  };
}
