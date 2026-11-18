import { describe, expect, it } from "vitest";
import { addRun, clientReport, parseHistory, scoreChange } from "@/lib/report";

const run = (host: string, score: number, at = "2026-11-17") => ({ host, score, fails: 0, at });

describe("critic score history", () => {
  it("ignores corrupt saved history", () => {
    expect(parseHistory("not json")).toEqual([]);
    expect(parseHistory('{"a":1}')).toEqual([]);
    expect(parseHistory('[{"host":"a.com"},{"host":"b.com","score":70,"at":"x"}]')).toHaveLength(1);
  });
  it("keeps at most 10 runs per site and leaves other sites alone", () => {
    let l = [run("other.com", 50)];
    for (let i = 0; i < 12; i++) l = addRun(l, run("a.com", i));
    expect(l.filter((e) => e.host === "a.com").map((e) => e.score)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(l.filter((e) => e.host === "other.com")).toHaveLength(1);
  });
  it("reports before/after only when a site was reviewed before", () => {
    expect(scoreChange([run("a.com", 60)], "a.com")).toBeNull();
    expect(scoreChange([run("a.com", 60), run("b.com", 10), run("a.com", 82)], "a.com")).toEqual({
      before: 60,
      after: 82,
      delta: 22,
    });
  });
});

describe("client report", () => {
  it("includes score, change, every failing fix and the repair brief", () => {
    const md = clientReport({
      host: "a.com",
      title: "",
      score: 71,
      date: "2026-11-17",
      brief: "FIX THESE",
      findings: [
        { area: "Contrast", detail: "2.1:1", fix: "Darken text", ok: false },
        { area: "Fonts", detail: "2", fix: "", ok: true },
      ],
      change: { before: 60, after: 71, delta: 11 },
    });
    expect(md).toContain("71 / 100");
    expect(md).toContain("60 → 71 (+11)");
    expect(md).toContain("Darken text");
    expect(md).toContain("FIX THESE");
    expect(md).toContain("Measured issues (1)");
  });
});
