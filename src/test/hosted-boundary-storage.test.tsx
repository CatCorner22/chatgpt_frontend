import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostedBoundary } from "@/components/HostedBoundary";
import {
  focusLocalStorage,
  focusSessionStorage,
  getBrowserOwnerId,
  initializeBrowserOwner,
  resumeBrowserOwner,
} from "@/lib/browser-storage";
import { deferred } from "./deferred";

function Work() {
  const [note, setNote] = useState("");
  return (
    <input
      aria-label="Unpersisted draft"
      value={note}
      onChange={(event) => setNote(event.target.value)}
    />
  );
}
const response = (id: string) =>
  new Response(
    JSON.stringify({
      mode: "hosted",
      user: { id, email: null },
      storageAvailable: true,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
const events = {
  focus: () => window.dispatchEvent(new Event("focus")),
  visibility: () => document.dispatchEvent(new Event("visibilitychange")),
  pageshow: () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
};
function expectLocked() {
  expect(() => getBrowserOwnerId()).toThrow(/session/i);
  expect(() => focusLocalStorage.getItem("draft")).toThrow(/session/i);
  expect(() => focusLocalStorage.setItem("draft", "late overwrite")).toThrow(/session/i);
  expect(() => focusSessionStorage.setItem("pending", "late transfer")).toThrow(/session/i);
}
function mount() {
  return render(
    <HostedBoundary queryClient={new QueryClient()}>
      <Work />
    </HostedBoundary>,
  );
}
beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "true");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  // Use the real immutable document owner across tests; each case starts unlocked.
  try {
    resumeBrowserOwner("sites:A");
  } catch {
    initializeBrowserOwner("sites:A");
  }
  localStorage.clear();
  sessionStorage.clear();
  focusLocalStorage.setItem("draft", "Saved A draft");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("protective hosted checks with real owner storage", () => {
  it.each(["focus", "visibility", "pageshow"] as const)(
    "locks synchronously before a %s request and resumes the same owner's intact draft",
    async (event) => {
      const check = deferred<Response>();
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(response("A"))
        .mockImplementationOnce(() => {
          expectLocked();
          return check.promise;
        });
      vi.stubGlobal("fetch", fetcher);
      mount();
      fireEvent.change(await screen.findByRole("textbox", { name: "Unpersisted draft" }), {
        target: { value: "In-memory work" },
      });
      await act(async () => {
        events[event]();
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expectLocked();
      expect(screen.getByLabelText("Unpersisted draft")).not.toBeVisible();
      await act(async () => check.resolve(response("A")));
      await waitFor(() => expect(screen.getByLabelText("Unpersisted draft")).toBeVisible());
      expect(screen.getByLabelText("Unpersisted draft")).toHaveValue("In-memory work");
      expect(getBrowserOwnerId()).toBe("A");
      expect(focusLocalStorage.getItem("draft")).toBe("Saved A draft");
      expect(focusSessionStorage.getItem("pending")).toBeNull();
    },
  );

  it("keeps owner access blocked when a protective response identifies another account", async () => {
    const check = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response("A")).mockReturnValueOnce(check.promise),
    );
    mount();
    await screen.findByRole("textbox", { name: "Unpersisted draft" });
    await act(async () => {
      events.focus();
    });
    expectLocked();
    await act(async () => check.resolve(response("B")));
    expect(await screen.findByRole("link", { name: "Reload securely" })).toBeVisible();
    expectLocked();
    expect(screen.queryByLabelText("Unpersisted draft")).not.toBeInTheDocument();
    expect(localStorage.getItem("focus:owner:v1:sites%3AA:draft")).toBe("Saved A draft");
  });

  it("keeps explicit retry locked until its same-owner response succeeds", async () => {
    const retry = deferred<Response>();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response("A"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => {
        expectLocked();
        return retry.promise;
      });
    vi.stubGlobal("fetch", fetcher);
    mount();
    fireEvent.change(await screen.findByRole("textbox", { name: "Unpersisted draft" }), {
      target: { value: "Keep this draft" },
    });
    await act(async () => {
      events.focus();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Retry account verification" }));
    expectLocked();
    await act(async () => retry.resolve(response("A")));
    await waitFor(() => expect(screen.getByLabelText("Unpersisted draft")).toBeVisible());
    expect(screen.getByLabelText("Unpersisted draft")).toHaveValue("Keep this draft");
    expect(getBrowserOwnerId()).toBe("A");
  });

  it("can finish an initial check protected by focus when this document already owns the same account", async () => {
    const initial = deferred<Response>(),
      protective = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(protective.promise),
    );
    mount();
    await act(async () => {
      events.focus();
    });
    expectLocked();
    await act(async () => protective.resolve(response("A")));
    expect(await screen.findByRole("textbox", { name: "Unpersisted draft" })).toBeVisible();
    expect(getBrowserOwnerId()).toBe("A");
    await act(async () => initial.resolve(response("B")));
    expect(getBrowserOwnerId()).toBe("A");
    expect(screen.getByLabelText("Unpersisted draft")).toBeVisible();
  });

  it("cannot initialize a different account through the locked-document resume fallback", async () => {
    const initial = deferred<Response>(),
      protective = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(protective.promise),
    );
    mount();
    await act(async () => {
      events.focus();
    });
    expectLocked();
    await act(async () => protective.resolve(response("B")));
    expect(await screen.findByText(/could not verify your account/i)).toBeVisible();
    expectLocked();
    expect(screen.queryByLabelText("Unpersisted draft")).not.toBeInTheDocument();
    await act(async () => initial.resolve(response("A")));
    expectLocked();
    expect(localStorage.getItem("focus:owner:v1:sites%3AA:draft")).toBe("Saved A draft");
  });

  it("does not let an older successful response unlock a newer protective request", async () => {
    const first = deferred<Response>(),
      second = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response("A"))
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    );
    mount();
    await screen.findByRole("textbox", { name: "Unpersisted draft" });
    await act(async () => {
      events.focus();
      events.visibility();
    });
    expectLocked();
    await act(async () => first.resolve(response("A")));
    expectLocked();
    expect(screen.getByLabelText("Unpersisted draft")).not.toBeVisible();
    await act(async () => second.resolve(response("A")));
    await waitFor(() => expect(screen.getByLabelText("Unpersisted draft")).toBeVisible());
    expect(getBrowserOwnerId()).toBe("A");
  });

  it("preserves normal background checks without hiding or locking the active draft", async () => {
    vi.useFakeTimers();
    const background = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response("A")).mockReturnValueOnce(background.promise),
    );
    await act(async () => {
      mount();
    });
    expect(screen.getByLabelText("Unpersisted draft")).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(getBrowserOwnerId()).toBe("A");
    expect(screen.getByLabelText("Unpersisted draft")).toBeVisible();
    await act(async () => background.resolve(response("A")));
    expect(getBrowserOwnerId()).toBe("A");
  });
});
