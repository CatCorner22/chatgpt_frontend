import { describe, expect, it } from "vitest";
import { siteBadge, type BadgeCheck } from "@/lib/badge";

const good: BadgeCheck = { stamp: "signed", idMatches: true, score: 92, highFails: 0, matched: 5 };

describe("whole-site badge", () => {
  it("passes only when every page passes", () => {
    const r = siteBadge([
      { url: "https://a.com/", check: good },
      { url: "https://a.com/about", check: good },
    ]);
    expect(r.passing).toBe(true);
    expect(r.reasons[0]?.text).toBe("All 2 pages pass");
  });
  it("one low-scoring page fails the site and is named", () => {
    const r = siteBadge([
      { url: "https://a.com/", check: good },
      { url: "https://a.com/pricing", check: { ...good, score: 70 } },
    ]);
    expect(r.passing).toBe(false);
    expect(r.reasons[0]?.text).toContain("/pricing");
    expect(r.check?.score).toBe(70);
  });
  it("a page with an unsigned code fails the site", () => {
    expect(
      siteBadge([
        { url: "https://a.com/", check: good },
        { url: "https://a.com/x", check: { ...good, stamp: "unsigned" } },
      ]).passing,
    ).toBe(false);
  });
  it("a page with no code at all fails the merged code rule too", () => {
    const r = siteBadge([
      { url: "https://a.com/", check: good },
      { url: "https://a.com/x", check: { ...good, stamp: null } },
    ]);
    expect(r.check?.stamp).toBe(null);
    expect(r.passing).toBe(false);
  });
  it("a page that could not be opened fails the site", () => {
    const r = siteBadge([
      { url: "https://a.com/", check: good },
      { url: "https://a.com/x", check: null, error: "could not be opened" },
    ]);
    expect(r.passing).toBe(false);
    expect(r.reasons[0]?.text).toContain("could not be opened");
  });
});
