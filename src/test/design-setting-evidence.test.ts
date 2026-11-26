import { expect, it } from "vitest";
import { buildPrescription, normalizeTokens } from "@/lib/design";
import { measuredChecks, qualityGrade } from "@/lib/engine";

it("identifies estimates, guidelines and color calculations in the customer handoff", () => {
  const tokens = normalizeTokens({ buttonStyle: "underline" });
  const checks = measuredChecks(tokens);
  const markdown = buildPrescription({
    brief: "Compare classes",
    direction: "Editorial",
    content: {
      brand: "Kiln",
      headline: "Choose a class",
      sub: "",
      cta: "",
      features: [],
      quote: "",
    },
    tokens,
    checks,
    picks: [],
    tool: "Human developer",
  });
  expect(checks.find((check) => check.name === "Line length")?.ok).toBeNull();
  const section = markdown.split("## Design setting checks")[1]?.split("\n## ")[0];
  expect(section).toMatch(/Main button height: .*Layout estimate; verify in rendered page/);
  expect(section).toMatch(/Line length: .*Reading guideline; verify in rendered page/);
  expect(section).toMatch(/Text contrast: .*Calculated color ratio/);
  expect(section).toMatch(/Clear text levels: .*Type scale guideline/);
  expect(section).toMatch(/Uppercase headings: .*Case guideline/);
  expect(markdown).not.toContain("## Measured checks");
  expect(qualityGrade(checks).missing).not.toContain("Main button height");
  expect(qualityGrade(checks.filter((check) => check.basis === "Layout estimate")).name).toBe(
    "Awaiting checks",
  );
  expect(qualityGrade([]).name).toBe("Awaiting checks");
  expect(qualityGrade(measuredChecks(normalizeTokens({}))).summary).toMatch(/rendered|page/);
});
