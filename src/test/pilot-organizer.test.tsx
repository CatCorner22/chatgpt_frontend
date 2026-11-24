import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlindReviewRoom } from "@/components/BlindReviewRoom";
import { createReviewSession, parseReviewerPacket, REVIEW_ROOM_KEY } from "@/lib/review-room";
import { downloadBlob } from "@/lib/download-blob";
import { createPilotPlan, type PilotManifest } from "../../north-star-kit/blind-test/pilot";
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
