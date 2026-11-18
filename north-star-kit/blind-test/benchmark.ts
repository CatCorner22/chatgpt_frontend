import { z } from "zod";
import {
  benchmarkTaskSchema,
  qualityDimensions,
  reviewerPacketSchema,
  type ReviewerPacket,
} from "./reviewer";
export * from "./reviewer";
const id = z.string().trim().min(1).max(120);

export const organizerSampleSchema = z
  .object({
    id,
    taskId: id,
    assetRef: z.string().min(1).max(2000),
    kind: z.enum(["interactive", "image"]),
    group: z.enum(["spec", "human"]),
    creatorCode: id,
    provenance: z.string().min(1).max(4000),
    artifactSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
  })
  .strict();
export const benchmarkManifestSchema = z
  .object({
    version: z.literal(1),
    id,
    title: z.string().min(1).max(200),
    status: z.enum(["draft", "registered"]),
    registration: z
      .object({ recordedAt: z.iso.datetime(), reference: z.string().min(1).max(2000) })
      .strict()
      .optional(),
    population: z.string().min(1).max(2000),
    recruitment: z.string().min(1).max(4000),
    samplingPlan: z.string().min(1).max(4000),
    stoppingRule: z.string().min(1).max(2000),
    tasks: z.array(benchmarkTaskSchema).min(1).max(40),
    samples: z.array(organizerSampleSchema).max(80),
    criteria: z
      .object({
        targetReviewers: z.number().int().min(2).max(100000),
        minimumHumanCreators: z.number().int().min(1).max(40),
        qualityMargin: z.number().positive().max(2),
        taskSuccessMargin: z.number().positive().max(0.25),
        attributionMargin: z.number().positive().max(0.25),
        qualityFloor: z.number().min(1).max(7),
        taskSuccessFloor: z.number().min(0).max(1),
        confidence: z.literal(0.95),
      })
      .strict(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (new Set(manifest.tasks.map((task) => task.id)).size !== manifest.tasks.length)
      ctx.addIssue({ code: "custom", path: ["tasks"], message: "Task IDs must be unique." });
    if (new Set(manifest.samples.map((sample) => sample.id)).size !== manifest.samples.length)
      ctx.addIssue({ code: "custom", path: ["samples"], message: "Sample IDs must be unique." });
    for (const sample of manifest.samples)
      if (!manifest.tasks.some((task) => task.id === sample.taskId))
        ctx.addIssue({
          code: "custom",
          path: ["samples"],
          message: `Unknown task for sample ${sample.id}.`,
        });
    if (manifest.status === "registered") {
      if (!manifest.registration)
        ctx.addIssue({
          code: "custom",
          path: ["registration"],
          message: "Record the external preregistration reference and time.",
        });
      for (const task of manifest.tasks) {
        const pair = manifest.samples.filter((sample) => sample.taskId === task.id);
        if (pair.length !== 2 || new Set(pair.map((sample) => sample.group)).size !== 2)
          ctx.addIssue({
            code: "custom",
            path: ["samples"],
            message: `Task ${task.id} needs exactly one sample from each group.`,
          });
        if (new Set(pair.map((sample) => sample.kind)).size !== 1)
          ctx.addIssue({
            code: "custom",
            path: ["samples"],
            message: `Task ${task.id} must compare the same presentation kind.`,
          });
        if (
          pair.length === 2 &&
          pair[0]!.artifactSha256 &&
          pair[0]!.artifactSha256.toLowerCase() === pair[1]!.artifactSha256?.toLowerCase()
        )
          ctx.addIssue({
            code: "custom",
            path: ["samples"],
            message: `Task ${task.id} cannot reuse the same frozen artifact as both groups.`,
          });
        if (pair.length === 2 && pair[0]!.creatorCode === pair[1]!.creatorCode)
          ctx.addIssue({
            code: "custom",
            path: ["samples"],
            message: `Task ${task.id} needs an independently created human reference.`,
          });
      }
      if (manifest.samples.some((sample) => !sample.artifactSha256))
        ctx.addIssue({
          code: "custom",
          path: ["samples"],
          message: "Freeze and record each artifact hash before registration.",
        });
      if (
        new Set(
          manifest.samples
            .filter((sample) => sample.group === "human")
            .map((sample) => sample.creatorCode),
        ).size < manifest.criteria.minimumHumanCreators
      )
        ctx.addIssue({
          code: "custom",
          path: ["samples"],
          message: "The human reference set does not meet the declared creator count.",
        });
    }
  });
export type BenchmarkManifest = z.infer<typeof benchmarkManifestSchema>;

/** The caller supplies a shuffled sample-ID order; this pure function never invents randomness. */
export function createReviewerPacket(
  input: BenchmarkManifest,
  sampleOrder: string[],
): ReviewerPacket {
  const manifest = benchmarkManifestSchema.parse(input);
  if (
    sampleOrder.length !== manifest.samples.length ||
    new Set(sampleOrder).size !== sampleOrder.length ||
    sampleOrder.some((id) => !manifest.samples.some((sample) => sample.id === id))
  )
    throw new Error("Supply each sample ID exactly once in the chosen presentation order.");
  return reviewerPacketSchema.parse({
    version: 1,
    benchmarkId: manifest.id,
    title: manifest.title,
    instructions:
      "Review each sample on its own. Complete the stated task if interaction is available, then record your ratings before opening the next sample. Use an arbitrary reviewer code, not your name. Do not discuss source guesses with other reviewers. Side-by-side discussion follows only after primary ratings are locked.",
    tasks: manifest.tasks,
    samples: sampleOrder.map((sampleId, index) => {
      const sample = manifest.samples.find((sample) => sample.id === sampleId)!;
      return {
        id: sample.id,
        taskId: sample.taskId,
        label: `Sample ${index + 1}`,
        assetRef: sample.assetRef,
        kind: sample.kind,
      };
    }),
    dimensions: qualityDimensions,
  });
}

/** A draft study plan contains no fabricated pages, participants, references or observations. */
export function createBenchmarkPlan(): BenchmarkManifest {
  return benchmarkManifestSchema.parse({
    version: 1,
    id: "frontend-benchmark-v1",
    title: "Frontend craft and task benchmark",
    status: "draft",
    population:
      "Define the intended users and a separate panel of experienced frontend/design reviewers before recruitment.",
    recruitment:
      "Recruit independent reviewers who did not create or see the submitted work. Record panel composition without collecting unnecessary identifying details.",
    samplingPlan:
      "Build matched page pairs from the same six briefs, content and assets. Obtain independent human work with permission from at least three creators. Freeze candidates before recruitment.",
    stoppingRule:
      "Pilot: recruit the declared fixed reviewer count and finish collection before inspecting group comparisons. Plan a separate confirmatory study using pilot variance; do not keep recruiting until a result passes.",
    criteria: {
      targetReviewers: 30,
      minimumHumanCreators: 3,
      qualityMargin: 0.5,
      taskSuccessMargin: 0.05,
      attributionMargin: 0.1,
      qualityFloor: 5,
      taskSuccessFloor: 0.9,
      confidence: 0.95,
    },
    tasks: [
      {
        id: "service-booking",
        family: "service",
        title: "Book a local service",
        brief:
          "A repair workshop needs a clear service offer, eligibility, prices and appointment flow. Both versions receive the same supplied business facts and available appointment data.",
        task: "Find the price for a standard repair and request an available appointment.",
        successCriterion:
          "The correct service and available slot reach a confirmation with no lost input.",
        viewport: { width: 390, height: 844 },
      },
      {
        id: "editorial-reading",
        family: "editorial",
        title: "Read and find a source",
        brief:
          "An independent journal publishes a long article with citations, figures and related reading. Both versions use the same supplied article and licensed images.",
        task: "Find the article’s central claim, then open its supporting source.",
        successCriterion: "The reader identifies the claim and reaches the correct cited source.",
        viewport: { width: 1280, height: 900 },
      },
      {
        id: "product-comparison",
        family: "commerce",
        title: "Compare and choose a product",
        brief:
          "A specialist retailer offers comparable products with specifications, stock states and delivery terms. Both versions receive the same product records and claims.",
        task: "Compare two suitable products and choose one that meets the stated constraint.",
        successCriterion:
          "The selected item meets the constraint and the correct item reaches the cart.",
        viewport: { width: 390, height: 844 },
      },
      {
        id: "workspace-action",
        family: "application",
        title: "Update a shared task",
        brief:
          "A small-team workspace shows tasks, priorities, owners and status. Both versions receive identical records, permissions and states.",
        task: "Find the overdue task assigned to you, change its priority, and mark it complete.",
        successCriterion:
          "The intended record changes, feedback confirms the result, and another task is unaffected.",
        viewport: { width: 1280, height: 900 },
      },
      {
        id: "form-recovery",
        family: "form",
        title: "Recover from a form error",
        brief:
          "A community program accepts an application with several required fields and one known validation failure. Both versions receive identical fields, rules and messages.",
        task: "Submit the application, resolve the indicated error, and submit again.",
        successCriterion:
          "The user understands the error, retains valid input, and reaches confirmation.",
        viewport: { width: 390, height: 844 },
      },
      {
        id: "data-investigation",
        family: "data",
        title: "Find a record in dense data",
        brief:
          "An operations page contains a filterable table, totals, empty results and a detail view. Both versions receive identical data and calculation rules.",
        task: "Filter to the requested period, find the specified outlier, and inspect its details.",
        successCriterion:
          "The correct record is identified and its details agree with the supplied data.",
        viewport: { width: 1280, height: 900 },
      },
    ],
    samples: [],
  });
}
