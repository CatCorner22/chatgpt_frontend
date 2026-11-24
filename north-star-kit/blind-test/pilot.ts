import { z } from "zod";
import { createBenchmarkPlan, maskReviewerSamples, organizerSampleSchema } from "./benchmark";
import { collectReviewAnswers } from "./evaluate";
import { benchmarkTaskSchema, qualityDimensionIds, type BlindEvaluation } from "./reviewer";

const groups = ["one-shot", "guided", "expert"] as const;
type Group = (typeof groups)[number];
const digest = z
  .string()
  .regex(/^[a-f0-9]{64}$/i)
  .transform((value) => value.toLowerCase());
const pilotSample = organizerSampleSchema.extend({
  group: z.enum(groups),
  artifactSha256: digest,
  inputsSha256: digest,
  work: z
    .object({
      tools: z.string().trim().min(1).max(2000),
      minutes: z.number().nonnegative().max(1_000_000),
      revisionPasses: z.number().int().nonnegative().max(10_000),
    })
    .strict(),
});

export const pilotManifestSchema = z
  .object({
    protocol: z.literal("matched-three-v1"),
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200),
    tasks: z.array(benchmarkTaskSchema).min(1).max(26),
    samples: z.array(pilotSample).max(78),
  })
  .strict()
  .superRefine((pilot, ctx) => {
    const tasks = new Set(pilot.tasks.map((task) => task.id));
    if (
      tasks.size !== pilot.tasks.length ||
      new Set(pilot.samples.map((s) => s.id)).size !== pilot.samples.length
    )
      ctx.addIssue({ code: "custom", message: "Task IDs and sample IDs must each be unique." });
    if (pilot.samples.some((sample) => !tasks.has(sample.taskId)))
      ctx.addIssue({ code: "custom", message: "Every sample needs a task in this pilot." });
    if (pilot.samples.some((s) => s.group === "one-shot" && s.work.revisionPasses !== 0))
      ctx.addIssue({ code: "custom", message: "The one-shot build allows zero revision passes." });
  });
export type PilotManifest = z.infer<typeof pilotManifestSchema>;

export function createPilotPlan(id: string): PilotManifest {
  const tasks = createBenchmarkPlan().tasks.slice(0, 2);
  return pilotManifestSchema.parse({
    protocol: "matched-three-v1",
    id,
    title: "Booking and editorial review",
    tasks: [
      {
        ...tasks[0]!,
        title: "Find and book a class",
        brief:
          "A studio offers classes at different prices and times. Use the supplied catalogue, test booking service and recovery conditions.",
        task: "Find the stated class and its total price. Book it and recover if the first attempt fails.",
        successCriterion:
          "The intended class is booked once at the stated price. Entered details survive a retry.",
      },
      {
        ...tasks[1]!,
        brief: "Use the supplied article, image permissions, credits, and related-story address.",
        task: "Identify the central claim, then use the article to find the specified related story.",
        successCriterion: "The reader identifies the claim and opens the intended related story.",
      },
    ],
    samples: [],
  });
}

function matchedPilot(input: PilotManifest) {
  const pilot = pilotManifestSchema.parse(input);
  for (const task of pilot.tasks) {
    const rows = pilot.samples.filter((sample) => sample.taskId === task.id);
    if (rows.length !== 3 || new Set(rows.map((row) => row.group)).size !== 3)
      throw new Error(`Task ${task.id} needs one submission from each of the three groups.`);
    if (
      new Set(rows.map((s) => s.kind)).size !== 1 ||
      new Set(rows.map((s) => s.inputsSha256)).size !== 1
    )
      throw new Error(
        `Use the same presentation kind and frozen input bundle for task ${task.id}.`,
      );
    if (
      new Set(rows.map((s) => s.artifactSha256)).size !== 3 ||
      new Set(rows.map((s) => s.assetRef)).size !== 3
    )
      throw new Error(`Supply three distinct outputs and reviewer addresses for task ${task.id}.`);
    const expert = rows.find((s) => s.group === "expert")!;
    if (rows.some((row) => row !== expert && row.creatorCode === expert.creatorCode))
      throw new Error(`Use an independent expert for task ${task.id}.`);
  }
  return pilot;
}

export function createPilotPacket(input: PilotManifest, order: string[]) {
  const packet = maskReviewerSamples(matchedPilot(input), order);
  for (const sample of packet.samples) {
    // URL validation and the original two-group cues also apply in the Review room.
    const words = [sample.id, sample.assetRef].map((value) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    });
    if (
      words.some((value) => /(?:^|[^a-z])(?:one[-_ ]?shot|guided|expert)(?:$|[^a-z])/i.test(value))
    )
      throw new Error("Mask the source in each sample ID and reviewer address.");
  }
  return packet;
}

export function scorePilot(input: PilotManifest, data: BlindEvaluation[]) {
  const pilot = matchedPilot(input);
  const reviews = collectReviewAnswers(pilot, data);
  const tasks = pilot.tasks.map((task) => {
    const samples = pilot.samples.filter((row) => row.taskId === task.id);
    const ids = Object.fromEntries(samples.map((sample) => [sample.group, sample.id])) as Record<
      Group,
      string
    >;
    const complete = [...reviews.values()].filter((rows) => samples.every((s) => rows.has(s.id)));
    function compare(read: (row: BlindEvaluation) => number | null) {
      const totals = { "one-shot": 0, guided: 0, expert: 0 };
      let count = 0;
      for (const rows of complete) {
        const values = groups.map((group) => read(rows.get(ids[group])!));
        if (values.some((v) => v === null)) continue;
        for (const [index, group] of groups.entries()) totals[group] += values[index]!;
        count++;
      }
      return {
        reviewers: count,
        oneShot: count ? totals["one-shot"] / count : null,
        guided: count ? totals.guided / count : null,
        expert: count ? totals.expert / count : null,
        gainOverOneShot: count ? (totals.guided - totals["one-shot"]) / count : null,
        remainingExpertGap: count ? (totals.expert - totals.guided) / count : null,
      };
    }
    return {
      taskId: task.id,
      completeTriples: complete.length,
      quality: Object.fromEntries(
        qualityDimensionIds.map((dim) => [dim, compare((row) => row.quality[dim])]),
      ),
      taskCompletion: compare((row) =>
        row.taskOutcome === "not-tested" ? null : Number(row.taskOutcome === "completed"),
      ),
      production: Object.fromEntries(samples.map((s) => [s.group, s.work])),
    };
  });
  return {
    benchmarkId: pilot.id,
    state: "descriptive-pilot" as const,
    tasks,
    counts: {
      reviewers: reviews.size,
      evaluations: data.length,
      completeReviewers: [...reviews.values()].filter((rows) => rows.size === pilot.samples.length)
        .length,
    },
    statement:
      "Matched ratings describe these submitted builds. Positive gain favors the guided build over one-shot. A positive remaining gap favors the expert. Human equivalence requires a separate confirmatory study.",
  };
}
