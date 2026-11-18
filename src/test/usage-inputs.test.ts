import { describe, expect, it } from "vitest";
import { directionInput, screenshotInput, stepInput, urlInput } from "@/lib/usage-inputs";

describe("expensive request payload protection", () => {
  it("rejects overlong briefs instead of silently accepting paid work", () => {
    expect(directionInput.safeParse({ brief: "x".repeat(2001), purpose: "" }).success).toBe(false);
    expect(directionInput.safeParse({ brief: "x".repeat(2000), purpose: "" }).success).toBe(true);
  });
  it("rejects nested or unbounded token data before prompt serialization", () => {
    const data = {
      brief: "A shop",
      purpose: "",
      stepId: "type",
      history: "",
      tokens: { nested: { secret: "x" } },
    };
    expect(stepInput.safeParse(data).success).toBe(false);
    expect(stepInput.safeParse({ ...data, tokens: { headingFont: "x".repeat(101) } }).success).toBe(
      false,
    );
    expect(stepInput.safeParse({ ...data, tokens: {} }).success).toBe(true);
    expect(
      stepInput.safeParse({
        ...data,
        tokens: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`key${i}`, "x"])),
      }).success,
    ).toBe(false);
  });
  it("rejects oversize screenshot and URL inputs before external calls", () => {
    expect(
      screenshotInput.safeParse({ image: "data:image/png;base64," + "A".repeat(4_000_000) })
        .success,
    ).toBe(false);
    expect(screenshotInput.safeParse({ image: "data:image/svg+xml;base64,AAAA" }).success).toBe(
      false,
    );
    expect(urlInput.safeParse({ url: "x".repeat(501) }).success).toBe(false);
  });
});
