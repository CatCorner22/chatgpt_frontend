import { describe, expect, it } from "vitest";
import { contrast, normalizeTokens, type Tokens } from "@/lib/design";
import { affectedSteps, fixContrast, rankOptions } from "@/lib/engine";

const base = normalizeTokens({} as Tokens);
const t = (p: Partial<Tokens>) => ({ ...base, ...p });

describe("purpose interview rules", () => {
  const P = { audience: "", tone: "" } as const;
  it("removes underline buttons when visitors are mostly on phones", () => {
    const r = rankOptions({ ...P, device: "mostly phones" }, [
      { tokens: t({ buttonStyle: "underline" }) },
      { tokens: t({ buttonStyle: "solid" }) },
    ]);
    expect(r.list.map((o) => o.tokens.buttonStyle)).toEqual(["solid"]);
  });
  it("ranks filled buttons first when the goal is to buy or book", () => {
    const r = rankOptions({ ...P, goal: "buy or book" }, [
      { tokens: t({ buttonStyle: "outline" }) },
      { tokens: t({ buttonStyle: "pill" }) },
    ]);
    expect(r.list[0]!.tokens.buttonStyle).toBe("pill");
  });
  it("ranks sentence-case headings above all-caps for reading-heavy pages", () => {
    const r = rankOptions({ ...P, reading: "a lot to read" }, [
      { tokens: t({ headingCase: "uppercase" }) },
      { tokens: t({ headingCase: "normal" }) },
    ]);
    expect(r.list[0]!.tokens.headingCase).not.toBe("uppercase");
  });
});

describe("decision engine", () => {
  it("removes compact spacing for older adults", () => {
    const r = rankOptions({ audience: "older adults", tone: "" }, [
      { tokens: t({ density: "compact" }) },
      { tokens: t({ density: "airy" }) },
    ]);
    expect(r.list).toHaveLength(1);
    expect(r.list[0]!.tokens.density).toBe("airy");
    expect(r.removed).toBe(1);
  });
  it("relaxes the rule when it would remove every option", () => {
    const r = rankOptions({ audience: "older adults", tone: "" }, [
      { tokens: t({ density: "compact" }) },
    ]);
    expect(r.relaxed).toBe(true);
    expect(r.list).toHaveLength(1);
  });
  it("ranks serif headings first for an editorial tone", () => {
    const r = rankOptions({ audience: "", tone: "editorial and refined" }, [
      { tokens: t({ headingFont: "Syne" }) },
      { tokens: t({ headingFont: "Fraunces" }) },
    ]);
    expect(r.list[0]!.tokens.headingFont).toBe("Fraunces");
  });
  it("changing ground colors flags the later signal-color step", () => {
    expect(affectedSteps("palette")).toContain("accent");
  });
  it("fix-for-me brings low-contrast text to at least 4.5:1", () => {
    const f = fixContrast(
      t({
        bg: "#ffffff",
        ink: "#bbbbbb",
        muted: "#cccccc",
        accent: "#ffcc00",
        accentInk: "#ffffff",
      }),
    );
    expect(contrast(f.ink, f.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(f.muted, f.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(f.accentInk, f.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

import { measuredChecks } from "@/lib/engine";
import { CARDS, PAGE_ELEMENTS, cardFor } from "@/lib/knowledge";
import { STEPS } from "@/lib/design";
describe("knowledge and checks", () => {
  it("has a card for every Lens and every element on the page", () => {
    for (const s of STEPS) expect(cardFor(s.id)).toBeDefined();
    for (const e of PAGE_ELEMENTS) expect(cardFor(e)).toBeDefined();
    expect(CARDS.length).toBeGreaterThanOrEqual(43);
  });
  it("flags underline buttons as too small to tap", () => {
    const c = measuredChecks(t({ buttonStyle: "underline" })).find(
      (x) => x.name === "Main button height",
    )!;
    expect(c.ok).toBe(false);
  });
  it("passes button height for solid buttons", () => {
    expect(
      measuredChecks(t({ buttonStyle: "solid" })).find((x) => x.name === "Main button height")!.ok,
    ).toBe(true);
  });
});

describe("knowledge cards", () => {
  it("every card has a unique id and a floor", async () => {
    const { CARDS } = await import("@/lib/knowledge");
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) expect(c.floor.length).toBeGreaterThan(10);
  });
});

import { qualityGrade } from "@/lib/engine";
describe("quality scale", () => {
  it("any failed A-grade rule is below the floor", () => {
    expect(
      qualityGrade([
        { name: "Text contrast", ok: false, grade: "A" },
        { name: "x", ok: true, grade: "B" },
      ]).level,
    ).toBe(0);
  });
  it("only B-grade misses meets the floor", () => {
    expect(
      qualityGrade([
        { name: "a", ok: true, grade: "A" },
        { name: "b", ok: false, grade: "B" },
      ]).level,
    ).toBe(1);
  });
  it("all passing is crafted", () => {
    expect(qualityGrade([{ name: "a", ok: true, grade: "A" }]).level).toBe(2);
  });
});
