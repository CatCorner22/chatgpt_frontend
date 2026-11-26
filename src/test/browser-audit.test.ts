import { describe, expect, it } from "vitest";
import {
  auditScreenshotName,
  MAX_BROWSER_AUDIT_BYTES,
  parseBrowserAudit,
  phoneLabObservations,
} from "@/lib/browser-audit";

const example = () => ({
  kind: "north-star-browser-audit",
  version: 1,
  target: "http://localhost:3000",
  startedAt: "2026-11-18T12:00:00.000Z",
  scenarios: [
    {
      id: "mobile",
      label: "Mobile",
      viewport: { width: 320, height: 800 },
      preferences: { reducedMotion: "reduce", forcedColors: "none" },
      findings: [
        { ruleId: "floor-reflow", status: "fails", measured: "480px at 320px" },
        { ruleId: "browser-motion", status: "could-not-measure" },
      ],
      observations: {
        layout: { viewportWidth: 320, documentWidth: 480 },
        actions: { results: [], complete: false },
      },
      screenshots: { fullPage: "screenshots/mobile.png" },
    },
  ],
  summary: { failureCount: 0, unknownCount: 0, scenarioCount: 0 },
  limitations: ["Keyboard flows need scripted actions."],
});

describe("imported browser audit data", () => {
  it("validates the report and recomputes dishonest totals", () => {
    const report = parseBrowserAudit(JSON.stringify(example()));
    expect(report.summary).toEqual({ failureCount: 1, unknownCount: 1, scenarioCount: 1 });
    expect(report.scenarios[0]?.observations).toHaveProperty("layout");
  });
  it("retains bounded entry HTML identity when supplied and reads legacy receipts", () => {
    expect(parseBrowserAudit(JSON.stringify(example())).entryHtml).toBeUndefined();
    const entry = { bytes: 200, sha256: "c".repeat(64) };
    expect(parseBrowserAudit(JSON.stringify({ ...example(), entryHtml: entry })).entryHtml).toEqual(
      entry,
    );
    expect(() =>
      parseBrowserAudit(
        JSON.stringify({ ...example(), entryHtml: { ...entry, bytes: 20_000_000 } }),
      ),
    ).toThrow("entryHtml.bytes");
    expect(() =>
      parseBrowserAudit(
        JSON.stringify({ ...example(), entryHtml: { ...entry, sha256: "file name" } }),
      ),
    ).toThrow("entryHtml.sha256");
  });
  it("omits absent or malformed optional phone timing details", () => {
    const scenario = parseBrowserAudit(JSON.stringify(example())).scenarios[0]!;
    expect(phoneLabObservations(scenario)).toBeNull();
    expect(
      phoneLabObservations({
        ...scenario,
        observations: { mobileTiming: { profile: { latencyMs: "bad" } } },
      }),
    ).toBeNull();
  });
  it("rejects malformed JSON, the wrong format and invalid finding statuses", () => {
    expect(() => parseBrowserAudit("{")).toThrow("not valid JSON");
    expect(() =>
      parseBrowserAudit(JSON.stringify({ ...example(), kind: "arbitrary-file" })),
    ).toThrow("supported browser audit");
    const report = example();
    report.scenarios[0]!.findings[0]!.status = "verified";
    expect(() => parseBrowserAudit(JSON.stringify(report))).toThrow(
      "scenarios.0.findings.0.status",
    );
  });
  it("bounds bytes and array lengths and rejects duplicate scenario IDs", () => {
    expect(() => parseBrowserAudit(" ".repeat(MAX_BROWSER_AUDIT_BYTES + 1))).toThrow("5 MB");
    const report = example();
    report.scenarios.push(report.scenarios[0]!);
    expect(() => parseBrowserAudit(JSON.stringify(report))).toThrow("scenarios");
    const oversized = example();
    oversized.scenarios[0]!.findings = Array.from({ length: 1001 }, () => ({
      ruleId: "x",
      status: "holds",
    }));
    expect(() => parseBrowserAudit(JSON.stringify(oversized))).toThrow("findings");
  });
  it("rejects invalid dates and impossible viewport measurements", () => {
    expect(() =>
      parseBrowserAudit(JSON.stringify({ ...example(), startedAt: "yesterday" })),
    ).toThrow("startedAt");
    const report = example();
    report.scenarios[0]!.viewport.width = -1;
    expect(() => parseBrowserAudit(JSON.stringify(report))).toThrow("viewport.width");
  });
  it("keeps screenshot paths as plain filenames, including untrusted remote inputs", () => {
    expect(auditScreenshotName(undefined)).toBe("Not captured");
    expect(auditScreenshotName("screenshots/mobile.png")).toBe("mobile.png");
    expect(auditScreenshotName("https://example.invalid/hidden.png?token=private")).toBe(
      "hidden.png",
    );
    expect(auditScreenshotName("C:\\audit\\mobile.png")).toBe("mobile.png");
  });
});
