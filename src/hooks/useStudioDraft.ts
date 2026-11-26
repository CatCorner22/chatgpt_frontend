import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { focusLocalStorage } from "@/lib/browser-storage";
import {
  LibraryChangedError,
  libraryMatchesDraft,
  readLibrarySnapshot,
  withVersion,
  writeLibrary,
  type LibraryEntry,
  type LibraryState,
} from "@/lib/library";
import { changedElsewhere, writeCurrentDraft } from "@/lib/studio-draft-storage";
import { EMPTY, type State } from "@/lib/studio-state";
import { useDraftExitSave } from "./useDraftExitSave";

export function archiveStudioDraft(state: State, lastEntry?: LibraryEntry | null) {
  if (!state.tokens || !state.content || !state.libraryId) return null;
  const { entries, raw } = readLibrarySnapshot();
  const stored = entries.find((entry) => entry.id === state.libraryId);
  // A different tab can restore a version without touching the active Studio key.
  // Names, collections, and favorites are independently editable library metadata.
  if (lastEntry?.id === state.libraryId) {
    if (!stored || JSON.stringify(stored.state) !== JSON.stringify(lastEntry.state))
      throw new LibraryChangedError();
  } else if (stored && !libraryMatchesDraft(stored, state)) throw new LibraryChangedError();
  const next = withVersion(entries, state as unknown as LibraryState, new Date().toISOString());
  writeLibrary(next, focusLocalStorage, raw);
  return next.find((entry) => entry.id === state.libraryId)!;
}

export function useStudioDraft() {
  const [state, renderState] = useState(EMPTY);
  const [issue, setIssue] = useState("");
  const latest = useRef(EMPTY);
  const baseline = useRef<string | null | undefined>(undefined);
  const archived = useRef<State | null>(null);
  const lastEntry = useRef<LibraryEntry | null>(null);

  // A change and a navigation can share one event. Expose the accepted edit to
  // the exit callback before React schedules its next render or passive effect.
  const setState = useCallback((action: SetStateAction<State>) => {
    latest.current = typeof action === "function" ? action(latest.current) : action;
    renderState(latest.current);
  }, []);

  const restoreState = useCallback(
    (next: State, expected: string | null, source: LibraryEntry | null = null) => {
      baseline.current = writeCurrentDraft(next, expected);
      lastEntry.current = source;
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
      lastEntry.current = archiveStudioDraft(draft, lastEntry.current);
      archived.current = draft;
      setIssue("");
      return true;
    } catch (error) {
      setIssue(
        error instanceof LibraryChangedError
          ? "Your current draft is saved for refresh. My designs changed in another tab. Reload to keep working with the saved versions."
          : "Your current design is saved for refresh, but My designs could not be updated. Download your work before switching designs, or free some browser storage and retry.",
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
