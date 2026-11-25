import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { flushRouterDrafts, useDraftExitSave } from "@/hooks/useDraftExitSave";

function Editor({ save, ownGuard = false }: { save: () => boolean; ownGuard?: boolean }) {
  useDraftExitSave(save, { handlesRouter: ownGuard });
  return null;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("flushes every active editor on hide and retries on departure even when one fails", () => {
  const generic = vi.fn(() => false);
  const custom = vi.fn(() => true);
  const ui = render(
    <>
      <Editor save={generic} />
      <Editor save={custom} ownGuard />
    </>,
  );
  expect(flushRouterDrafts()).toBe(false);
  expect(custom).not.toHaveBeenCalled();

  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(generic).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(custom).toHaveBeenCalledTimes(1);

  const unload = () => window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
  expect(unload()).toBe(false);
  generic.mockReturnValue(true);
  expect(unload()).toBe(true);
  window.dispatchEvent(new Event("pagehide"));
  expect(custom).toHaveBeenCalledTimes(4);
  ui.unmount();
  window.dispatchEvent(new Event("pagehide"));
  expect(custom).toHaveBeenCalledTimes(4);
  expect(flushRouterDrafts()).toBe(true);
});

it("uses the most recent callback and lets other drafts save when one throws", () => {
  const old = vi.fn(() => true);
  const latest = vi.fn(() => {
    throw new Error("storage unavailable");
  });
  const sibling = vi.fn(() => true);
  const ui = render(
    <>
      <Editor save={old} />
      <Editor save={sibling} />
    </>,
  );
  ui.rerender(
    <>
      <Editor save={latest} />
      <Editor save={sibling} />
    </>,
  );
  act(() => expect(flushRouterDrafts()).toBe(false));
  expect(old).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
  expect(sibling).toHaveBeenCalledOnce();
});
