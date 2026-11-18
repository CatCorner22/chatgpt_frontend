import { describe, expect, it } from "vitest";
import { SKINS, applySkin, hexToOklch, oklchToHex } from "@/lib/skins";
import { contrastNotes } from "@/lib/design";
import { GALLERY } from "@/lib/gallery";

describe("skins", () => {
  it("has the owner's 12 skins", () => expect(SKINS).toHaveLength(12));
  it("round-trips colours", () => expect(oklchToHex(hexToOklch("#ba86ff"))).toBe("#ba86ff"));
  it("changes only colours and keeps every other decision", () => {
    const g = GALLERY.find((x) => x.id === "galactic-goth")!.direction.tokens;
    const o = applySkin(g, SKINS[0]!);
    const { bg, surface, ink, muted, accent, accentInk, accent2: _x, ...rest } = o;
    const {
      bg: _a,
      surface: _b,
      ink: _c,
      muted: _d,
      accent: _e,
      accentInk: _f,
      accent2: _y,
      ...before
    } = g;
    expect(rest).toEqual(before);
    expect(accent).not.toBe(g.accent);
    expect(Math.abs(hexToOklch(accent)[2] - 245)).toBeLessThan(6);
    expect([bg, surface, ink, muted, accentInk].every(Boolean)).toBe(true);
  });
  it("keeps the page light or dark", () => {
    const g = GALLERY.find((x) => x.id === "galactic-goth")!.direction.tokens;
    expect(Math.abs(hexToOklch(applySkin(g, SKINS[4]!).bg)[0] - hexToOklch(g.bg)[0])).toBeLessThan(
      0.03,
    );
  });
  it("never makes text unreadable on any design with any skin", () => {
    for (const g of GALLERY)
      for (const s of SKINS)
        expect(contrastNotes(applySkin(g.direction.tokens, s)).every((c) => c.ok)).toBe(true);
  });
});

import { hexToOklch as _h, oklchToHex as _o } from "@/lib/skins";
describe("gamut mapping", () => {
  it("keeps hue and lightness when a vivid colour is pulled on-screen", () => {
    const out = _h(_o([0.7, 0.4, 145]));
    expect(Math.abs(out[2] - 145)).toBeLessThan(2);
    expect(Math.abs(out[0] - 0.7)).toBeLessThan(0.01);
  });
});
