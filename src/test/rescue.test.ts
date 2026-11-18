import { describe, it, expect } from "vitest";
import { rescueSource, rescueStudio, rescueBrief, rescueDirections } from "@/lib/rescue";
import { normalizeTokens, contrast } from "@/lib/design";
import { appRules, signalText } from "@/lib/appDesign";

describe("Rescue content and hand-off", () => {
  it.each(["website", "app"] as const)(
    "matches three local %s looks without replacing source content",
    (experience) => {
      const source = rescueSource(
        "<title>Real Ceramics</title><h1>Our pottery classes</h1><p>Our exact words.</p><h2>Wheel classes</h2>",
        "https://example.com",
      );
      const before = structuredClone(source);
      const directions = rescueDirections(source, experience);
      expect(directions).toHaveLength(3);
      expect(new Set(directions.map((direction) => JSON.stringify(direction.tokens))).size).toBe(3);
      expect(source).toEqual(before);
      for (const direction of directions) {
        expect(rescueStudio(source, direction, experience).content).toEqual(before.content);
        expect(contrast(direction.tokens.ink, direction.tokens.bg)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
  it("retains original public copy, excludes scripts and never invents testimonials", () => {
    const source = rescueSource(
      "<title>Real &amp; Co</title><h1>Book a real class</h1><p>Our original words.</p><h2>Wheel classes</h2><button>Book now</button><script>secret fake claim</script>",
      "https://example.com/classes",
    );
    expect(source.content).toEqual({
      brand: "Real & Co",
      headline: "Book a real class",
      sub: "Our original words.",
      features: [{ title: "Wheel classes", body: "" }],
      cta: "Book now",
      quote: "",
    });
    expect(source.excerpt).not.toContain("secret fake claim");
  });
  it("caps extracted content and marks the redesign as an unsaved, independent Prescription", () => {
    const source = rescueSource(`<p>${"x".repeat(9000)}</p>`, "https://example.com");
    expect(source.excerpt.length).toBe(6000);
    expect(source.content.sub.length).toBe(1000);
    const s = rescueStudio(source, { name: "New", tokens: normalizeTokens({}) }, "app");
    expect(s.stage).toBe("rx");
    expect(s.projectId).toBeNull();
    expect(s.savedHash).toBeNull();
    expect(s.purpose.experience).toBe("app");
    expect(s.integration).toBe("existing");
    expect(s.aiCalls).toBe(0);
    expect(s.content).toEqual(source.content);
    expect(rescueBrief(source, "app")).toContain(
      "Preserve all existing content, routes, records, validation and working behavior",
    );
  });
});
describe("App and accent rules", () => {
  it("provides app interaction rules only for apps", () => {
    expect(appRules("website")).toBe("");
    expect(appRules("app")).toContain("Tables:");
    expect(appRules("app")).toContain("empty, loading, error, success and disabled");
  });
  it("keeps the chosen filled accent but derives 4.5:1 text against both grounds", () => {
    const t = normalizeTokens({
      bg: "#000000",
      surface: "#ffffff",
      ink: "#ffffff",
      accent: "#660000",
    });
    expect(t.accent).toBe("#660000");
    expect(contrast(signalText(t), t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signalText(t, t.surface), t.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
