import { describe, expect, it } from "vitest";
import {
  contrast,
  contrastNotes,
  formatContrast,
  normalizeTokens,
  type Tokens,
} from "@/lib/design";

describe("design rules", () => {
  it("normalizes missing and malformed token objects without crashing", () => {
    for (const raw of [null, undefined, [], "bad", { headingFont: "injected", bg: "url(evil)" }]) {
      const t = normalizeTokens(raw);
      expect(t.bg).toBe("#f8fcfb");
      expect(t.headingFont).toBe("Fraunces");
      expect(Number.isFinite(t.scale)).toBe(true);
    }
  });
  it("measures black on white as 21:1", () => expect(contrast("#000000", "#ffffff")).toBe(21));
  it("does not round a ratio below 4.5 into a passing result", () => {
    const ratio = contrast("#0d8764", "#ffffff");
    expect(ratio).toBeCloseTo(4.499946370546522, 12);
    expect(ratio).toBeLessThan(4.5);
    const checks = contrastNotes(normalizeTokens({ ink: "#0d8764", bg: "#ffffff" }));
    expect(checks.find((check) => check.pair === "Text on background")?.ok).toBe(false);
    expect(formatContrast(ratio)).toBe("4.49");
    expect(formatContrast(21)).toBe("21.00");
  });
  it("clamps type ratio and radius to safe ranges and repairs bad colors", () => {
    const t = normalizeTokens({ bg: "red", scale: 9, radius: 99 } as unknown as Tokens);
    expect(t.scale).toBe(1.6);
    expect(t.radius).toBe(28);
    expect(t.bg).toBe("#f8fcfb");
  });
});
