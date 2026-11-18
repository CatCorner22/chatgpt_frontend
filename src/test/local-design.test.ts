import { describe, expect, it } from "vitest";
import { contrastNotes, normalizeTokens, STEPS } from "../lib/design";
import { GALLERY } from "../lib/gallery";
import { buildLocalOptions, contentFromBrief, createLocalDirections } from "../lib/local-design";

describe("local design creation", () => {
  it("keeps the owner's words and does not borrow testimonials or services", () => {
    const brief = "A ceramics studio in Portland. Wheel classes and small-batch tableware.";
    const result = createLocalDirections(brief, { audience: "", tone: "" }, "Clay House");
    expect(result.content).toEqual({
      brand: "Clay House",
      headline: "A ceramics studio in Portland.",
      sub: brief,
      cta: "Find out more",
      features: [],
      quote: "",
    });
    expect(result.directions).toHaveLength(3);
    expect(
      new Set(result.directions.map((direction) => JSON.stringify(direction.tokens))).size,
    ).toBe(3);
  });

  it("uses actual keyword matches before fallback directions", () => {
    const result = createLocalDirections("A tattoo studio and piercing shop");
    expect(result.directions[0]?.why).toMatch(/Selected from the design library for:/);
  });

  it.each(["", "xqzv unexplained", "A coffee shop", "A software app", "A gothic tattoo studio"])(
    "returns repeatable normalized choices for %j",
    (brief) => {
      const result = createLocalDirections(brief);
      expect(result).toEqual(createLocalDirections(brief));
      expect(result.directions).toHaveLength(3);
      for (const direction of result.directions) {
        expect(direction.tokens).toEqual(normalizeTokens(direction.tokens));
        expect(contrastNotes(direction.tokens).every((check) => check.ok)).toBe(true);
      }
    },
  );

  it("handles blank content as an unfinished draft", () => {
    expect(contentFromBrief(" ")).toMatchObject({
      brand: "Untitled project",
      sub: "",
      features: [],
      quote: "",
    });
  });

  it("does not mutate the authored design library", () => {
    const before = JSON.stringify(GALLERY);
    createLocalDirections("A coffee shop");
    expect(JSON.stringify(GALLERY)).toBe(before);
  });
});

describe("local decisions", () => {
  it.each(STEPS)("changes only fields for $id, with distinct alternatives", (step) => {
    for (const design of GALLERY) {
      const base = design.direction.tokens;
      const options = buildLocalOptions(step.id, base);
      expect(options).toHaveLength(3);
      expect(options[0]?.tokens).toEqual(base);
      expect(new Set(options.map((option) => JSON.stringify(option.tokens))).size).toBe(3);
      for (const option of options) {
        for (const field of Object.keys(base) as (keyof typeof base)[]) {
          if (!step.fields.includes(field)) expect(option.tokens[field]).toEqual(base[field]);
        }
      }
    }
  });

  it("offers readable replacement palettes and button colors", () => {
    const tokens = normalizeTokens({});
    for (const step of ["palette", "accent"]) {
      for (const option of buildLocalOptions(step, tokens).slice(1)) {
        expect(contrastNotes(option.tokens).every((check) => check.ok)).toBe(true);
      }
    }
  });

  it("puts comfortable spacing alternatives first for older adults", () => {
    const options = buildLocalOptions("density", normalizeTokens({ density: "compact" }), {
      audience: "older adults",
      tone: "",
    });
    expect(options[1]?.tokens.density).toBe("airy");
  });

  it("rejects an unknown decision instead of silently changing unrelated tokens", () => {
    expect(() => buildLocalOptions("unknown", normalizeTokens({}))).toThrow("Unknown design step");
  });
});
