import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { focusLocalStorage } from "@/lib/browser-storage";
import { readLibrarySnapshot, withVersion, writeLibrary, type LibraryState } from "@/lib/library";
import { changedElsewhere, writeCurrentDraft } from "@/lib/studio-draft-storage";
import { EMPTY, type State } from "@/lib/studio-state";
import { useDraftExitSave } from "./useDraftExitSave";

export function archiveStudioDraft(state: State) {
  if (!state.tokens || !state.content || !state.libraryId) return;
  const { entries, raw } = readLibrarySnapshot();
  const next = withVersion(entries, state as unknown as LibraryState, new Date().toISOString());
  writeLibrary(next, focusLocalStorage, raw);
}

export function useStudioDraft() {
  const [state, renderState] = useState(EMPTY);
  const [issue, setIssue] = useState("");
  const latest = useRef(EMPTY);
  const baseline = useRef<string | null | undefined>(undefined);
  const archived = useRef<State | null>(null);

  // A change and a navigation can share one event. Expose the accepted edit to
  // the exit callback before React schedules its next render or passive effect.
  const setState = useCallback((action: SetStateAction<State>) => {
    latest.current = typeof action === "function" ? action(latest.current) : action;
    renderState(latest.current);
  }, []);

  const restoreState = useCallback(
    (next: State, expected: string | null) => {
      baseline.current = writeCurrentDraft(next, expected);
      setState(next);
    },
    [setState],
  );

  const flush = useCallback(() => {
    const draft = latest.current;
    if (baseline.current === undefined || archived.current === draft) return true;
    try {
      baseline.current = writeCurrentDraft(draft, baseline.current);
    } catch (error) {
      setIssue(
        error instanceof Error && error.message === changedElsewhere
          ? changedElsewhere
          : "Your latest changes could not be saved in this browser. Keep this tab open, download your current work below, or free some browser storage and retry.",
      );
      return false;
    }
    try {
      archiveStudioDraft(draft);
      archived.current = draft;
      setIssue("");
      return true;
    } catch {
      setIssue(
        "Your current design is saved for refresh, but My designs could not be updated. Download your work before switching designs, or free some browser storage and retry.",
      );
      return false;
    }
  }, []);

  useDraftExitSave(flush, { handlesRouter: true });
  useEffect(() => {
    flush();
  }, [state, flush]);
  return { state, setState, restoreState, flush, issue };
}
