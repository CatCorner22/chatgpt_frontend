import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ initialize: vi.fn(), lock: vi.fn(), resume: vi.fn() }));
vi.mock("@/lib/browser-storage", () => ({
  isHostedBuild: () => import.meta.env["VITE_FOCUS_HOSTED"] === "true",
  initializeBrowserOwner: storage.initialize,
  lockBrowserOwner: storage.lock,
  resumeBrowserOwner: storage.resume,
}));
import { HostedBoundary, useHostedSession } from "@/components/HostedBoundary";

function Work() {
  const session = useHostedSession();
  const [note, setNote] = useState("");
  return (
    <div>
      Private work for {session?.user?.id ?? "portable"}
      <input
        aria-label="Unsaved note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    </div>
  );
}
const sessionResponse = (id: string) =>
  new Response(
    JSON.stringify({
      user: { id, email: `${id}@example.test` },
      storageAvailable: true,
      mode: "hosted",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "true");
  storage.initialize.mockClear();
  storage.lock.mockClear();
  storage.resume.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("hosted account boundary", () => {
  it("keeps routes unmounted until identity has been verified and storage scoped", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      ),
    );
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    expect(screen.queryByText(/Private work/)).not.toBeInTheDocument();
    await act(async () => resolve(sessionResponse("A")));
    expect(await screen.findByText("Private work for A")).toBeInTheDocument();
    expect(storage.initialize).toHaveBeenCalledWith("sites:A");
  });

  it("locks and unmounts work when a later account check reports another owner", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(sessionResponse("A"))
      .mockResolvedValueOnce(sessionResponse("B"));
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient();
    client.setQueryData(["ownerData"], "A confidential result");
    render(
      <HostedBoundary queryClient={client}>
        <Work />
      </HostedBoundary>,
    );
    await screen.findByText("Private work for A");
    await act(async () => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(screen.queryByText(/Private work/)).not.toBeInTheDocument());
    expect(storage.lock).toHaveBeenCalled();
    expect(client.getQueryData(["ownerData"])).toBeUndefined();
    expect(storage.initialize).not.toHaveBeenCalledWith("sites:B");
    expect(screen.getByRole("link", { name: /Reload securely/ })).toHaveAttribute("href", "/");
  });

  it("does not expose an old session if its response arrives after a newer check", async () => {
    let resolveOld!: (value: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolveOld = r;
          }),
      )
      .mockResolvedValueOnce(sessionResponse("B"));
    vi.stubGlobal("fetch", fetcher);
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    await act(async () => window.dispatchEvent(new Event("focus")));
    await screen.findByText("Private work for B");
    await act(async () => resolveOld(sessionResponse("A")));
    expect(screen.getByText("Private work for B")).toBeInTheDocument();
    expect(storage.initialize).not.toHaveBeenCalledWith("sites:A");
  });

  it("fails closed on an unavailable session service without removing saved work", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    expect(await screen.findByText(/could not verify your account/i)).toBeInTheDocument();
    expect(screen.queryByText(/Private work/)).not.toBeInTheDocument();
    expect(storage.lock).toHaveBeenCalled();
    expect(storage.initialize).not.toHaveBeenCalled();
  });

  it("requires sign-in for a missing production identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: null,
            storageAvailable: false,
            mode: "hosted",
          }),
        ),
      ),
    );
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    expect(await screen.findByRole("link", { name: /Sign in with ChatGPT/ })).toHaveAttribute(
      "href",
      "/signin-with-chatgpt",
    );
    expect(screen.queryByText(/Private work/)).not.toBeInTheDocument();
  });

  it("rejects preview identity responses in a production build", async () => {
    vi.stubEnv("DEV", false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: null,
            storageAvailable: false,
            mode: "preview",
          }),
        ),
      ),
    );
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    expect(await screen.findByText(/could not verify your account/i)).toBeInTheDocument();
    expect(storage.initialize).not.toHaveBeenCalled();
  });

  it("keeps portable builds usable without a session service", () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "false");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    expect(screen.getByText("Private work for portable")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds an unresponsive identity check and offers an explicit retry", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_001);
    });
    expect(screen.getByText(/could not verify your account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry account verification/ })).toBeEnabled();
    expect(storage.lock).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Retry account verification/ })).toBeEnabled();
  });

  it("preserves hidden unsaved React work across a failed check and same-owner retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(sessionResponse("A"))
        .mockRejectedValueOnce(new TypeError("offline"))
        .mockResolvedValueOnce(sessionResponse("A")),
    );
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    await screen.findByText("Private work for A");
    fireEvent.change(screen.getByRole("textbox", { name: "Unsaved note" }), {
      target: { value: "Keep this unsaved draft" },
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    await screen.findByRole("button", { name: /Retry account verification/ });
    expect(screen.getByText("Private work for A")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Retry account verification/ }));
    await waitFor(() => expect(screen.getByText("Private work for A")).toBeVisible());
    expect(screen.getByRole("textbox", { name: "Unsaved note" })).toHaveValue(
      "Keep this unsaved draft",
    );
    expect(storage.resume).toHaveBeenCalledWith("sites:A");
  });

  it("hides an existing session while a foreground check is pending and never reveals it to a changed owner", async () => {
    let resolveCheck!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(sessionResponse("A"))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveCheck = resolve;
            }),
        ),
    );
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    await screen.findByText("Private work for A");
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(screen.getByText("Private work for A")).not.toBeVisible();
    await act(async () => resolveCheck(sessionResponse("B")));
    expect(screen.queryByText("Private work for A")).not.toBeInTheDocument();
    expect(storage.resume).not.toHaveBeenCalledWith("sites:B");
  });

  it("rejects unexpectedly large identity responses before mounting private routes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: { id: "A", email: "a".repeat(17_000) },
            mode: "hosted",
            storageAvailable: true,
          }),
        ),
      ),
    );
    render(
      <HostedBoundary queryClient={new QueryClient()}>
        <Work />
      </HostedBoundary>,
    );
    expect(await screen.findByText(/could not verify your account/i)).toBeInTheDocument();
    expect(screen.queryByText(/Private work/)).not.toBeInTheDocument();
  });
});
