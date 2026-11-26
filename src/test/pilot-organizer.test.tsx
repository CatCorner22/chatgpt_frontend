import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlindReviewRoom } from "@/components/BlindReviewRoom";
import { createReviewSession, parseReviewerPacket, REVIEW_ROOM_KEY } from "@/lib/review-room";
import { downloadBlob } from "@/lib/download-blob";
import {
  createPilotPlan,
  createPilotPacket,
  scorePilot,
  type PilotManifest,
} from "../../north-star-kit/blind-test/pilot";
import {
  blindEvaluationBundleSchema,
  type BookingObservation,
} from "../../north-star-kit/blind-test/reviewer";
import { packetFixture } from "./review-room.fixture";

vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Review workspace</header> }));
vi.mock("@/lib/download-blob", () => ({ downloadBlob: vi.fn() }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
function file(value: unknown) {
  const text = JSON.stringify(value);
  return Object.assign(new File([text], "data.json"), { text: async () => text });
}
function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}
function manifest() {
  const plan = createPilotPlan("test-pilot");
  const task = plan.tasks[0]!;
  const samples = (["one-shot", "guided", "expert"] as const).map((group, i) => ({
    id: `sample-${i}`,
    taskId: task.id,
    assetRef: `https://review.test/${i}`,
    kind: "interactive" as const,
    group,
    creatorCode: `organizer-secret-${i}`,
    provenance: "Organizer-only permission record",
    artifactSha256: String(i + 1).repeat(64),
    inputsSha256: "a".repeat(64),
    work: { tools: "Private tooling", minutes: 27, revisionPasses: 0 },
  }));
  return { ...plan, tasks: [task], samples } satisfies PilotManifest;
}
function answers(pilot: PilotManifest) {
  return {
    version: 1,
    benchmarkId: pilot.id,
    evaluations: pilot.samples.map((sample, i) => ({
      benchmarkId: pilot.id,
      reviewerCode: "r01",
      sampleId: sample.id,
      taskOutcome: "completed",
      judgedOrigin: "unsure",
      quality: {
        hierarchy: i + 2,
        typography: 4,
        composition: 6,
        distinctiveness: 4,
        interaction: 5,
        content: 5,
      },
      note: "",
    })),
  };
}
async function enter() {
  render(<BlindReviewRoom />);
  fireEvent.click(await screen.findByRole("button", { name: "Open private organizer workspace" }));
  return screen.getByLabelText(/open private organizer file/i);
}
describe("private three-way pilot organizer", () => {
  it("protects an unrecorded private submission on Back or close without persisting it", async () => {
    await enter();
    fireEvent.click(
      screen.getByRole("button", { name: "Compare original and redesigned booking" }),
    );
    const creator = await screen.findByLabelText("Creator code");
    fireEvent.change(creator, { target: { value: "private-creator" } });
    const close = new Event("beforeunload", { cancelable: true });
    fireEvent(window, close);
    expect(close.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Return to reviewer room" }));
    expect(screen.getByText("Leave this private draft?")).toBeVisible();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(downloadBlob).not.toHaveBeenCalled();
  });
  it("keeps private organizer material outside the participant view and saved session", async () => {
    localStorage.setItem(REVIEW_ROOM_KEY, JSON.stringify(createReviewSession(packetFixture())));
    render(<BlindReviewRoom />);
    await screen.findByRole("link", { name: /Open sample page/ });
    expect(screen.queryByRole("button", { name: /organizer workspace/ })).toBeNull();
    expect(screen.queryByText(/independent expert build/i)).toBeNull();
  });
  it("starts empty, masks a shuffled packet, and calculates matched ratings only from supplied files", async () => {
    const input = await enter();
    const pilot = manifest();
    fireEvent.click(screen.getByRole("button", { name: /start booking and editorial/i }));
    await screen.findByText(/0 of 6 submissions/);
    expect(screen.getByRole("button", { name: /download shuffled/i })).toBeDisabled();
    fireEvent.change(input, { target: { files: [file(pilot)] } });
    await screen.findByText(/3 of 3 submissions/);
    fireEvent.click(screen.getByRole("button", { name: /download shuffled/i }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(name).toBe("reviewer-packet.json");
    const masked = await readBlob(blob);
    expect(masked).not.toMatch(/organizer-secret|Organizer-only|Private tooling|inputsSha256/);
    expect(parseReviewerPacket(masked).samples).toHaveLength(3);
    const bundle = file(answers(pilot));
    fireEvent.change(screen.getByLabelText(/calculate results from answer files/i), {
      target: { files: [bundle] },
    });
    await screen.findByRole("heading", { name: "Matched findings" });
    expect(screen.getByText(/Reviewers: 1 · Answers: 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download findings" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2));
    const report = JSON.parse(await readBlob(vi.mocked(downloadBlob).mock.calls[1]![0]));
    expect(report.tasks[0].quality.hierarchy.remainingExpertGap).toBe(1);
    fireEvent.change(screen.getByLabelText(/calculate results from answer files/i), {
      target: { files: [bundle, bundle] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/each reviewer/i);
    expect(screen.queryByRole("button", { name: "Download findings" })).toBeNull();
    expect(localStorage.length).toBe(0);
  });
  it("rejects unsafe addresses and stale reads even when files finish out of order", async () => {
    const input = await enter();
    let finish!: (v: string) => void;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const bad = manifest();
    bad.samples[0]!.assetRef = "javascript:alert(0)";
    fireEvent.change(input, {
      target: { files: [Object.assign(new File([], "old.json"), { text: () => pending })] },
    });
    fireEvent.change(input, { target: { files: [file(bad)] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/without embedded credentials/);
    await act(async () => finish(JSON.stringify(manifest())));
    expect(screen.queryByText(/3 of 3 submissions/)).toBeNull();
  });
});

describe("original and Focus booking pilot", () => {
  function pair(): PilotManifest {
    const old = manifest();
    const [original, guided] = old.samples;
    return {
      ...createPilotPlan("pair-01", "booking-pair-v1"),
      samples: [{ ...original!, group: "original", work: null }, guided!],
    };
  }
  it("pairs only observations that the same reviewer recorded on both pages; missing time and expert data stay unknown", () => {
    const pilot = pair();
    const packet = createPilotPacket(
      pilot,
      pilot.samples.map((s) => s.id),
    );
    expect(JSON.stringify(packet)).not.toMatch(/"original"|organizer-secret|artifactSha256/);
    const baseline: BookingObservation = {
      firstResponse: "blocked",
      firstClass: "glaze",
      statedDollars: 56,
      elapsedSeconds: 90,
      recovery: "blocked",
      helpUsed: true,
      savedReservations: 2,
    };
    const guided: BookingObservation = {
      firstResponse: "lost-confirmation",
      firstClass: "wheel",
      statedDollars: 48,
      elapsedSeconds: null,
      recovery: "recovered",
      helpUsed: false,
      savedReservations: 1,
    };
    const rows = blindEvaluationBundleSchema.parse(answers(pilot)).evaluations;
    const report = scorePilot(pilot, [
      { ...rows[0]!, bookingObservation: baseline },
      { ...rows[1]!, bookingObservation: guided },
      { ...rows[0]!, reviewerCode: "unpaired", bookingObservation: baseline },
    ]);
    const task = report.tasks[0]!;
    expect(task.matchedReviewers).toBe(1);
    expect(report.humanEquivalence).toBe("inconclusive");
    expect(task.bookingObservations?.duplicateReservations).toMatchObject({
      original: 1,
      guided: 0,
      expert: null,
      reviewers: 1,
    });
    expect(task.bookingObservations?.firstChoiceCorrect).toMatchObject({
      original: 0,
      guided: 1,
      expert: null,
    });
    expect(task.bookingObservations?.encounteredPlannedLossFirst).toMatchObject({
      original: 0,
      guided: 1,
    });
    expect(task.bookingObservations?.firstSubmissionConfirmed).toMatchObject({
      original: 0,
      guided: 0,
    });
    expect(task.bookingObservations?.priceCorrect).toMatchObject({ original: 0, guided: 1 });
    expect(task.bookingObservations?.elapsedSeconds).toMatchObject({
      original: null,
      guided: null,
      reviewers: 0,
    });
    expect(task.bookingObservations?.helpUsed).toMatchObject({ original: 1, guided: 0 });
    expect(task.bookingObservations?.recovered).toMatchObject({ original: 0, guided: 1 });
    expect(task.bookingObservations?.oneReservation).toMatchObject({ original: 0, guided: 1 });
    expect(report.submissions[0]!.artifactSha256).toBe(pilot.samples[0]!.artifactSha256);
    expect(JSON.stringify(report)).not.toMatch(/Organizer-only|organizer-secret/);
    expect(() =>
      scorePilot(pilot, [{ ...rows[0]!, taskOutcome: "not-tested", bookingObservation: baseline }]),
    ).toThrow(/attempted interactive/);
    const generic = manifest();
    delete generic.tasks[0]!.observationProtocol;
    const oldRows = blindEvaluationBundleSchema.parse(answers(generic)).evaluations;
    expect(scorePilot(generic, oldRows).tasks[0]!.bookingObservations).toBeUndefined();
    expect(() => scorePilot(generic, [{ ...oldRows[0]!, bookingObservation: baseline }])).toThrow(
      /attempted interactive/,
    );
  });
  it("guides a newcomer to a pair with two interactive submissions and hides editor time for the original", async () => {
    await enter();
    fireEvent.click(
      screen.getByRole("button", { name: /compare original and redesigned booking/i }),
    );
    await screen.findByText(/1 task · 0 of 2 submissions/);
    fireEvent.click(screen.getByText("Add a real submission"));
    expect(screen.getByLabelText("Source")).toHaveValue("original");
    expect(screen.queryByLabelText("Tools used")).toBeNull();
    expect(screen.queryByRole("option", { name: "Image" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "guided" } });
    expect(screen.getByLabelText("Tools used")).toBeRequired();
    fireEvent.click(screen.getByLabelText("Build time and revision counts are unavailable"));
    expect(screen.queryByLabelText("Tools used")).toBeNull();
    expect(screen.getByRole("button", { name: /download shuffled/i })).toBeDisabled();
  });
  it("refuses unmapped sources, reused outputs and images for a real booking comparison", () => {
    const pilot = pair();
    pilot.samples[0]!.group = "expert";
    expect(() => createPilotPacket(pilot, [])).toThrow(/build sources/);
    pilot.samples[0]!.group = "original";
    pilot.samples[1]!.artifactSha256 = pilot.samples[0]!.artifactSha256;
    expect(() => createPilotPacket(pilot, [])).toThrow(/distinct outputs/);
    pilot.samples[0]!.kind = "image";
    expect(() => createPilotPacket(pilot, [])).toThrow(/interactive pages/);
  });
  it("keeps unknown production effort separate from observed task outcomes", () => {
    const pilot = pair();
    pilot.samples[1]!.work = null;
    expect(scorePilot(pilot, []).tasks[0]?.production["guided"]).toBeNull();
    const expertPilot: PilotManifest = manifest();
    expertPilot.samples[1]!.work = null;
    expect(() => scorePilot(expertPilot, [])).toThrow(/production records/);
  });
});

describe("independent River Kiln designer comparison", () => {
  it("offers the neutral builder download and requires a different creator and two real outputs", async () => {
    await enter();
    expect(screen.getByRole("link", { name: /download the designer brief/i })).toHaveAttribute(
      "download",
      "river-kiln-builder.zip",
    );
    const pilot = createPilotPlan("test-designer", "booking-designer-v1");
    const [, guided, expert] = manifest().samples;
    pilot.samples.push({ ...guided!, work: null });
    expect(() => createPilotPacket(pilot, [])).toThrow(/one submission from each/);
    pilot.samples.push(expert!);
    const packet = createPilotPacket(
      pilot,
      pilot.samples.map((s) => s.id),
    );
    expect(packet.samples).toHaveLength(2);
    expect(JSON.stringify(packet)).not.toMatch(/"expert"|"guided"|organizer-secret|Sha256/);
    expect(scorePilot(pilot, []).tasks[0]!.quality["hierarchy"]).toMatchObject({
      guided: null,
      expert: null,
      reviewers: 0,
    });
    pilot.samples[1]!.creatorCode = pilot.samples[0]!.creatorCode;
    expect(() => createPilotPacket(pilot, [])).toThrow(/independent expert/);
  });
});
