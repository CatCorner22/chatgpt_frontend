import { z } from "zod";

const id = z.string().min(1).max(120);
const sample = z.object({ kind: z.literal("sample"), sampleId: id }).strict();
export const bookingPreferenceSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("booking-preference"),
    benchmarkId: id,
    reviewerCode: id,
    sampleIds: z.tuple([id, id]),
    answersSha256: z.string().regex(/^[a-f0-9]{64}$/),
    choice: z.discriminatedUnion("kind", [
      sample,
      z.object({ kind: z.literal("no-preference") }).strict(),
      z.object({ kind: z.literal("could-not-compare") }).strict(),
    ]),
  })
  .strict()
  .refine(({ sampleIds }) => sampleIds[0] !== sampleIds[1], "The two samples must be distinct.")
  .refine(
    ({ choice, sampleIds }) => choice.kind !== "sample" || sampleIds.includes(choice.sampleId),
    "The selected page must be one of the reviewed samples.",
  );
export type BookingPreference = z.infer<typeof bookingPreferenceSchema>;
