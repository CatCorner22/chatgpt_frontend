import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExportReceipt } from "@/hooks/useExportReceipt";

const owner = vi.hoisted(() => vi.fn());
vi.mock("@/lib/browser-storage", () => ({ getBrowserOwnerId: owner }));
beforeEach(() => owner.mockReset().mockReturnValue("owner-a"));

describe("export receipt lifetime", () => {
  it("does not let a retained old acknowledgment consume a newer receipt", () => {
    const { result } = renderHook(() => useExportReceipt("exact design", "owner-a"));
    const first = vi.fn();
    const second = vi.fn();
    act(() => result.current.offer(result.current.begin(), "first.zip", first));
    const staleConfirm = result.current.pending!.confirm;
    act(() => result.current.offer(result.current.begin(), "second.zip", second));
    act(staleConfirm);
    expect(first).not.toHaveBeenCalled();
    expect(result.current.pending?.filename).toBe("second.zip");
    const confirm = result.current.pending!.confirm;
    act(confirm);
    act(confirm);
    expect(second).toHaveBeenCalledOnce();
    expect(result.current.pending).toBeNull();
  });

  it.each(["snapshot", "session"] as const)(
    "does not revive a request after an intervening %s change is reversed",
    (field) => {
      const initial = { snapshot: "exact design A", session: "owner-a" };
      const { result, rerender } = renderHook(
        ({ snapshot, session }) => useExportReceipt(snapshot, session),
        { initialProps: initial },
      );
      const confirmed = vi.fn();
      let request!: ReturnType<typeof result.current.begin>;
      act(() => {
        request = result.current.begin();
        result.current.offer(request, "original.zip", confirmed);
      });
      const retained = result.current.pending!.confirm;
      rerender({ ...initial, [field]: "different" });
      rerender(initial);
      act(() => {
        retained();
        result.current.offer(request, "late.zip", confirmed);
      });
      expect(result.current.isCurrent(request)).toBe(false);
      expect(result.current.pending).toBeNull();
      expect(confirmed).not.toHaveBeenCalled();
    },
  );

  it("invalidates retained confirmations and pending completions on unmount", () => {
    const { result, unmount } = renderHook(() => useExportReceipt("exact design", null));
    const confirmed = vi.fn();
    let request!: ReturnType<typeof result.current.begin>;
    act(() => {
      request = result.current.begin();
      result.current.offer(request, "original.zip", confirmed);
    });
    const receipt = result.current;
    const retained = receipt.pending!.confirm;
    unmount();
    retained();
    receipt.offer(request, "late.zip", confirmed);
    expect(receipt.isCurrent(request)).toBe(false);
    expect(confirmed).not.toHaveBeenCalled();
  });
});
