import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo, ReverieArt } from "@/components/BrandArt";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { REVERIE } from "@/lib/reverie";
import artwork from "./fixtures/protected-artwork.json";

describe("Reverie and the Garden Path", () => {
  it("lists every approved artwork file once", () => {
    expect(artwork.length).toBeGreaterThanOrEqual(16);
    expect(new Set(artwork.map((item) => item.path)).size).toBe(artwork.length);
  });

  it("introduces Reverie by her approved name and meaning", () => {
    expect(REVERIE).toMatchObject({
      name: "Reverie",
      pronunciation: "REV-uh-ree",
      meaning: "a pleasant daydream",
      introduction:
        "Hello, I'm Reverie. My name means a pleasant daydream. I'll help you turn what you imagine into a thoughtful design, one small step at a time.",
    });
    expect(ONBOARDING_STEPS.find((step) => step.id === "welcome")?.reverie).toBe(
      REVERIE.introduction,
    );
  });

  it.each(artwork)("ships the approved bytes at /$path", ({ path, sha256 }) => {
    const bytes = readFileSync(join("public", path));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
  });

  it.each([
    ["focus", "focus-aim"],
    ["vision", "vision-imagine"],
    ["horizon", "horizon-next"],
    ["telescope", "telescope-explore"],
    ["target", "target-prepare"],
  ] as const)("uses the approved %s wordmark", (variant, file) => {
    const view = render(<BrandLogo variant={variant} />);
    expect(view.getByRole("img", { name: new RegExp(`^${variant}$`, "i") })).toHaveAttribute(
      "src",
      `/brand/${file}.png`,
    );
  });

  it.each(["library", "handoff"] as const)("uses Reverie's approved %s pose", (pose) => {
    const view = render(<ReverieArt pose={pose} />);
    expect(view.getByRole("presentation")).toHaveAttribute("src", `/brand/cat-${pose}.png`);
  });
});
