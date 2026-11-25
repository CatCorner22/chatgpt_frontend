import { describe, expect, it } from "vitest";
import { packetFixture } from "./review-room.fixture";
import {
  blindEvaluationBundleSchema,
  bookingProtocol,
} from "../../north-star-kit/blind-test/reviewer";
import {
  createReviewSession,
  emptyBookingDraft,
  missingReviewAnswers,
  parseReviewerPacket,
  parseReviewSession,
  reviewAnswerBundle,
  safeReviewUrl,
  shuffleReviewOrder,
  type ReviewDraft,
} from "@/lib/review-room";

const fullDraft = (image = false): ReviewDraft => ({
  taskOutcome: image ? "not-tested" : "completed",
  judgedOrigin: "unsure",
  quality: {
    hierarchy: 4,
    typography: 5,
    composition: 4,
    distinctiveness: 5,
    interaction: image ? null : 4,
    content: 5,
  },
  note: "The label was clear.",
});

describe("blinded reviewer packet boundary", () => {
  it("rejects organizer-only fields rather than stripping the source map", () => {
    const packet = packetFixture();
    expect(() =>
      parseReviewerPacket(
        JSON.stringify({
          ...packet,
          samples: packet.samples.map((sample) => ({ ...sample, group: "human" })),
        }),
      ),
    ).toThrow("reviewer packet");
    expect(() =>
      parseReviewerPacket(JSON.stringify({ ...packet, organizerMap: { "sample-a": "human" } })),
    ).toThrow("reviewer packet");
  });
  it("permits only explicit web URLs without embedded credentials", () => {
    expect(safeReviewUrl("https://review.test/a")).toBe("https://review.test/a");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,page",
      "file:///page.html",
      "//review.test/a",
      "https://user:pass@review.test",
    ])
      expect(safeReviewUrl(url)).toBeNull();
    const packet = packetFixture();
    packet.samples[0]!.assetRef = "javascript:alert(1)";
    expect(() => parseReviewerPacket(JSON.stringify(packet))).toThrow("HTTP or HTTPS");
  });
  it("rejects invalid, oversized, and mismatched packet data", () => {
    expect(() => parseReviewerPacket("not JSON")).toThrow("valid JSON");
    expect(() => parseReviewerPacket(" ".repeat(2 * 1024 * 1024 + 1))).toThrow("2 MB");
    const packet = packetFixture();
    packet.samples[0]!.taskId = "unknown-task";
    expect(() => parseReviewerPacket(JSON.stringify(packet))).toThrow("reviewer packet");
  });
});

describe("saved review integrity", () => {
  it("preserves a planned organizer order through packet import and reload by default", () => {
    const packet = packetFixture();
    packet.samples.reverse();
    const imported = parseReviewerPacket(JSON.stringify(packet));
    const session = createReviewSession(imported);
    expect(session.order).toEqual(["sample-b", "sample-a"]);
    expect(parseReviewSession(JSON.stringify(session)).order).toEqual(["sample-b", "sample-a"]);
    expect(imported.samples.map((sample) => sample.id)).toEqual(["sample-b", "sample-a"]);
  });
  it("shuffles a copy once and restores exactly the recorded order and answers", () => {
    const original = ["a", "b", "c"];
    expect(shuffleReviewOrder(original, () => 0)).toEqual(["b", "c", "a"]);
    expect(original).toEqual(["a", "b", "c"]);
    const session = createReviewSession(packetFixture(), () => 0);
    session.reviewerCode = "panel-09";
    session.drafts["sample-b"] = fullDraft(true);
    session.currentIndex = 1;
    expect(parseReviewSession(JSON.stringify(session))).toEqual(session);
  });
  it("rejects duplicate or foreign order entries and answers for unknown samples", () => {
    const session = createReviewSession(packetFixture(), (limit) => limit - 1);
    expect(() =>
      parseReviewSession(JSON.stringify({ ...session, order: ["sample-a", "sample-a"] })),
    ).toThrow("sample order");
    expect(() =>
      parseReviewSession(
        JSON.stringify({ ...session, drafts: { ...session.drafts, foreign: fullDraft() } }),
      ),
    ).toThrow("do not match");
    expect(() => shuffleReviewOrder(["a", "b"], () => 2)).toThrow("invalid index");
  });
  it("does not allow image-only work to masquerade as tested interaction", () => {
    const session = createReviewSession(packetFixture(), (limit) => limit - 1);
    session.drafts["sample-b"] = fullDraft(false);
    expect(() => parseReviewSession(JSON.stringify(session))).toThrow("invalid image assessment");
  });
});

describe("complete and explicitly partial answer export", () => {
  it("requires the reviewer code, task, origin, and every applicable quality dimension", () => {
    const session = createReviewSession(packetFixture(), (limit) => limit - 1);
    expect(
      missingReviewAnswers(session.drafts["sample-a"]!, session.packet.samples[0]!, ""),
    ).toEqual([
      "reviewerCode",
      "taskOutcome",
      "judgedOrigin",
      "hierarchy",
      "typography",
      "composition",
      "distinctiveness",
      "interaction",
      "content",
    ]);
    expect(
      missingReviewAnswers(session.drafts["sample-b"]!, session.packet.samples[1]!, "code"),
    ).not.toContain("interaction");
    expect(() => reviewAnswerBundle(session)).toThrow("Finish every sample");
    expect(() => reviewAnswerBundle(session, true)).toThrow("at least one");
  });
  it("exports only completed samples in a partial file and preserves uncertainty", () => {
    const session = createReviewSession(packetFixture(), (limit) => limit - 1);
    session.reviewerCode = "  panel-09  ";
    session.drafts["sample-a"] = fullDraft();
    const partial = reviewAnswerBundle(session, true);
    expect(partial.evaluations).toHaveLength(1);
    expect(partial.evaluations[0]).toMatchObject({
      reviewerCode: "panel-09",
      sampleId: "sample-a",
      judgedOrigin: "unsure",
    });
    expect(blindEvaluationBundleSchema.safeParse(partial).success).toBe(true);
    expect(JSON.stringify(partial)).not.toContain("assetRef");
    expect(JSON.stringify(partial)).not.toContain("group");
  });
  it("produces an evaluator-compatible complete bundle including null image interaction", () => {
    const session = createReviewSession(packetFixture(), () => 0);
    session.reviewerCode = "panel-09";
    session.drafts["sample-a"] = fullDraft();
    session.drafts["sample-b"] = fullDraft(true);
    const bundle = reviewAnswerBundle(session);
    expect(blindEvaluationBundleSchema.safeParse(bundle).success).toBe(true);
    expect(bundle.evaluations.map((item) => item.sampleId)).toEqual(session.order);
    expect(bundle.evaluations[0]?.quality.interaction).toBeNull();
    expect(bundle.evaluations[0]?.taskOutcome).toBe("not-tested");
  });
});

describe("River Kiln observation handoff", () => {
  function sessionWithBooking() {
    const packet = packetFixture();
    packet.tasks[0]!.observationProtocol = bookingProtocol;
    const session = createReviewSession(packet);
    session.reviewerCode = "participant-4";
    session.drafts["sample-a"] = {
      ...fullDraft(),
      bookingObservation: {
        ...emptyBookingDraft(),
        firstClass: "wheel",
        statedDollars: "48.00",
        elapsedSeconds: "65",
        helpUsed: false,
        recovery: "recovered",
        savedReservations: "",
      },
    };
    return session;
  }
  it("restores only what was observed, preserving zero counts and unknown counts as distinct", () => {
    const session = parseReviewSession(JSON.stringify(sessionWithBooking()));
    const observation = reviewAnswerBundle(session, true).evaluations[0]!.bookingObservation;
    expect(observation).toEqual({
      firstResponse: null,
      firstClass: "wheel",
      statedDollars: 48,
      elapsedSeconds: 65,
      helpUsed: false,
      recovery: "recovered",
      savedReservations: null,
    });
    session.drafts["sample-a"]!.bookingObservation!.savedReservations = "0";
    expect(
      reviewAnswerBundle(session, true).evaluations[0]!.bookingObservation?.savedReservations,
    ).toBe(0);
  });
  it("keeps unfinished or invalid numbers editable and excludes them from a submitted answer", () => {
    const session = sessionWithBooking();
    session.drafts["sample-a"]!.bookingObservation!.statedDollars = "0x30";
    expect(
      parseReviewSession(JSON.stringify(session)).drafts["sample-a"]!.bookingObservation
        ?.statedDollars,
    ).toBe("0x30");
    expect(
      missingReviewAnswers(session.drafts["sample-a"]!, session.packet.samples[0]!, "r"),
    ).toContain("bookingObservation");
    expect(() => reviewAnswerBundle(session, true)).toThrow("at least one sample");
  });
  it("rejects observations attached to a different task, an image, or an unattempted sample", () => {
    const session = sessionWithBooking();
    delete session.packet.tasks[0]!.observationProtocol;
    expect(() => parseReviewSession(JSON.stringify(session))).toThrow("do not match");
    session.packet.tasks[0]!.observationProtocol = bookingProtocol;
    session.drafts["sample-a"]!.taskOutcome = "not-tested";
    expect(() => reviewAnswerBundle(session, true)).toThrow("do not match");
    session.drafts["sample-a"]!.taskOutcome = "completed";
    session.drafts["sample-b"]!.bookingObservation = emptyBookingDraft();
    expect(() => reviewAnswerBundle(session, true)).toThrow("do not match");
  });
});
