import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bookingProtocol } from "../../north-star-kit/blind-test/reviewer";
import { PreparedBookingRoom } from "@/components/PreparedBookingRoom";
import { REVIEW_ROOM_KEY } from "@/lib/review-room";
import { packetFixture } from "./review-room.fixture";

function localPacket() {
  const packet = packetFixture();
  packet.tasks[0]!.observationProtocol = bookingProtocol;
  packet.samples.forEach((sample, i) => {
    sample.kind = "interactive";
    sample.assetRef = "http://127.0.0.1:" + (5100 + i) + "/";
  });
  return packet;
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("prepared local booking review", () => {
  it("loads an anonymous study, restores this tab's answers and keeps source and file controls outside the participant view", async () => {
    const packet = localPacket();
    const fetch = vi.fn(async () => Response.json(packet));
    vi.stubGlobal("fetch", fetch);
    const initial = render(<PreparedBookingRoom />);
    const input = await screen.findByLabelText("Your reviewer code");
    expect(fetch).toHaveBeenCalledWith(
      "/packet.json",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /organizer workspace/ })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    fireEvent.change(input, { target: { value: "  moonflower-2 " } });
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    const link = await screen.findByRole("link", { name: /Open sample page/ });
    expect(link).toHaveAttribute("href", packet.samples[0]!.assetRef);
    expect(screen.getByLabelText("Your reviewer code")).toHaveValue("moonflower-2");
    expect(screen.getByLabelText("Your reviewer code")).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("radio", { name: "Blocked" }));
    await waitFor(() =>
      expect(sessionStorage.getItem(REVIEW_ROOM_KEY)).toContain('"taskOutcome":"blocked"'),
    );
    expect(localStorage.getItem(REVIEW_ROOM_KEY)).toBeNull();
    const close = new Event("beforeunload", { cancelable: true });
    fireEvent(window, close);
    expect(close.defaultPrevented).toBe(true);
    initial.unmount();
    render(<PreparedBookingRoom />);
    expect(await screen.findByRole("radio", { name: "Blocked" })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Start review" })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("ignores an older session if the launcher changed either sample", async () => {
    const packet = localPacket();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(packet)),
    );
    const first = render(<PreparedBookingRoom />);
    fireEvent.change(await screen.findByLabelText("Your reviewer code"), {
      target: { value: "first-user" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    await waitFor(() => expect(sessionStorage.getItem(REVIEW_ROOM_KEY)).toContain("first-user"));
    first.unmount();
    packet.samples[1]!.assetRef = "http://127.0.0.1:7500/";
    render(<PreparedBookingRoom />);
    expect(await screen.findByLabelText("Your reviewer code")).toHaveValue("");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("refuses nonlocal and duplicate sample origins, then retries the current packet", async () => {
    const valid = localPacket();
    const remote = localPacket();
    remote.samples[0]!.assetRef = "https://review.invalid/";
    const duplicate = localPacket();
    duplicate.samples[1]!.assetRef = duplicate.samples[0]!.assetRef + "b";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(remote))
        .mockResolvedValueOnce(Response.json(duplicate))
        .mockResolvedValueOnce(Response.json(valid)),
    );
    render(<PreparedBookingRoom />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Start review" })).toBeEnabled();
  });
});
