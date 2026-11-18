import { describe, expect, it } from "vitest";
import { allRules } from "../data/rules";
import { neuroLimit, neuroQuestions } from "../data/neuro";
import { scriptedWalks, stateNames, stateSheet } from "../data/states";
import { findPlaceholder, tellRules } from "../data/tells";
import { briefLimit, validateBrief } from "../data/brief";
import { validateRules } from "../schemas";

const realBrief = () => ({
  businessName: "Alder Pottery",
  description: "A neighborhood pottery studio teaching wheel and hand-building classes.",
  audience: "Adults learning ceramics for the first time.",
  mainJob: "Find an introductory class and reserve a seat.",
  headline: "Make your first bowl, one turn at a time.",
  features: [
    { title: "Wheel classes", description: "Learn how to center clay and shape a bowl." },
    { title: "Open studio", description: "Practice with access to studio tools." },
    { title: "Hand-building", description: "Build cups and vessels without a wheel." },
  ],
  contact: { email: "classes@alderpottery.test" },
  proof: [
    {
      kind: "number",
      content: "A maximum of eight students in each class.",
      attribution: "Alder Pottery class policy",
      source: "Owner-provided class schedule, reviewed 2026-11-18.",
    },
  ],
  voice: { formality: "conversational", energy: "calm", detail: "concise" },
  wordsToAvoid: ["empower your workflow"],
});

describe("rule catalog", () => {
  it("validates every record and keeps floor rules non-overridable", () => {
    expect(() => validateRules(allRules)).not.toThrow();
    expect(new Set(allRules.map((rule) => rule.id)).size).toBe(allRules.length);
    expect(
      allRules.filter((rule) => rule.group === "floor").every((rule) => !rule.overridable),
    ).toBe(true);
  });
  it("keeps subjective tells optional and gives every rule an honest source", () => {
    expect(tellRules.every((rule) => rule.overridable && rule.evidence === "expert-opinion")).toBe(
      true,
    );
    expect(allRules.every((rule) => rule.sources.length > 0)).toBe(true);
    for (const rule of allRules) {
      if (rule.sources.every((source) => source.basis === "builder"))
        expect(rule.evidence).toBe("expert-opinion");
    }
  });
  it("requires temporal and task-dependent floors to remain person checks", () => {
    for (const id of [
      "floor-flashing",
      "floor-motion-control",
      "floor-task-time",
      "floor-text-spacing",
      "floor-reduced-motion",
      "floor-keyboard-task",
      "floor-zoom-content",
    ]) {
      expect(allRules.find((rule) => rule.id === id)?.check.kind).toBe("person");
    }
  });
  it("offers four single-axis questions with explained choices", () => {
    expect(neuroQuestions).toHaveLength(4);
    for (const question of neuroQuestions) {
      expect(question.variable.length).toBeGreaterThan(0);
      expect(question.choices.length).toBeGreaterThanOrEqual(3);
      expect(question.choices.length).toBeLessThanOrEqual(4);
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(
        question.choices.length,
      );
      expect(question.choices.every((choice) => choice.what && choice.when && choice.watch)).toBe(
        true,
      );
    }
    expect(neuroLimit).toContain("do not show");
  });
  it("covers each part and state without pretending passive parts are interactive", () => {
    expect(Object.keys(stateSheet)).toHaveLength(14);
    for (const states of Object.values(stateSheet))
      expect(states.map((state) => state.state)).toEqual([...stateNames]);
    expect(
      stateSheet.card.find((state) => state.state === "keyboard-focus")?.requiredWhen,
    ).toContain("actual links");
    expect(stateSheet.notice.find((state) => state.state === "pressed")?.requiredWhen).toContain(
      "Not normally applicable",
    );
  });
  it("ties driver-neutral walks to catalog rules with explicit setup", () => {
    expect(scriptedWalks).toHaveLength(4);
    for (const walk of scriptedWalks) {
      expect(allRules.some((rule) => rule.id === walk.ruleId)).toBe(true);
      expect(walk.setup.length).toBeGreaterThan(20);
      expect(walk.steps.some((step) => step.action === "press")).toBe(true);
    }
  });
});

describe("owner content validation", () => {
  it("accepts structured content while making no truth-verification claim", () => {
    expect(validateBrief(realBrief()).valid).toBe(true);
    expect(briefLimit).toContain("A person must verify");
  });
  it("reports the exact nested field holding a placeholder", () => {
    const brief = realBrief();
    brief.features[1]!.description = "Empower your workflow with our studio.";
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (issue) =>
          issue.field === "features.1.description" && issue.message.includes("placeholder"),
      ),
    ).toBe(true);
  });
  it("normalizes case and spacing before placeholder detection", () => {
    expect(findPlaceholder("  YOUR   TAGLINE HERE  ")).toBe("your tagline here");
    expect(findPlaceholder("Individual ceramics lessons")).toBeUndefined();
  });
  it("allows real sentences containing company or business while rejecting standalone template labels", () => {
    for (const headline of ["Signs for your company van", "Classes to grow your business"]) {
      expect(findPlaceholder(headline)).toBeUndefined();
      expect(validateBrief({ ...realBrief(), headline }).valid).toBe(true);
    }
    for (const headline of [
      "Your company",
      "Your business.",
      "[Your company name here]",
      "Your business here",
    ]) {
      expect(findPlaceholder(headline)).toBeDefined();
      expect(validateBrief({ ...realBrief(), headline }).valid).toBe(false);
    }
    expect(findPlaceholder("Replace this with your tagline here")).toBe("your tagline here");
  });
  it("rejects empty content, fewer than three services, and empty contact details", () => {
    expect(validateBrief({}).valid).toBe(false);
    expect(
      validateBrief({ ...realBrief(), features: realBrief().features.slice(0, 2) }).valid,
    ).toBe(false);
    expect(validateBrief({ ...realBrief(), contact: {} }).valid).toBe(false);
  });
  it("rejects example contact details, invalid voice choices, and missing proof", () => {
    expect(validateBrief({ ...realBrief(), contact: { email: "hello@example.com" } }).valid).toBe(
      false,
    );
    expect(validateBrief({ ...realBrief(), voice: { formality: "anything" } }).valid).toBe(false);
    expect(validateBrief({ ...realBrief(), proof: [] }).valid).toBe(false);
  });
  it("allows an intentional words-to-avoid list containing placeholder phrases", () => {
    expect(validateBrief(realBrief()).valid).toBe(true);
  });
});
