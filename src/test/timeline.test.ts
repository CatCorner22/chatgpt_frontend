import { describe, expect, it } from "vitest";
import { scoreTimeline } from "@/lib/watchtower";

describe("score timeline", () => {
  it("keeps valid dated scores and drops broken entries", () => {
    expect(
      scoreTimeline([{ at: "2026-11-01T00:00:00Z", score: 72 }, null, { at: "bad", score: 5 }, { at: "2026-11-08T00:00:00Z", score: 140 }]),
    ).toEqual([
      { at: "2026-11-01T00:00:00Z", score: 72 },
      { at: "2026-11-08T00:00:00Z", score: 100 },
    ]);
  });
});
