import { describe, expect, it } from "vitest";
import { ORIGINALS, GALLERY } from "@/lib/gallery";

describe("original Directions", () => {
  it("makes every Original available in the gallery", () => {
    expect(GALLERY).toEqual(expect.arrayContaining(ORIGINALS));
  });
  it("keeps Galactic Goth's exact values", () => {
    const g = ORIGINALS.find((d) => d.id === "galactic-goth")!;
    expect(g.direction.tokens).toMatchObject({
      bg: "#0d0615",
      surface: "#160e1f",
      ink: "#f5eeff",
      accent: "#ba86ff",
      headingFont: "Playfair Display",
      bodyFont: "Manrope",
      texture: "stars",
      scale: 1.42,
    });
    expect(g.extras?.accent2).toBe("#ff6f7a");
  });
  it("keeps Motel Neon", () =>
    expect(ORIGINALS.some((d) => d.direction.name === "Motel Neon")).toBe(true));
});

import { ORIGINALS as O2 } from "@/lib/gallery";
import { normalizeTokens as norm, buildPrescription as rx, tokensCss as css } from "@/lib/design";
import { applySkin, SKINS, hexToOklch } from "@/lib/skins";

describe("original effects: frosted glass, glow, second colour", () => {
  it("carries every original Direction's effects into its design values", () => {
    for (const { id, extras, direction } of O2) {
      expect(direction.tokens.card, id).toBe(extras?.finish === "glass" ? "glass" : undefined);
      expect(direction.tokens.buttonFinish, id).toBe(
        extras?.buttonFinish === "gloss" || extras?.buttonFinish === "glow"
          ? extras.buttonFinish
          : undefined,
      );
      expect(direction.tokens.accent2, id).toBe(extras?.accent2 ?? undefined);
    }
  });
  it("drops invalid effect values and leaves plain designs unchanged", () => {
    const t = norm({ accent2: "red", card: "frosty", buttonFinish: "sparkle" });
    expect("accent2" in t || "card" in t || "buttonFinish" in t).toBe(false);
  });
  it("writes the effects into the exported values and Prescription", () => {
    const g = O2.find((x) => x.direction.tokens.card === "glass")!;
    expect(css(g.direction.tokens)).toContain("--glass-blur");
    const md = rx({
      brief: "x",
      tool: "Lovable",
      tokens: g.direction.tokens,
      picks: [],
      content: g.content,
    } as never);
    expect(md).toContain("Frosted cards");
    expect(md).not.toContain("no glassmorphism");
  });
  it("Skins move the second colour with the accent and keep the gap between them", () => {
    const g = O2.find((x) => x.direction.tokens.accent2)!;
    const t = applySkin(g.direction.tokens, SKINS[0]!);
    expect(t.accent2).toBeDefined();
    expect(t.accent2).not.toBe(g.direction.tokens.accent2);
    const gap = (a: string, b: string) => ((hexToOklch(b)[2] - hexToOklch(a)[2] + 540) % 360) - 180;
    expect(
      Math.abs(
        gap(t.accent, t.accent2!) - gap(g.direction.tokens.accent, g.direction.tokens.accent2!),
      ),
    ).toBeLessThan(25);
  });
});
