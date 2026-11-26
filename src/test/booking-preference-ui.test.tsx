import { Blob as NodeBlob } from "node:buffer";
import { createHash, webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingProtocol } from "../../north-star-kit/blind-test/reviewer";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { createReviewSession, REVIEW_ROOM_KEY, reviewAnswerBundle } from "@/lib/review-room";
import { packetFixture } from "./review-room.fixture";

const question = "Which booking page would you choose to use again?";
const downloads = new Map<string, Blob>();
const objectUrls = new Map<string, Blob>();

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL(blob: Blob) {
        const url = "blob:http://localhost/" + objectUrls.size;
        objectUrls.set(url, blob);
        return url;
      }
      static override revokeObjectURL(url: string) {
        objectUrls.delete(url);
      }
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.set(this.download, objectUrls.get(this.href)!);
  });
});
afterEach(() => {
  cleanup();
  downloads.clear();
  objectUrls.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openSession(complete = true) {
  const packet = packetFixture();
  packet.tasks[0]!.observationProtocol = bookingProtocol;
  packet.samples.reverse();
  packet.samples.forEach((sample, index) => {
    sample.kind = "interactive";
    sample.label = index ? "Sample B" : "Sample A";
    sample.assetRef = "http://127.0.0.1:" + (5100 + index) + "/";
  });
  const session = createReviewSession(packet);
  session.reviewerCode = "tester-8";
  session.currentIndex = 1;
  for (const id of complete ? session.order : session.order.slice(0, 1)) {
    session.drafts[id] = {
      taskOutcome: "completed",
      judgedOrigin: "unsure",
      quality: {
        hierarchy: 5,
        typography: 4,
        composition: 3,
        distinctiveness: 5,
        interaction: 6,
        content: 7,
      },
      note: "The label “土” was clear.",
    };
  }
  sessionStorage.setItem(REVIEW_ROOM_KEY, JSON.stringify(session));
  render(<ReviewWorkspace preparedPacket={session.packet} />);
  return session;
}

async function finish() {
  fireEvent.click(await screen.findByRole("button", { name: "Finish review" }));
  return screen.findByRole("button", { name: "Download all answers" });
}

describe("optional booking preference after the primary review", () => {
  it.each([
    ["Sample A", { kind: "sample", sampleId: "sample-b" }],
    ["Sample B", { kind: "sample", sampleId: "sample-a" }],
    ["No preference", { kind: "no-preference" }],
    ["Could not compare", { kind: "could-not-compare" }],
  ] as const)(
    "exports %s for this exact review without changing its answers",
    async (label, choice) => {
      const session = openSession();
      const exportAnswers = await finish();
      expect(screen.queryByText(question)).not.toBeInTheDocument();
      fireEvent.click(exportAnswers);
      expect(await screen.findByText(question)).toBeVisible();
      const primary = await downloads.get("review-answers.json")!.text();
      expect(primary).toBe(JSON.stringify(reviewAnswerBundle(session), null, 2));
      const exportPreference = screen.getByRole("button", { name: /download preference/i });
      expect(exportPreference).toBeDisabled();
      fireEvent.click(screen.getByLabelText(label));
      fireEvent.click(exportPreference);
      await waitFor(() => expect(downloads.has("review-preference.json")).toBe(true));
      expect(JSON.parse(await downloads.get("review-preference.json")!.text())).toEqual({
        version: 1,
        kind: "booking-preference",
        benchmarkId: session.packet.benchmarkId,
        reviewerCode: session.reviewerCode,
        sampleIds: ["sample-b", "sample-a"],
        answersSha256: createHash("sha256").update(primary, "utf8").digest("hex"),
        choice,
      });
      expect(await downloads.get("review-answers.json")!.text()).toBe(primary);
    },
  );

  it("keeps the ballot closed after a partial or failed primary export", async () => {
    openSession(false);
    fireEvent.click(await screen.findByRole("button", { name: /Download partial answers/ }));
    await waitFor(() => expect(downloads.has("review-answers-partial.json")).toBe(true));
    expect(screen.queryByText(question)).not.toBeInTheDocument();
    cleanup();
    openSession();
    const exportAnswers = await finish();
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => {
      throw new Error("Download unavailable");
    });
    fireEvent.click(exportAnswers);
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText(question)).not.toBeInTheDocument();
    expect(downloads.has("review-answers.json")).toBe(false);
  });

  it("requires a new full export after an edit and removes the ballot when cleared", async () => {
    openSession();
    fireEvent.click(await finish());
    await screen.findByText(question);
    fireEvent.click(screen.getByRole("button", { name: "Review my answers" }));
    fireEvent.change(screen.getByLabelText(/What stood out/), {
      target: { value: "Revised note" },
    });
    const exportAgain = await finish();
    expect(screen.queryByText(question)).not.toBeInTheDocument();
    fireEvent.click(exportAgain);
    await screen.findByText(question);
    fireEvent.click(screen.getByRole("button", { name: "Clear this review" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear review" }));
    expect(await screen.findByRole("button", { name: "Start review" })).toBeVisible();
    expect(screen.queryByText(question)).not.toBeInTheDocument();
  });
});
