import { z } from "zod";
import {
  bookingObservationSchema,
  bookingProtocol,
  reviewerPacketSchema,
  type BookingObservation,
} from "../../north-star-kit/blind-test/reviewer";

export const REVIEW_ROOM_KEY = "focus:review-room:v1";
export const MAX_REVIEW_PACKET_BYTES = 2 * 1024 * 1024;
export const REVIEW_DIMENSIONS = [
  "hierarchy",
  "typography",
  "composition",
  "distinctiveness",
  "interaction",
  "content",
] as const;
export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number];
export type ReviewerPacket = z.infer<typeof reviewerPacketSchema>;
export type ReviewSample = ReviewerPacket["samples"][number];
const ratingSchema = z.number().int().min(1).max(7).nullable();
const qualitySchema = z
  .object({
    hierarchy: ratingSchema,
    typography: ratingSchema,
    composition: ratingSchema,
    distinctiveness: ratingSchema,
    interaction: ratingSchema,
    content: ratingSchema,
  })
  .strict();
// Keep unfinished numeric inputs across reloads. Only valid observed numbers enter an export.
const bookingDraftSchema = bookingObservationSchema.extend({
  statedDollars: z.string(),
  elapsedSeconds: z.string(),
  savedReservations: z.string(),
});
export type BookingDraft = z.infer<typeof bookingDraftSchema>;
export function emptyBookingDraft(): BookingDraft {
  return {
    firstResponse: null,
    firstClass: null,
    statedDollars: "",
    helpUsed: null,
    elapsedSeconds: "",
    recovery: null,
    savedReservations: "",
  };
}
function parseBookingDraft(draft: BookingDraft) {
  const toNumber = (value: string, decimalPlaces: number) => {
    const text = value.trim();
    if (!text) return null;
    if (text.length > 32 || !/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text)) return NaN;
    // Validate the entered units before converting: Number can round a fraction to a whole cent or count.
    const fraction = text.split(".")[1] ?? "";
    return /[1-9]/.test(fraction.slice(decimalPlaces)) ? NaN : Number(text);
  };
  return bookingObservationSchema.safeParse({
    ...draft,
    statedDollars: toNumber(draft.statedDollars, 2),
    elapsedSeconds: toNumber(draft.elapsedSeconds, 0),
    savedReservations: toNumber(draft.savedReservations, 0),
  });
}
const draftSchema = z
  .object({
    bookingObservation: bookingDraftSchema.optional(),
    pausedBookingObservation: bookingDraftSchema.optional(),
    taskOutcome: z.enum(["completed", "blocked", "not-tested"]).nullable(),
    judgedOrigin: z.enum(["person", "generated", "unsure"]).nullable(),
    quality: qualitySchema,
    note: z.string().max(4000),
  })
  .strict();
export type ReviewDraft = z.infer<typeof draftSchema>;
const sessionSchema = z
  .object({
    version: z.literal(1),
    packet: reviewerPacketSchema,
    reviewerCode: z.string().max(120),
    order: z.array(z.string()).min(2).max(80),
    currentIndex: z.number().int().min(0).max(79),
    drafts: z.record(z.string(), draftSchema),
  })
  .strict();
export type ReviewSession = z.infer<typeof sessionSchema>;
export type ReviewEvaluation = {
  bookingObservation?: BookingObservation;
  benchmarkId: string;
  reviewerCode: string;
  sampleId: string;
  taskOutcome: "completed" | "blocked" | "not-tested";
  judgedOrigin: "person" | "generated" | "unsure";
  quality: Record<ReviewDimension, number | null>;
  note: string;
};

export function safeReviewUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function validatePacket(value: unknown): ReviewerPacket {
  const result = reviewerPacketSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      "This is not a reviewer packet. Ask the organizer for the blinded reviewer JSON, without the private source map.",
    );
  const packet = result.data;
  if (
    packet.samples.length > 80 ||
    packet.tasks.length > 40 ||
    packet.title.length > 200 ||
    packet.instructions.length > 8000 ||
    packet.samples.some((sample) => sample.label.length > 200 || sample.assetRef.length > 2000)
  )
    throw new Error(
      "This packet exceeds the review room’s size limits. Ask the organizer for a smaller packet.",
    );
  if (packet.samples.some((sample) => !safeReviewUrl(sample.assetRef)))
    throw new Error(
      "Every sample needs a complete HTTP or HTTPS page address without embedded credentials. Local file paths and executable links are not supported.",
    );
  return packet;
}

export function parseReviewerPacket(text: string): ReviewerPacket {
  if (new TextEncoder().encode(text).byteLength > MAX_REVIEW_PACKET_BYTES)
    throw new Error("Choose a reviewer packet smaller than 2 MB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose the reviewer packet supplied by the organizer.",
    );
  }
  return validatePacket(value);
}

/** Fisher–Yates; the caller supplies an unbiased integer in [0, limit). */
export function shuffleReviewOrder(
  ids: string[],
  randomIndex: (limit: number) => number,
): string[] {
  if (new Set(ids).size !== ids.length) throw new Error("Sample IDs must be unique.");
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i)
      throw new Error("The shuffle returned an invalid index.");
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

export function secureReviewIndex(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 80)
    throw new Error("Invalid shuffle range.");
  const range = 0x1_0000_0000;
  const ceiling = Math.floor(range / limit) * limit;
  const values = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(values);
  } while (values[0]! >= ceiling);
  return values[0]! % limit;
}

export function emptyReviewDraft(kind: ReviewSample["kind"]): ReviewDraft {
  return {
    taskOutcome: kind === "image" ? "not-tested" : null,
    judgedOrigin: null,
    quality: {
      hierarchy: null,
      typography: null,
      composition: null,
      distinctiveness: null,
      interaction: null,
      content: null,
    },
    note: "",
  };
}

/** Preserve the organizer’s planned order unless a caller explicitly requests a shuffle. */
export function createReviewSession(
  packet: ReviewerPacket,
  randomIndex?: (limit: number) => number,
): ReviewSession {
  const checked = validatePacket(packet);
  const sampleIds = checked.samples.map((sample) => sample.id);
  return {
    version: 1,
    packet: checked,
    reviewerCode: "",
    order: randomIndex ? shuffleReviewOrder(sampleIds, randomIndex) : sampleIds,
    currentIndex: 0,
    drafts: Object.fromEntries(
      checked.samples.map((sample) => [sample.id, emptyReviewDraft(sample.kind)]),
    ),
  };
}

export function parseReviewSession(text: string): ReviewSession {
  if (new TextEncoder().encode(text).byteLength > MAX_REVIEW_PACKET_BYTES * 2)
    throw new Error("The saved review is too large to restore.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "The saved review could not be read. Load the organizer’s packet to start a new review.",
    );
  }
  const result = sessionSchema.safeParse(parsed);
  if (!result.success)
    throw new Error(
      "The saved review could not be validated. Load the organizer’s packet to start a new review.",
    );
  const session = result.data;
  session.packet = validatePacket(session.packet);
  const sampleIds = new Set(session.packet.samples.map((sample) => sample.id));
  if (
    session.order.length !== sampleIds.size ||
    new Set(session.order).size !== sampleIds.size ||
    session.order.some((id) => !sampleIds.has(id)) ||
    session.currentIndex >= session.order.length
  )
    throw new Error(
      "The saved sample order is incomplete. Load the packet again to begin a new review.",
    );
  if (
    Object.keys(session.drafts).length !== sampleIds.size ||
    Object.keys(session.drafts).some((id) => !sampleIds.has(id))
  )
    throw new Error("The saved answers do not match this packet.");
  for (const sample of session.packet.samples) {
    const draft = session.drafts[sample.id];
    if (draft?.bookingObservation || draft?.pausedBookingObservation) {
      const task = session.packet.tasks.find((task) => task.id === sample.taskId);
      if (
        sample.kind !== "interactive" ||
        task?.observationProtocol !== bookingProtocol ||
        (draft.bookingObservation && draft.taskOutcome === "not-tested") ||
        (draft.pausedBookingObservation && draft.taskOutcome !== "not-tested")
      )
        throw new Error("The saved booking observations do not match this interactive task.");
    }
    if (
      !draft ||
      (sample.kind === "image" &&
        (draft.taskOutcome !== "not-tested" || draft.quality.interaction !== null))
    )
      throw new Error("The saved answers contain an invalid image assessment.");
  }
  return session;
}

export function missingReviewAnswers(
  draft: ReviewDraft,
  sample: ReviewSample,
  reviewerCode: string,
): string[] {
  const missing: string[] = [];
  if (draft.bookingObservation && !parseBookingDraft(draft.bookingObservation).success)
    missing.push("bookingObservation");
  if (!reviewerCode.trim()) missing.push("reviewerCode");
  if (draft.taskOutcome === null) missing.push("taskOutcome");
  if (draft.judgedOrigin === null) missing.push("judgedOrigin");
  for (const key of REVIEW_DIMENSIONS)
    if (!(key === "interaction" && sample.kind === "image") && draft.quality[key] === null)
      missing.push(key);
  return missing;
}

export function completedReviewCount(session: ReviewSession): number {
  return session.packet.samples.filter(
    (sample) =>
      !missingReviewAnswers(session.drafts[sample.id]!, sample, session.reviewerCode).length,
  ).length;
}

export function reviewAnswerBundle(session: ReviewSession, allowPartial = false) {
  const validated = parseReviewSession(JSON.stringify(session));
  const evaluations: ReviewEvaluation[] = [];
  for (const sampleId of validated.order) {
    const sample = validated.packet.samples.find((item) => item.id === sampleId)!;
    const draft = validated.drafts[sampleId]!;
    if (missingReviewAnswers(draft, sample, validated.reviewerCode).length) continue;
    const observation = draft.bookingObservation && parseBookingDraft(draft.bookingObservation);
    evaluations.push({
      ...(observation?.success && Object.values(observation.data).some((v) => v !== null)
        ? { bookingObservation: observation.data }
        : {}),
      benchmarkId: validated.packet.benchmarkId,
      reviewerCode: validated.reviewerCode.trim(),
      sampleId,
      taskOutcome: draft.taskOutcome!,
      judgedOrigin: draft.judgedOrigin!,
      quality: { ...draft.quality },
      note: draft.note.trim(),
    });
  }
  if (!allowPartial && evaluations.length !== validated.packet.samples.length)
    throw new Error("Finish every sample before downloading the complete answer file.");
  if (!evaluations.length)
    throw new Error("Finish at least one sample before downloading answers.");
  return { version: 1 as const, benchmarkId: validated.packet.benchmarkId, evaluations };
}
