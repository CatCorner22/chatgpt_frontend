import { useLayoutEffect, useRef } from "react";

type Draft = {
  flush: () => boolean;
  handlesRouter: boolean;
};

// Registered only by mounted editors in this browser document. The offline reviewer also
// uses the native events, and has no router. A clean editor's flush must be a no-op.
const drafts = new Set<Draft>();

function flushDrafts(routerOnly: boolean): boolean {
  let saved = true;
  for (const draft of drafts) {
    if (routerOnly && draft.handlesRouter) continue;
    try {
      if (!draft.flush()) saved = false;
    } catch {
      saved = false;
    }
  }
  return saved;
}

export function flushRouterDrafts(): boolean {
  return flushDrafts(true);
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!flushDrafts(false)) {
    event.preventDefault();
    event.returnValue = "";
  }
}

function onPageHide() {
  flushDrafts(false);
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") flushDrafts(false);
}

/** Retry outstanding local edits during real departures, without saving during React cleanup.
 * Editors that supply their own navigation dialog also call flush from their router blocker.
 */
export function useDraftExitSave(flush: () => boolean, { handlesRouter = false } = {}) {
  const latest = useRef(flush);
  useLayoutEffect(() => {
    latest.current = flush;
  }, [flush]);
  useLayoutEffect(() => {
    const draft: Draft = { flush: () => latest.current(), handlesRouter };
    if (drafts.size === 0) {
      window.addEventListener("beforeunload", onBeforeUnload);
      window.addEventListener("pagehide", onPageHide);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    drafts.add(draft);
    return () => {
      drafts.delete(draft);
      if (drafts.size === 0) {
        window.removeEventListener("beforeunload", onBeforeUnload);
        window.removeEventListener("pagehide", onPageHide);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [handlesRouter]);
}
