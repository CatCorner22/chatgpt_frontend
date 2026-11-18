export type Advice = { title: string; why: string; fix: string };
export function advisorReport(o: {
  business: string;
  client: string;
  target: string;
  summary: string;
  priorities: Advice[];
  brief: string;
  measured: boolean;
}) {
  return [
    `# Design improvement plan — ${o.client || o.target}`,
    `Prepared by: ${o.business || "Focus"}`,
    `Reviewed: ${o.target}`,
    `Evidence: ${o.measured ? "Downloaded page-code measurements with optional AI opinion; not a full accessibility or legal audit." : "Screenshot-based AI opinion only; interactions and accessibility are unverified."}`,
    "",
    "## Assessment",
    o.summary,
    "",
    "## Improve in this order",
    ...o.priorities.flatMap((p, i) => [
      `### ${i + 1}. ${p.title}`,
      `Why visitors benefit: ${p.why}`,
      `Change: ${p.fix}`,
      "Verify: Apply this change, re-check the page or screenshot, then test the affected task on phone and desktop.",
      "",
    ]),
    "## Protect what works",
    "Keep existing content, business claims, data, permissions and working actions. Do not invent testimonials or change prices.",
    "",
    "## Builder hand-off",
    o.brief,
    "",
    "## Acceptance checks",
    "- Complete the main user task with keyboard only and on a phone.",
    "- Check empty, loading, error and successful outcomes in any app flow.",
    "- Re-run the review; compare findings, not just the overall score.",
    "- Ask a first-time user to complete the task without instructions.",
  ].join("\n");
}
