import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCopied } from "@/hooks/useUx";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
afterEach(() => {
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
  });
});
