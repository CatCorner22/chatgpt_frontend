import { describe, expect, it } from "vitest";
import { validateRules, findingSchema, tokensSchema } from "../schemas";
import { designId } from "../logic/design-id";
import { grade } from "../logic/grade";
import { repairPlan } from "../logic/repair-plan";
import { receipt } from "../logic/receipt";
import { comparePixels, compareTokens } from "../logic/fit";
import { contrastRatio } from "../logic/contrast";
import { validateDuel, preferences } from "../logic/duels";
import { scoreBlindTest, type BlindAnswer } from "../blind-test/score";
import type { RuleRecord, Finding } from "../types";

const rule = (id: string, group: RuleRecord["group"] = "craft"): RuleRecord => ({
  id,
  group,
  plain: "Make the control visible.",
  why: "People need to find it.",
  check: { kind: "page-check", fn: "checkControl" },
  overridable: group !== "floor",
  evidence: "expert-opinion",
  sources: [{ title: "Builder judgement", basis: "builder" }],
  reviewed: "2026-11-18",
});
const finding = (
  ruleId: string,
  status: Finding["status"] = "holds",
  where = "#control",
): Finding => ({
  ruleId,
  status,
  where,
  measured: status === "fails" ? "20px" : "44px",
  required: "24px",
  fix: "Increase the target size.",
});
const rules = [rule("target", "floor"), rule("spacing")];

describe("records", () => {
  it("validates records and rejects duplicate IDs", () => {
    expect(validateRules(rules)).toEqual(rules);
    expect(validateRules([])).toEqual([]);
    expect(() => validateRules([rule("same"), rule("same")])).toThrow("Duplicate");
  });
  it("rejects overridable floors and unsupported evidence claims", () => {
    expect(() => validateRules([{ ...rule("target", "floor"), overridable: true }])).toThrow();
    expect(() => validateRules([{ ...rule("target"), evidence: "measured" }])).toThrow();
    expect(() => validateRules([{ ...rule("target"), reviewed: "2026-02-30" }])).toThrow();
  });
  it("validates findings and CSS token records", () => {
    expect(findingSchema.safeParse(finding("target")).success).toBe(true);
    expect(findingSchema.safeParse({ ruleId: "target", status: "passed" }).success).toBe(false);
    expect(tokensSchema.safeParse({ "--space": "16px" }).success).toBe(true);
    expect(tokensSchema.safeParse({ space: "16px" }).success).toBe(false);
    expect(tokensSchema.safeParse({ "--space": "" }).success).toBe(false);
  });
});

describe("stable labels", () => {
  it("ignores insertion order, trims values, and responds to a changed value", () => {
    expect(designId({ "--size": "16px", "--ink": "#111" })).toBe(
      designId({ "--ink": "#111", "--size": " 16px " }),
    );
    expect(designId({ "--size": "16px" })).not.toBe(designId({ "--size": "17px" }));
    expect(designId({})).toMatch(/^d-[0-9a-f]{16}$/);
  });
  it("rejects malformed tokens instead of silently changing them", () => {
    expect(() => designId(null)).toThrow();
    expect(() => designId({ "--size": 16 })).toThrow();
    expect(() => designId({ color: "#000" })).toThrow();
  });
});

describe("evidence grades", () => {
  it("never awards a floor to empty, omitted, or unknown evidence", () => {
    expect(grade([]).label).toBeNull();
    expect(grade([], rules).label).toBeNull();
    expect(grade([finding("target", "could-not-measure")], rules).label).toBeNull();
    expect(grade([finding("spacing")], rules).label).toBeNull();
  });
  it("any floor failure wins, even alongside a hold for another element", () => {
    expect(
      grade([finding("target"), finding("target", "fails", "#other"), finding("spacing")], rules)
        .label,
    ).toBe("Below floor");
  });
  it("separates a measured floor from complete craft evidence", () => {
    expect(grade([finding("target")], rules)).toMatchObject({
      label: "Meets floor",
      complete: false,
    });
    expect(grade([finding("target"), finding("spacing", "fails")], rules).label).toBe(
      "Meets floor",
    );
    expect(grade([finding("target"), finding("spacing")], rules)).toMatchObject({
      label: "Crafted",
      complete: true,
    });
  });
  it("does not call craft complete while a measured behavior check fails", () => {
    expect(
      grade(
        [finding("target"), finding("spacing"), finding("keyboard", "fails")],
        [...rules, rule("keyboard", "behavior")],
      ).label,
    ).toBe("Meets floor");
  });
  it("withholds a passing grade for findings outside the declared rule scope", () => {
    for (const status of ["fails", "holds", "could-not-measure", "not-applicable"] as const) {
      const result = grade(
        [finding("target"), finding("spacing"), finding("made-up-floor", status)],
        rules,
      );
      expect(result.label).toBeNull();
      expect(result.complete).toBe(false);
    }
    expect(grade([finding("target", "fails"), finding("target ", "fails")], rules)).toMatchObject({
      label: "Below floor",
      complete: false,
    });
  });
});

describe("repair rounds", () => {
  it("orders failed floors before token mismatches, craft and warnings", () => {
    const result = repairPlan(
      [
        finding("tell-copy", "fails"),
        finding("spacing", "fails"),
        finding("fit-color", "fails"),
        finding("target", "fails"),
      ],
      [],
      rules,
    );
    expect(result.items.map((item) => item.ruleId)).toEqual([
      "target",
      "fit-color",
      "spacing",
      "tell-copy",
    ]);
  });
  it("only confirms a repair when the same item explicitly holds", () => {
    const previous = [[finding("target", "fails")]];
    expect(repairPlan([], previous, rules).fixed).toEqual([]);
    expect(repairPlan([], previous, rules).remaining[0]?.status).toBe("could-not-measure");
    expect(repairPlan([finding("target", "could-not-measure")], previous, rules).fixed).toEqual([]);
    expect(repairPlan([finding("target", "not-applicable")], previous, rules).fixed).toEqual([]);
    expect(repairPlan([finding("target")], previous, rules).fixed).toHaveLength(1);
    expect(repairPlan([finding("target", "holds", "#different")], previous, rules).fixed).toEqual(
      [],
    );
  });
  it("does not resurrect a previously confirmed repair", () => {
    expect(
      repairPlan([], [[finding("target", "fails")], [finding("target")]], rules).remaining,
    ).toEqual([]);
  });
  it("stops prescribing after three rounds while listing unresolved work", () => {
    const result = repairPlan([finding("target", "fails")], [[], [], []], rules);
    expect(result.stopped).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.remaining).toHaveLength(1);
    expect(repairPlan([], []).remaining).toEqual([]);
  });
  it("does not confirm a repair when the same round has conflicting evidence at that location", () => {
    for (const adverse of ["fails", "could-not-measure"] as const) {
      for (const current of [
        [finding("target", adverse), finding("target")],
        [finding("target"), finding("target", adverse)],
      ]) {
        const result = repairPlan(current, [[finding("target", "fails")]], rules);
        expect(result.fixed).toEqual([]);
        expect(result.remaining).toHaveLength(1);
        expect(result.remaining[0]?.status).toBe(adverse);
      }
    }
  });
  it("retains conflicting historical failures and reports each confirmed repair once", () => {
    expect(
      repairPlan([], [[finding("target", "fails"), finding("target")]], rules).remaining,
    ).toHaveLength(1);
    expect(
      repairPlan([finding("target"), finding("target")], [[finding("target", "fails")]], rules)
        .fixed,
    ).toHaveLength(1);
  });
});

describe("receipt separation", () => {
  it("keeps facts, gaps and human checks separate and includes checks not run", () => {
    const personRule: RuleRecord = {
      ...rule("read-aloud"),
      check: { kind: "person", ask: "Ask a person to read this." },
    };
    const report = receipt(
      [finding("target"), finding("custom", "could-not-measure")],
      [...rules, personRule],
    );
    expect(report.measured).toHaveLength(1);
    expect(report.couldNotMeasure.map((item) => item.ruleId)).toEqual(["custom", "spacing"]);
    expect(report.personChecks).toContain("Ask a person to read this.");
    expect(report.personChecks).toHaveLength(5);
    expect(receipt([]).personChecks).toHaveLength(4);
  });
});

describe("fit measurements", () => {
  it("normalizes safe color equivalences but discloses unobserved values", () => {
    const result = compareTokens({ "--ink": "#fff", "--space": "16px" }, [
      { property: "color", value: "rgb(255, 255, 255)" },
      { property: "gap", value: "20px", where: "#grid" },
    ]);
    expect(result.mismatches).toEqual([{ property: "gap", value: "20px", where: "#grid" }]);
    expect(result.unobservedTokens).toEqual([{ token: "--space", value: "16px" }]);
    expect(compareTokens({}, []).mismatches).toEqual([]);
  });
  it("reports RGBA channel means and the share beyond the stated threshold", () => {
    expect(
      comparePixels([0, 20, 40, 255, 0, 0, 0, 255], [10, 40, 70, 255, 0, 0, 0, 255]),
    ).toMatchObject({
      meanDifferencePerChannel: [5, 10, 15, 0],
      clearlyDifferentShare: 0.5,
      pixels: 2,
    });
    expect(comparePixels([], [])).toMatchObject({
      meanDifferencePerChannel: [0, 0, 0, 0],
      pixels: 0,
    });
    expect(comparePixels([0, 0, 0, 0], [16, 0, 0, 0]).clearlyDifferentShare).toBe(0);
  });
  it("rejects invalid image input and thresholds", () => {
    expect(() => comparePixels([0], [0])).toThrow();
    expect(() => comparePixels([], [0, 0, 0, 0])).toThrow();
    expect(() => comparePixels([256, 0, 0, 0], [0, 0, 0, 0])).toThrow();
    expect(() => comparePixels([NaN, 0, 0, 0], [0, 0, 0, 0])).toThrow();
    expect(() => comparePixels([], [], -1)).toThrow();
  });
  it("uses full precision for contrast thresholds", () => {
    expect(contrastRatio("#000", "#fff")).toBe(21);
    expect(contrastRatio("#777", "#fff")).toBeLessThan(4.5);
    expect(contrastRatio("#111", "#111")).toBe(1);
    expect(() => contrastRatio("transparent", "#fff")).toThrow();
  });
});

describe("preference comparisons", () => {
  const a = { type: "serif", space: "airy" };
  const b = { type: "sans", space: "airy" };
  it("requires exactly one changed decision and matching key sets", () => {
    expect(validateDuel(a, b)).toMatchObject({ valid: true, decision: "type" });
    expect(validateDuel(a, a).valid).toBe(false);
    expect(validateDuel(a, { type: "sans", space: "compact" }).valid).toBe(false);
    expect(validateDuel(a, { type: "serif" }).valid).toBe(false);
    expect(validateDuel({}, {}).valid).toBe(false);
  });
  it("retains counts and ties without inventing a winner", () => {
    const result = preferences([
      { a, b, choice: "a" },
      { a, b, choice: "tie" },
    ]);
    expect(result[0]).toMatchObject({ decision: "type", comparisons: 2, ties: 1 });
    expect(result[0]?.choices.find((choice) => choice.value === "serif")).toMatchObject({
      wins: 1,
      exposures: 2,
      decisiveExposures: 1,
      winRate: 1,
    });
    expect(preferences([{ a, b, choice: "tie" }])[0]?.choices[0]?.winRate).toBeNull();
    expect(preferences([])).toEqual([]);
    expect(() => preferences([{ a, b: a, choice: "a" }])).toThrow();
  });
});

describe("blinded review statistics", () => {
  const answer = (
    reviewerId: string,
    group: BlindAnswer["group"],
    judgedHuman = true,
  ): BlindAnswer => ({ reviewerId, pageId: group + "-page", group, judgedHuman, quality: 5 });
  it("reports missing groups and never treats a null result as equivalence", () => {
    expect(scoreBlindTest([]).groups.spec.shareJudgedHuman).toBeNull();
    expect(scoreBlindTest([]).comparison.differs).toBeNull();
    const report = scoreBlindTest([answer("one", "spec"), answer("one", "human")]);
    expect(report.comparison.differs).toBe(false);
    expect(report.statement).toContain("not evidence");
  });
  it("counts people rather than repeated ratings as independent samples", () => {
    const report = scoreBlindTest([
      answer("one", "spec"),
      { ...answer("one", "spec"), pageId: "another-page" },
      answer("one", "human"),
    ]);
    expect(report.groups.spec.total).toBe(2);
    expect(report.groups.spec.reviewers).toBe(1);
    expect(report.comparison.pairedReviewers).toBe(1);
    expect(report.groups.spec.reviewerInterval95).toEqual([0, 1]);
  });
  it("rejects repeated ratings, invalid quality, and inconsistent group assignments", () => {
    expect(() => scoreBlindTest([answer("one", "spec"), answer("one", "spec")])).toThrow("once");
    expect(() => scoreBlindTest([{ ...answer("one", "spec"), quality: 8 }])).toThrow();
    expect(() =>
      scoreBlindTest([answer("one", "spec"), { ...answer("two", "human"), pageId: "spec-page" }]),
    ).toThrow("both groups");
  });
  it("reports a clear paired difference when bounded evidence supports one", () => {
    const answers = Array.from({ length: 50 }, (_, index) => [
      answer(`person-${index}`, "spec", false),
      answer(`person-${index}`, "human"),
    ]).flat();
    const report = scoreBlindTest(answers);
    expect(report.comparison.difference).toBe(-1);
    expect(report.comparison.differs).toBe(true);
    expect(report.groups.human.meanQuality).toBe(5);
  });
});
