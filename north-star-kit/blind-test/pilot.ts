import { z } from "zod";
import { createBenchmarkPlan, maskReviewerSamples, organizerSampleSchema } from "./benchmark";
import { collectReviewAnswers } from "./evaluate";
import {
  benchmarkTaskSchema,
  bookingProtocol,
  qualityDimensionIds,
  type BlindEvaluation,
} from "./reviewer";

const groups = ["one-shot", "guided", "expert"] as const;
const pair = ["original", "guided"] as const;
const designerPair = ["guided", "expert"] as const;
type Group = (typeof groups)[number] | "original";
const protocols = ["matched-three-v1", "booking-pair-v1", "booking-designer-v1"] as const;
type Protocol = (typeof protocols)[number];
export function pilotGroups(protocol: Protocol): readonly Group[] {
  if (protocol === "booking-designer-v1") return designerPair;
  return protocol === "booking-pair-v1" ? pair : groups;
}

const digest = z
  .string()
  .regex(/^[a-f0-9]{64}$/i)
  .transform((value) => value.toLowerCase());
const pilotSample = organizerSampleSchema.extend({
  group: z.enum([...groups, "original"]),
  artifactSha256: digest,
  inputsSha256: digest,
  work: z
    .object({
      tools: z.string().trim().min(1).max(2000),
      minutes: z.number().nonnegative().max(1_000_000),
      revisionPasses: z.number().int().nonnegative().max(10_000),
    })
    .strict()
    .nullable(),
});

export const pilotManifestSchema = z
  .object({
    protocol: z.enum(protocols),
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
    if (
      pilot.protocol !== "matched-three-v1" &&
      (pilot.tasks.length !== 1 || pilot.tasks[0]?.observationProtocol !== bookingProtocol)
    )
      ctx.addIssue({
        code: "custom",
        message: "The booking pair uses one River Kiln observation task.",
      });
    if (
      pilot.samples.some(
        (s) =>
          !pilotGroups(pilot.protocol).includes(s.group) ||
          ((pilot.protocol === "matched-three-v1" || s.group === "expert") && !s.work),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Use the build sources and production records for this protocol.",
      });
    if (pilot.samples.some((s) => s.group === "one-shot" && s.work?.revisionPasses !== 0))
      ctx.addIssue({ code: "custom", message: "The one-shot build allows zero revision passes." });
  });
export type PilotManifest = z.infer<typeof pilotManifestSchema>;

export function createPilotPlan(
  id: string,
  protocol: Protocol = "matched-three-v1",
): PilotManifest {
  const tasks = createBenchmarkPlan().tasks.slice(0, 2);
  return pilotManifestSchema.parse({
    protocol,
    id,
    title:
      protocol === "matched-three-v1"
        ? "Booking and editorial review"
        : "River Kiln booking review",
    tasks: [
      {
        ...tasks[0]!,
        title: "Choose and book a River Kiln class",
        observationProtocol: bookingProtocol,
        brief:
          "Use a fresh made-up @example.test address for each sample. Choose the lost-confirmation practice condition. Start timing when you open the sample and stop when you finish or give up.",
        task: "Find the lower-priced class and say its total before submitting. Reserve a place. If the confirmation is lost, recover the booking.",
        successCriterion:
          "You identify the lower price and get a confirmation for exactly one reservation after the retry.",
      },
      {
        ...tasks[1]!,
        brief: "Use the supplied article, image permissions, credits, and related-story address.",
        task: "Identify the central claim, then use the article to find the specified related story.",
        successCriterion: "The reader identifies the claim and opens the intended related story.",
      },
    ].slice(0, protocol === "matched-three-v1" ? 2 : 1),
    samples: [],
  });
}

function matchedPilot(input: PilotManifest) {
  const pilot = pilotManifestSchema.parse(input);
  const expected = pilotGroups(pilot.protocol);
  for (const task of pilot.tasks) {
    const rows = pilot.samples.filter((sample) => sample.taskId === task.id);
    if (
      rows.length !== expected.length ||
      expected.some((group) => !rows.some((row) => row.group === group))
    )
      throw new Error(
        `Task ${task.id} needs one submission from each of the ${expected.length === 3 ? "three groups" : "two treatments"}.`,
      );
    if (
      task.observationProtocol === bookingProtocol &&
      rows.some((row) => row.kind !== "interactive")
    )
      throw new Error("The booking observation requires interactive pages.");
    if (
      new Set(rows.map((s) => s.kind)).size !== 1 ||
      new Set(rows.map((s) => s.inputsSha256)).size !== 1
    )
      throw new Error(
        `Use the same presentation kind and frozen input bundle for task ${task.id}.`,
      );
    if (
      new Set(rows.map((s) => s.artifactSha256)).size !== expected.length ||
      new Set(rows.map((s) => s.assetRef)).size !== expected.length
    )
      throw new Error(`Supply distinct outputs and reviewer addresses for task ${task.id}.`);
    const expert = rows.find((s) => s.group === "expert");
    if (expert && rows.some((row) => row !== expert && row.creatorCode === expert.creatorCode))
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
  const expected = pilotGroups(pilot.protocol);
  const tasks = pilot.tasks.map((task) => {
    const samples = pilot.samples.filter((row) => row.taskId === task.id);
    const ids = Object.fromEntries(samples.map((sample) => [sample.group, sample.id])) as Record<
      Group,
      string
    >;
    const complete = [...reviews.values()].filter((rows) => samples.every((s) => rows.has(s.id)));
    function compare(read: (row: BlindEvaluation) => number | null) {
      const totals = { original: 0, "one-shot": 0, guided: 0, expert: 0 };
      let count = 0;
      for (const rows of complete) {
        const values = expected.map((group) => read(rows.get(ids[group])!));
        if (values.some((v) => v === null)) continue;
        for (const [index, group] of expected.entries()) totals[group] += values[index]!;
        count++;
      }
      function average(group: Group) {
        return count && expected.includes(group) ? totals[group] / count : null;
      }
      const guided = average("guided");
      const oneShot = average("one-shot");
      const expert = average("expert");
      const original = average("original");
      return {
        reviewers: count,
        oneShot,
        guided,
        expert,
        gainOverOneShot: guided !== null && oneShot !== null ? guided - oneShot : null,
        remainingExpertGap: expert !== null && guided !== null ? expert - guided : null,
        ...(pilot.protocol === "booking-pair-v1"
          ? {
              original,
              gainOverOriginal: guided !== null && original !== null ? guided - original : null,
            }
          : {}),
      };
    }
    // Seconds, assistance and duplicate reservations have different directions; report raw group measures.
    function observed(read: (row: BlindEvaluation) => number | null) {
      const { reviewers, oneShot, guided, expert, original } = compare(read);
      return {
        reviewers,
        oneShot,
        guided,
        expert,
        ...(original === undefined ? {} : { original }),
      };
    }
    return {
      taskId: task.id,
      completeTriples: expected.length === 3 ? complete.length : 0,
      matchedReviewers: complete.length,
      ...(task.observationProtocol === bookingProtocol
        ? {
            bookingObservations: {
              firstSubmissionConfirmed: observed(({ bookingObservation: o }) =>
                o?.firstResponse != null ? Number(o.firstResponse === "confirmed") : null,
              ),
              encounteredPlannedLossFirst: observed(({ bookingObservation: o }) =>
                o?.firstResponse != null ? Number(o.firstResponse === "lost-confirmation") : null,
              ),
              firstChoiceCorrect: observed(({ bookingObservation: o }) =>
                o?.firstClass != null ? Number(o.firstClass === "wheel") : null,
              ),
              priceCorrect: observed(({ bookingObservation: o }) =>
                o?.statedDollars != null ? Number(o.statedDollars === 48) : null,
              ),
              helpUsed: observed(({ bookingObservation: o }) =>
                o?.helpUsed != null ? Number(o.helpUsed) : null,
              ),
              elapsedSeconds: observed(({ bookingObservation: o }) => o?.elapsedSeconds ?? null),
              recovered: observed(({ bookingObservation: o }) =>
                o?.recovery === "recovered" ? 1 : o?.recovery === "blocked" ? 0 : null,
              ),
              oneReservation: observed(({ bookingObservation: o }) =>
                o?.savedReservations != null ? Number(o.savedReservations === 1) : null,
              ),
              duplicateReservations: observed(({ bookingObservation: o }) =>
                o?.savedReservations != null ? Number(o.savedReservations > 1) : null,
              ),
            },
          }
        : {}),
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
    protocol: pilot.protocol,
    humanEquivalence: "inconclusive" as const,
    submissions: pilot.samples.map(({ id, taskId, group, artifactSha256, inputsSha256 }) => ({
      id,
      taskId,
      group,
      artifactSha256,
      inputsSha256,
    })),
    tasks,
    counts: {
      reviewers: reviews.size,
      evaluations: data.length,
      completeReviewers: [...reviews.values()].filter((rows) => rows.size === pilot.samples.length)
        .length,
    },
    statement:
      pilot.protocol === "booking-pair-v1"
        ? "Original and redesigned results describe the submitted pages and people who reviewed both. Missing observations are unmeasured. A human-expert comparison requires a separate matched pilot."
        : pilot.protocol === "booking-designer-v1"
          ? "These paired observations describe the guided and independent designer pages for this task. Each measure counts reviewers who supplied it on both pages. Human equivalence remains unmeasured by this exploratory pilot."
          : "Matched ratings describe these submitted builds. Positive rating gain favors the guided build over one-shot. A positive rating gap favors the expert. Missing observations are unmeasured. Human equivalence requires a separate confirmatory study.",
  };
}
