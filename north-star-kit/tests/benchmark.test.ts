import { describe, expect, it } from "vitest";
import {
  benchmarkManifestSchema,
  createBenchmarkPlan,
  createReviewerPacket,
  type BenchmarkManifest,
} from "../blind-test/benchmark";
import {
  blindEvaluationBundleSchema,
  reviewerPacketSchema,
  type BlindEvaluation,
} from "../blind-test/reviewer";
import { evaluateBenchmark } from "../blind-test/evaluate";

// Synthetic test records below verify calculations. They are never study evidence.
function manifest(targetReviewers = 30): BenchmarkManifest {
  const draft = createBenchmarkPlan();
  return {
    ...draft,
    status: "registered",
    registration: { recordedAt: "2026-11-18T00:00:00Z", reference: "Synthetic test registration" },
    tasks: draft.tasks.slice(0, 1),
    criteria: { ...draft.criteria, targetReviewers, minimumHumanCreators: 1 },
    samples: [
      {
        id: "opaque-a",
        taskId: "service-booking",
        assetRef: "sample-a.html",
        kind: "interactive",
        group: "spec",
        creatorCode: "builder-a",
        provenance: "Synthetic test candidate",
        artifactSha256: "a".repeat(64),
      },
      {
        id: "opaque-b",
        taskId: "service-booking",
        assetRef: "sample-b.html",
        kind: "interactive",
        group: "human",
        creatorCode: "builder-b",
        provenance: "Synthetic test reference",
        artifactSha256: "b".repeat(64),
      },
    ],
  };
}
function answer(reviewerCode: string, sampleId: string, score = 6): BlindEvaluation {
  return {
    benchmarkId: "frontend-benchmark-v1",
    reviewerCode,
    sampleId,
    taskOutcome: "completed",
    judgedOrigin: "person",
    note: "",
    quality: {
      hierarchy: score,
      typography: score,
      composition: score,
      distinctiveness: score,
      interaction: score,
      content: score,
    },
  };
}
const panel = (count: number, candidate = 6, reference = 6) =>
  Array.from({ length: count }, (_, index) => [
    answer(`test-${index}`, "opaque-a", candidate),
    answer(`test-${index}`, "opaque-b", reference),
  ]).flat();

describe("benchmark protocol and masked collection", () => {
  it("starts as a varied draft with no invented references or answers", () => {
    const plan = createBenchmarkPlan();
    expect(plan.status).toBe("draft");
    expect(plan.tasks).toHaveLength(6);
    expect(new Set(plan.tasks.map((task) => task.family)).size).toBe(6);
    expect(plan.samples).toEqual([]);
    expect(evaluateBenchmark(plan, []).state).toBe("not-ready");
  });
  it("strips organizer-only labels, provenance, creator codes and hashes", () => {
    const packet = createReviewerPacket(manifest(), ["opaque-b", "opaque-a"]);
    expect(packet.samples.map((sample) => sample.id)).toEqual(["opaque-b", "opaque-a"]);
    expect(packet.samples.map((sample) => sample.label)).toEqual(["Sample 1", "Sample 2"]);
    const text = JSON.stringify(packet);
    for (const key of [
      '"group"',
      '"creatorCode"',
      '"provenance"',
      '"artifactSha256"',
      '"criteria"',
      '"registration"',
    ])
      expect(text).not.toContain(key);
    expect(() => createReviewerPacket(manifest(), ["opaque-a", "opaque-a"])).toThrow();
    expect(() => createReviewerPacket(manifest(), ["opaque-a"])).toThrow();
  });
  it("rejects hidden organizer labels accidentally inserted into reviewer samples", () => {
    const packet = createReviewerPacket(manifest(), ["opaque-a", "opaque-b"]);
    expect(
      reviewerPacketSchema.safeParse({
        ...packet,
        samples: [{ ...packet.samples[0], group: "human" }, packet.samples[1]],
      }).success,
    ).toBe(false);
    expect(
      reviewerPacketSchema.safeParse({
        ...packet,
        samples: [{ ...packet.samples[0], assetRef: "/human-reference.html" }, packet.samples[1]],
      }).success,
    ).toBe(false);
    expect(
      reviewerPacketSchema.safeParse({
        ...packet,
        samples: [{ ...packet.samples[0], assetRef: "/%68uman-reference.html" }, packet.samples[1]],
      }).success,
    ).toBe(false);
  });
  it("requires frozen matched artifacts and independent creator coverage for registration", () => {
    const valid = manifest();
    expect(benchmarkManifestSchema.safeParse(valid).success).toBe(true);
    expect(benchmarkManifestSchema.safeParse({ ...valid, registration: undefined }).success).toBe(
      false,
    );
    expect(
      benchmarkManifestSchema.safeParse({ ...valid, samples: valid.samples.slice(0, 1) }).success,
    ).toBe(false);
    expect(
      benchmarkManifestSchema.safeParse({
        ...valid,
        samples: valid.samples.map((sample) => ({ ...sample, artifactSha256: undefined })),
      }).success,
    ).toBe(false);
    expect(
      benchmarkManifestSchema.safeParse({
        ...valid,
        criteria: { ...valid.criteria, minimumHumanCreators: 2 },
      }).success,
    ).toBe(false);
    expect(
      benchmarkManifestSchema.safeParse({
        ...valid,
        samples: valid.samples.map((sample) => ({ ...sample, artifactSha256: "a".repeat(64) })),
      }).success,
    ).toBe(false);
    expect(
      benchmarkManifestSchema.safeParse({
        ...valid,
        samples: valid.samples.map((sample) => ({ ...sample, creatorCode: "same-creator" })),
      }).success,
    ).toBe(false);
  });
  it("validates a portable answer bundle without accepting foreign or duplicate answers", () => {
    const bundle = { version: 1, benchmarkId: "frontend-benchmark-v1", evaluations: panel(1) };
    expect(blindEvaluationBundleSchema.safeParse(bundle).success).toBe(true);
    expect(
      blindEvaluationBundleSchema.safeParse({
        ...bundle,
        evaluations: [...bundle.evaluations, bundle.evaluations[0]],
      }).success,
    ).toBe(false);
    expect(
      blindEvaluationBundleSchema.safeParse({ ...bundle, benchmarkId: "different" }).success,
    ).toBe(false);
  });
});

describe("bounded reviewer-level evidence", () => {
  it("makes a completed pilot inconclusive rather than claiming equality or poor quality", () => {
    const result = evaluateBenchmark(manifest(), panel(30));
    expect(result.state).toBe("inconclusive");
    expect(result.counts.completeReviewers).toBe(30);
    expect(result.metrics).toHaveLength(15);
    expect(result.metrics[0]?.reviewers).toBe(30);
    expect(result.statement).toContain("not a finding that the design is poor");
  });
  it("cannot confirm with missing reviewers, incomplete records, or a draft protocol", () => {
    expect(evaluateBenchmark(manifest(), panel(29)).state).toBe("not-ready");
    const incomplete = evaluateBenchmark(manifest(), panel(30).slice(0, -1));
    expect(incomplete.state).toBe("not-ready");
    expect(incomplete.counts.incompleteReviewers).toBe(1);
    expect(incomplete.counts.completeReviewers).toBe(29);
    expect(evaluateBenchmark({ ...manifest(), status: "draft" }, panel(30)).state).toBe(
      "not-ready",
    );
    expect(evaluateBenchmark(manifest(29), panel(30)).state).toBe("not-ready");
  });
  it("can establish declared bounds for synthetic fixed-panel data without claiming universal equivalence", () => {
    const result = evaluateBenchmark(manifest(6000), panel(6000));
    expect(result.state).toBe("within-bounds");
    expect(result.metrics.every((metric) => metric.state === "within-bounds")).toBe(true);
    expect(result.statement).toContain("does not establish universal indistinguishability");
  });
  it("permits superior quality instead of demanding numerical equality", () => {
    const result = evaluateBenchmark(manifest(6000), panel(6000, 7, 6));
    expect(result.state).toBe("within-bounds");
    expect(result.metrics.find((metric) => metric.id === "quality-hierarchy")?.mean).toBe(1);
  });
  it("prevents equal but poor work from meeting an absolute quality floor", () => {
    const result = evaluateBenchmark(manifest(1000), panel(1000, 2, 2));
    expect(result.state).toBe("outside-bounds");
    expect(result.metrics.find((metric) => metric.id === "minimum-hierarchy")?.state).toBe(
      "outside-bounds",
    );
  });
  it("does not turn screenshots into observed interaction or task evidence", () => {
    const plan = {
      ...manifest(),
      samples: manifest().samples.map((sample) => ({ ...sample, kind: "image" as const })),
    };
    expect(() => evaluateBenchmark(plan, panel(30))).toThrow("image");
    const data = panel(30).map((row) => ({
      ...row,
      taskOutcome: "not-tested" as const,
      quality: { ...row.quality, interaction: null },
    }));
    const result = evaluateBenchmark(plan, data);
    expect(result.state).toBe("not-ready");
    expect(result.metrics.find((metric) => metric.id === "quality-interaction")?.state).toBe(
      "unmeasured",
    );
    expect(result.metrics.find((metric) => metric.id === "task-success-difference")?.state).toBe(
      "unmeasured",
    );
  });
  it("rejects foreign, unknown or duplicate observations rather than changing denominators", () => {
    const rows = panel(1);
    expect(() => evaluateBenchmark(manifest(), [...rows, rows[0]!])).toThrow("only once");
    expect(() => evaluateBenchmark(manifest(), [{ ...rows[0]!, sampleId: "unknown" }])).toThrow(
      "Unknown",
    );
    expect(() => evaluateBenchmark(manifest(), [{ ...rows[0]!, benchmarkId: "other" }])).toThrow(
      "different",
    );
  });
  it("shows each task separately and counts unsure attribution responses", () => {
    const data = panel(30).map((row) => ({ ...row, judgedOrigin: "unsure" as const }));
    const result = evaluateBenchmark(manifest(), data);
    expect(result.counts.unsureOriginRatings).toBe(60);
    expect(result.taskBreakdown[0]?.quality["hierarchy"]).toEqual({ difference: 0, reviewers: 30 });
    expect(result.taskBreakdown[0]?.taskSuccess.candidateTested).toBe(30);
  });
});
