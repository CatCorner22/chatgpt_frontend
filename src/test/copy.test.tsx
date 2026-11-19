import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCopied } from "@/hooks/useUx";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("honest clipboard feedback", () => {
  it("returns false and never confirms a failed copy", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    const { result } = renderHook(() => useCopied());
    let success;
    await act(async () => {
      success = await result.current.copy("rx", "design");
    });
    expect(success).toBe(false);
    expect(result.current.copied).toBeNull();
  });
  it("confirms successful copies for two seconds and cleans up on unmount", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { result, unmount } = renderHook(() => useCopied());
    await act(async () => {
      expect(await result.current.copy("rx", "design")).toBe(true);
    });
    expect(result.current.copied).toBe("rx");
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.copied).toBeNull();
    await act(async () => {
      await result.current.copy("rx", "design");
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

function delayedCopy() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("clipboard request lifetime", () => {
  it("does not start overlapping writes or report the second request as copied", async () => {
    const pending = delayedCopy();
    const writeText = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { result } = renderHook(() => useCopied());
    let first!: Promise<boolean>;
    act(() => {
      first = result.current.copy("first", "first handoff");
    });
    let second!: Promise<boolean>;
    act(() => {
      second = result.current.copy("second", "second handoff");
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await second).toBe(false);
    await act(async () => {
      pending.resolve();
      expect(await first).toBe(true);
    });
    expect(result.current.copied).toBe("first");
  });

  it("clears old success feedback while a new write is pending", async () => {
    const pending = delayedCopy();
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockReturnValueOnce(pending.promise);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { result } = renderHook(() => useCopied());
    await act(async () => {
      await result.current.copy("first", "first handoff");
    });
    let second!: Promise<boolean>;
    act(() => {
      second = result.current.copy("second", "second handoff");
    });
    expect(result.current.copied).toBeNull();
    await act(async () => {
      pending.resolve();
      await second;
    });
    expect(result.current.copied).toBe("second");
  });

  it.each(["resolve", "reject"] as const)("ignores a pending %s after unmount", async (outcome) => {
    vi.useFakeTimers();
    const pending = delayedCopy();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockReturnValue(pending.promise) },
    });
    const { result, unmount } = renderHook(() => useCopied());
    let request!: Promise<boolean>;
    act(() => {
      request = result.current.copy("handoff", "private handoff");
    });
    unmount();
    await act(async () => {
      if (outcome === "resolve") pending.resolve();
      else pending.reject(new Error("late failure"));
      expect(await request).toBe(false);
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
