import { useBlocker } from "@tanstack/react-router";

export type StudioNavigationRisk = {
  persistenceFailed: boolean;
  busy: boolean;
};

/** One Studio-owned SPA guard; existing useLeaveGuard owns full-page unloads. */
export function useStudioNavigationGuard({ persistenceFailed, busy }: StudioNavigationRisk): void {
  useBlocker({
    enableBeforeUnload: false,
    shouldBlockFn: ({ next }) => {
      if (!persistenceFailed && !busy) return false;
      // Garden and Studio share a pathname. Search changes matter only when
      // they unmount Studio; moving within its query view keeps the work alive.
      if (next.pathname === "/" && "view" in next.search && next.search.view === "studio")
        return false;
      const reason = persistenceFailed
        ? "Your latest work could not be saved completely. Before leaving, retry saving or download a copy."
        : "A studio task is still running. Leaving may interrupt it or hide its result.";
      try {
        return !window.confirm(`${reason}\n\nLeave the studio anyway?`);
      } catch {
        // If the browser refuses the dialog, no approval to discard work exists.
        return true;
      }
    },
  });
}
