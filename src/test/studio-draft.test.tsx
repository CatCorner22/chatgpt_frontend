import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStudioDraft } from "@/hooks/useStudioDraft";
import { STUDIO_KEY } from "@/lib/projects";
import { EMPTY } from "@/lib/studio-state";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open() {
  const { result } = renderHook(useStudioDraft);
  act(() => result.current.restoreState({ ...EMPTY }, null));
  return result;
}

describe("Studio browser draft", () => {
  it("flushes the final edit in the same event, before React commits or an account saves", () => {
    const draft = open();
    act(() => {
      draft.current.setState((s) => ({ ...s, brief: "Final keystroke" }));
      window.dispatchEvent(new Event("pagehide"));
      expect(JSON.parse(localStorage.getItem(STUDIO_KEY)!)).toMatchObject({
        brief: "Final keystroke",
        savedHash: null,
        projectId: null,
      });
    });
    const write = vi.spyOn(Storage.prototype, "setItem");
    window.dispatchEvent(new Event("pagehide"));
    expect(write).not.toHaveBeenCalled();
  });

  it("retries a failed brief-only save before unload and allows leaving when storage recovers", () => {
    const draft = open();
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    act(() => draft.current.setState((s) => ({ ...s, brief: "Still here" })));
    expect(draft.current.issue).toMatch(/could not be saved/);
    const failed = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(failed);
    });
    expect(failed.defaultPrevented).toBe(true);
    write.mockRestore();
    const retried = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(retried);
    });
    expect(retried.defaultPrevented).toBe(false);
    expect(draft.current.issue).toBe("");
    expect(JSON.parse(localStorage.getItem(STUDIO_KEY)!).brief).toBe("Still here");
  });

  it("leaves a newer tab intact on idle exits and protects edits based on a stale snapshot", () => {
    const draft = open();
    const newer = JSON.stringify({ ...EMPTY, brief: "Other tab's brief" });
    localStorage.setItem(STUDIO_KEY, newer);
    const idle = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(idle);
    });
    expect(idle.defaultPrevented).toBe(false);
    expect(localStorage.getItem(STUDIO_KEY)).toBe(newer);
    const stale = new Event("beforeunload", { cancelable: true });
    act(() => {
      draft.current.setState((s) => ({ ...s, brief: "My unsaved edit" }));
      window.dispatchEvent(stale);
    });
    expect(stale.defaultPrevented).toBe(true);
    expect(draft.current.issue).toMatch(/Another tab/);
    expect(draft.current.state.brief).toBe("My unsaved edit");
    expect(localStorage.getItem(STUDIO_KEY)).toBe(newer);
  });

  it("detects a write the browser silently discarded", () => {
    const draft = open();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    act(() => draft.current.setState((s) => ({ ...s, brief: "Still in this tab" })));
    expect(draft.current.flush()).toBe(false);
    expect(draft.current.issue).toMatch(/could not be saved/);
    expect(JSON.parse(localStorage.getItem(STUDIO_KEY)!).brief).toBe("");
  });
});
