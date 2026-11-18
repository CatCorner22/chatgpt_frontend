import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkRegistry, checkImages, checkAutoplay } from "../page-checks";
import { allRules } from "../data/rules";

const good = readFileSync(new URL("../fixtures/good.html", import.meta.url), "utf8");
const flawed = readFileSync(new URL("../fixtures/flawed.html", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../MANIFEST.json", import.meta.url), "utf8")) as {
  rules: { ruleId: string; functionName: string | null; needsRealBrowser: boolean | null }[];
};

describe("fixture and check contracts", () => {
  it("lists every rule once and keeps browser requirements explicit", () => {
    expect(manifest.rules.map((entry) => entry.ruleId).sort()).toEqual(
      allRules.map((rule) => rule.id).sort(),
    );
    for (const entry of checkRegistry) {
      const listed = manifest.rules.find((rule) => rule.ruleId === entry.ruleId);
      expect(listed?.functionName).toBe(entry.run.name);
      expect(listed?.needsRealBrowser).toBe(entry.needsRealBrowser);
    }
  });
  it("registers exactly one implementation per page-check rule", () => {
    const declared = allRules.filter((rule) => rule.check.kind === "page-check");
    expect(new Set(checkRegistry.map((entry) => entry.ruleId)).size).toBe(checkRegistry.length);
    expect(checkRegistry.map((entry) => entry.ruleId).sort()).toEqual(
      declared.map((rule) => rule.id).sort(),
    );
    for (const entry of checkRegistry) {
      const rule = declared.find((rule) => rule.id === entry.ruleId)!;
      expect(rule.check.kind === "page-check" && rule.check.fn).toBe(entry.run.name);
    }
  });

  it("plants a named defect for each check in a complete local fixture", () => {
    for (const entry of checkRegistry) expect(flawed).toContain(`data-defect="${entry.ruleId}"`);
    expect(good).not.toContain("data-defect=");
    for (const html of [good, flawed]) {
      expect(html.toLowerCase()).toContain("<!doctype html>");
      expect(html).not.toMatch(/(?:src|href)=["']https?:/i);
      expect(html).not.toContain("<script");
    }
  });

  it("does not mistake a layout-free parsed page for a rendered page", () => {
    const detached = { defaultView: null } as Document;
    for (const entry of checkRegistry.filter((entry) => entry.needsRealBrowser)) {
      const findings = entry.run(detached);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.every((finding) => finding.status === "could-not-measure")).toBe(true);
    }
  });

  it("does not certify the absence of scripted autoplay from markup", () => {
    const page = { querySelectorAll: () => [] } as unknown as Document;
    expect(checkAutoplay(page)[0]?.status).toBe("could-not-measure");
  });

  it("requires actual intrinsic dimensions and alternative-text metadata", () => {
    const image = (attrs: Record<string, string>) => ({
      id: "image",
      getAttribute: (key: string) => attrs[key] ?? null,
      hasAttribute: (key: string) => key in attrs,
    });
    const page = (attrs: Record<string, string>) =>
      ({ querySelectorAll: () => [image(attrs)] }) as unknown as Document;
    expect(checkImages(page({ width: "64", height: "64", alt: "" }))[0]?.status).toBe("holds");
    expect(checkImages(page({ width: "-1", height: "64", alt: "" }))[0]?.status).toBe("fails");
    expect(checkImages(page({ width: "64", height: "64" }))[0]?.status).toBe("fails");
  });
});
