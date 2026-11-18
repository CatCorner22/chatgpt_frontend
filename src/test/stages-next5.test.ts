import { describe, expect, it } from "vitest";
import { buildPrescription, contrastNotes, normalizeTokens, type Tokens } from "@/lib/design";
import { applyNudges, nudge } from "@/lib/refine";
import { parseTaste, rememberTaste, tasteText } from "@/lib/taste";
import { fluidSizes } from "@/lib/techniques";

const base = normalizeTokens({});
const content = { brand: "B", headline: "H", sub: "S", cta: "Go", features: [], quote: "Q" };

describe("fine-tune nudges", () => {
  it("bolder raises and quieter lowers the size ratio, within limits", () => {
    expect(nudge(base, "bolder").scale).toBeCloseTo(base.scale + 0.08);
    expect(nudge(base, "quieter").scale).toBeCloseTo(base.scale - 0.08);
    expect(applyNudges(base, Array(20).fill("bolder")).scale).toBe(1.6);
  });
  it("quieter removes the special touch", () => {
    expect(nudge({ ...base, texture: "glow" } as Tokens, "quieter").texture).toBe("none");
  });
  it("warmer and cooler move the ground color in opposite directions", () => {
    const w = nudge(base, "warmer").bg,
      c = nudge(base, "cooler").bg;
    expect(parseInt(w.slice(1, 3), 16)).toBeGreaterThan(parseInt(c.slice(1, 3), 16));
  });
  it("never leaves readable text unreadable", () => {
    let t = base;
    for (let i = 0; i < 10; i++) t = nudge(t, i % 2 ? "warmer" : "cooler");
    expect(contrastNotes(t).every((n) => n.ok)).toBe(true);
  });
});

describe("taste memory", () => {
  it("keeps at most 30 entries and replaces repeats", () => {
    let l = parseTaste("bad");
    for (let i = 0; i < 40; i++)
      l = rememberTaste(l, [{ step: "Type", label: `L${i}`, reason: "" }], "B");
    expect(l).toHaveLength(30);
    l = rememberTaste(l, [{ step: "Type", label: "L39", reason: "crisp" }], "B");
    expect(l.filter((e) => e.label === "L39")).toEqual([
      { step: "Type", label: "L39", reason: "crisp", brand: "B" },
    ]);
  });
  it("puts reasoned picks first in the AI text and respects the length cap", () => {
    const l = rememberTaste(
      [],
      [
        { step: "A", label: "x", reason: "" },
        { step: "B", label: "y", reason: "feels warm" },
      ],
      "B",
    );
    expect(tasteText(l).startsWith("B: y (feels warm)")).toBe(true);
    expect(tasteText(l, 10).length).toBeLessThanOrEqual(10);
  });
});

describe("prescription additions", () => {
  it("fluid heading sizes end at the token size and never start below 1rem", () => {
    const f = fluidSizes({ ...base, scale: 1.25 });
    expect(f[0]!.css).toContain("2.44rem)");
    expect(f.every((x) => parseFloat(x.css.slice(6)) >= 1)).toBe(true);
  });
  it("includes modern techniques and the chosen navigation pattern", () => {
    const md = buildPrescription({
      brief: "b",
      content,
      direction: "d",
      tokens: base,
      picks: [],
      tool: "Lovable",
      nav: "bottom-tabs",
    });
    expect(md).toContain("## Modern techniques");
    expect(md).toContain("Tabs at the bottom on phones");
  });
});
