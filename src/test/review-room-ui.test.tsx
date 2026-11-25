import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlindReviewRoom } from "@/components/BlindReviewRoom";
import { createReviewSession, REVIEW_ROOM_KEY, reviewAnswerBundle } from "@/lib/review-room";
import { bookingProtocol } from "../../north-star-kit/blind-test/reviewer";
import { packetFixture } from "./review-room.fixture";

vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Review workspace</header> }));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("review room workflow", () => {
  function openCompletedBooking() {
    const packet = packetFixture();
    packet.tasks[0]!.observationProtocol = bookingProtocol;
    const review = createReviewSession(packet);
    review.reviewerCode = "r-27";
    review.drafts["sample-a"] = {
      ...review.drafts["sample-a"]!,
      taskOutcome: "completed",
      judgedOrigin: "unsure",
      quality: {
        hierarchy: 4,
        typography: 5,
        composition: 4,
        distinctiveness: 5,
        interaction: 4,
        content: 5,
      },
    };
    localStorage.setItem(REVIEW_ROOM_KEY, JSON.stringify(review));
    return render(<BlindReviewRoom />);
  }
  it("restores unfinished numeric text and keeps that sample out of the download", async () => {
    const first = openCompletedBooking();
    const price = await screen.findByLabelText(/Price you stated before submitting/);
    fireEvent.change(price, { target: { value: "48" } });
    fireEvent.change(price, { target: { value: "." } });
    first.unmount();
    render(<BlindReviewRoom />);
    expect(await screen.findByLabelText(/Price you stated before submitting/)).toHaveValue(".");
    expect(screen.getByRole("button", { name: /Download partial answers/ })).toBeDisabled();
  });
  it("keeps observations editable after switching a sample to Not tested and back", async () => {
    const first = openCompletedBooking();
    fireEvent.change(await screen.findByLabelText(/Price you stated before submitting/), {
      target: { value: "47.50" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Not tested" }));
    const saved = JSON.parse(localStorage.getItem(REVIEW_ROOM_KEY)!);
    expect(reviewAnswerBundle(saved, true).evaluations[0]).not.toHaveProperty("bookingObservation");
    first.unmount();
    render(<BlindReviewRoom />);
    expect(await screen.findByRole("radio", { name: "Not tested" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Completed" }));
    expect(
      (screen.getByLabelText(/Price you stated before submitting/) as HTMLInputElement).value,
    ).toBe("47.50");
  });
  it("retries the last edited answer on departure after browser storage recovers", async () => {
    const original = JSON.stringify(createReviewSession(packetFixture()));
    localStorage.setItem(REVIEW_ROOM_KEY, original);
    render(<BlindReviewRoom />);
    const note = await screen.findByLabelText(/What stood out/);
    const failing = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    fireEvent.change(note, { target: { value: "The price was visible immediately." } });
    expect(localStorage.getItem(REVIEW_ROOM_KEY)).toBe(original);
    const blocked = new Event("beforeunload", { cancelable: true });
    fireEvent(window, blocked);
    expect(blocked.defaultPrevented).toBe(true);
    failing.mockRestore();
    const allowed = new Event("beforeunload", { cancelable: true });
    fireEvent(window, allowed);
    expect(allowed.defaultPrevented).toBe(false);
    const saved = JSON.parse(localStorage.getItem(REVIEW_ROOM_KEY)!);
    expect(saved.drafts[saved.order[0]].note).toBe("The price was visible immediately.");
    expect(saved.drafts[saved.order[0]].judgedOrigin).toBeNull();
  });
  it("recovers multiple edits after an uncertain write followed by a rejected write", async () => {
    localStorage.setItem(REVIEW_ROOM_KEY, JSON.stringify(createReviewSession(packetFixture())));
    render(<BlindReviewRoom />);
    const note = await screen.findByLabelText(/What stood out/);
    const get = Storage.prototype.getItem;
    const reads = vi.spyOn(Storage.prototype, "getItem");
    reads.mockImplementationOnce(get).mockImplementationOnce(() => {
      throw new Error("Readback unavailable");
    });
    fireEvent.change(note, { target: { value: "First saved answer" } });
    reads.mockRestore();
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("Quota exceeded");
    });
    fireEvent.change(note, { target: { value: "Second answer" } });
    writes.mockRestore();
    fireEvent(window, new Event("pagehide"));
    expect(localStorage.getItem(REVIEW_ROOM_KEY)).toContain("Second answer");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each(["cleared", "edited"])(
    "preserves a review %s in another tab during edit, exit and reset",
    async (change) => {
      const initial = createReviewSession(packetFixture());
      localStorage.setItem(REVIEW_ROOM_KEY, JSON.stringify(initial));
      render(<BlindReviewRoom />);
      const note = await screen.findByLabelText(/What stood out/);
      const newer =
        change === "cleared" ? null : JSON.stringify({ ...initial, reviewerCode: "updated-code" });
      if (newer === null) localStorage.removeItem(REVIEW_ROOM_KEY);
      else localStorage.setItem(REVIEW_ROOM_KEY, newer);
      fireEvent(window, new Event("pagehide"));
      expect(localStorage.getItem(REVIEW_ROOM_KEY)).toBe(newer);
      fireEvent.change(note, { target: { value: "A different observation" } });
      expect(screen.getByRole("alert")).toHaveTextContent(/another tab/i);
      fireEvent(window, new Event("pagehide"));
      expect(localStorage.getItem(REVIEW_ROOM_KEY)).toBe(newer);
      fireEvent.click(screen.getByRole("button", { name: "Clear this review" }));
      fireEvent.click(screen.getByRole("button", { name: "Clear review" }));
      expect(localStorage.getItem(REVIEW_ROOM_KEY)).toBe(newer);
    },
  );
  it("keeps the latest packet when an older read finishes last", async () => {
    let finish!: (value: string) => void;
    const older = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const makeFile = (read: () => Promise<string>) =>
      Object.assign(new File([], "packet.json"), { text: read });
    render(
      <StrictMode>
        <BlindReviewRoom />
      </StrictMode>,
    );
    const input = await screen.findByLabelText("Reviewer packet · JSON, up to 2 MB");
    fireEvent.change(input, { target: { files: [makeFile(() => older)] } });
    const latest = packetFixture();
    latest.samples.reverse();
    fireEvent.change(input, { target: { files: [makeFile(async () => JSON.stringify(latest))] } });
    await screen.findByRole("link", { name: /Open image/ });
    await act(async () => finish(JSON.stringify(packetFixture())));
    expect(JSON.parse(localStorage.getItem(REVIEW_ROOM_KEY)!).order).toEqual([
      "sample-b",
      "sample-a",
    ]);
  });
  it("keeps the organizer’s planned order when a packet is uploaded and the page reloads", async () => {
    const packet = packetFixture();
    packet.samples.reverse();
    const file = new File([JSON.stringify(packet)], "reviewer-packet.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", { value: async () => JSON.stringify(packet) });
    const first = render(<BlindReviewRoom />);
    const upload = await screen.findByLabelText("Reviewer packet · JSON, up to 2 MB");
    fireEvent.change(upload, { target: { files: [file] } });
    expect(await screen.findByRole("link", { name: /Open image/ })).toHaveAttribute(
      "href",
      "https://review.test/b",
    );
    expect(screen.getByRole("status")).toHaveTextContent("order supplied by the organizer");
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(REVIEW_ROOM_KEY)!).order).toEqual([
        "sample-b",
        "sample-a",
      ]),
    );
    first.unmount();
    render(<BlindReviewRoom />);
    expect(await screen.findByRole("link", { name: /Open image/ })).toHaveAttribute(
      "href",
      "https://review.test/b",
    );
    expect(JSON.parse(localStorage.getItem(REVIEW_ROOM_KEY)!).order).toEqual([
      "sample-b",
      "sample-a",
    ]);
  });
  it("starts with a packet upload instead of invented reviewer results", async () => {
    render(<BlindReviewRoom />);
    expect(
      await screen.findByRole("heading", { name: "Bring your reviewer packet" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Reviewer packet · JSON, up to 2 MB")).toHaveAttribute(
      "type",
      "file",
    );
    expect(screen.queryByRole("link", { name: /Open sample/ })).not.toBeInTheDocument();
  });
  it("blocks advancing until complete, then restores the same sample and ratings after reload", async () => {
    const session = createReviewSession(packetFixture(), (limit) => limit - 1);
    localStorage.setItem(REVIEW_ROOM_KEY, JSON.stringify(session));
    const first = render(<BlindReviewRoom />);
    expect(await screen.findByRole("heading", { name: "Sample 1 of 2" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Open sample page/ });
    expect(link).toHaveAttribute("href", "https://review.test/a");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(screen.getByRole("button", { name: "Save & next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Complete these answers");
    expect(screen.getByRole("heading", { name: "Sample 1 of 2" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your reviewer code"), {
      target: { value: "reviewer-11" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Completed" }));
    for (const title of [
      "Hierarchy",
      "Reading and typography",
      "Composition and detail",
      "Fit and distinctiveness",
      "Interaction clarity",
      "Content and credibility",
    ])
      // Select the exact accessible label without rescanning every radio's style tree.
      fireEvent.click(screen.getByLabelText(`4 of 7 for ${title}`));
    fireEvent.click(screen.getByRole("radio", { name: "Unsure" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & next" }));
    expect(await screen.findByRole("heading", { name: "Sample 2 of 2" })).toBeInTheDocument();
    expect(
      screen.getByText("Not rated: interaction cannot be assessed from this image."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(REVIEW_ROOM_KEY)!).currentIndex).toBe(1),
    );
    first.unmount();
    render(<BlindReviewRoom />);
    expect(await screen.findByRole("heading", { name: "Sample 2 of 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: "4 of 7 for Hierarchy" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Unsure" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Download partial answers (1 of 2)" })).toBeEnabled();
  });
});
