import { describe, expect, it } from "vitest";
import { buildPrescription, normalizeTokens, TOOLS, toolMessages } from "@/lib/design";
import { waitMessage } from "@/lib/ux";

const content = { brand: "Kiln", headline: "h", sub: "s", cta: "Book", features: [], quote: "q" };
describe("every tool gets its own instructions and messages", () => {
  it.each(TOOLS)("%s", (tool) => {
    const md = buildPrescription({
      brief: "b",
      content,
      direction: "d",
      tokens: normalizeTokens({}),
      picks: [],
      tool,
    });
    expect(md).toContain(`## Tool instruction (${tool})`);
    const m = toolMessages(tool, "Kiln");
    expect(m.first).toContain("Kiln");
    expect(m.next).toHaveLength(4);
  });
  it("tool instructions differ between tools", () => {
    const one = (tool: (typeof TOOLS)[number]) =>
      buildPrescription({
        brief: "b",
        content,
        direction: "d",
        tokens: normalizeTokens({}),
        picks: [],
        tool,
      });
    expect(new Set(TOOLS.map(one)).size).toBe(TOOLS.length);
  });
});
describe("long waits", () => {
  it("offers Cancel only after 10 seconds and shows the time waited", () => {
    expect(waitMessage(9000, "Checking")?.canCancel).toBe(false);
    expect(waitMessage(12000, "Checking")).toEqual({
      text: "Checking… still working (12 seconds)",
      canCancel: true,
    });
  });
});
