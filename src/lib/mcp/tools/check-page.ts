import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "check_page",
  title: "Check a page against my design",
  description: "Measure a public web page: Quality score, problems found, and whether it carries the signed Focus design code. No AI opinion.",
  inputSchema: {
    url: z.string().min(4).max(500).describe("Public page address."),
    design_id: z.string().regex(/^f-[0-9a-f]{10}$/).optional().describe("Expected Focus design code."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ url, design_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to Focus first.");
    const { analyzePage, readFocusStamp, fitterBrief, safeUrl } = await import("@/lib/critic");
    const { grabSiteSources } = await import("@/lib/watchtower.server");
    const { stampStatus } = await import("@/lib/signing.server");
    let src: { html: string; css: string };
    try {
      src = await grabSiteSources(url);
    } catch (e) {
      throw new ToolError(e instanceof Error ? e.message : "Could not open this page.");
    }
    const r = analyzePage(src.html, src.css);
    const stamp = readFocusStamp(src.html, src.css);
    const signed = await stampStatus(stamp);
    const problems = r.findings.filter((f) => !f.ok && !f.possible).map((f) => ({ severity: f.severity, problem: f.detail, fix: f.fix }));
    const codeMatches = design_id ? stamp?.id === design_id : null;
    const fixes = fitterBrief(safeUrl(url)?.hostname ?? url, r.findings, codeMatches === false ? ["The page's Focus design code is not this design's code"] : []);
    return {
      content: [{ type: "text", text: `Quality score ${r.score}. ${problems.length} problems. Design code: ${signed ?? "none"}${codeMatches === false ? " (does not match this design)" : ""}.\n\nWhat to fix next:\n${fixes}` }],
      structuredContent: { score: r.score, code: signed ?? "none", code_matches: codeMatches, problems, what_to_fix: fixes },
    };
  },
});
