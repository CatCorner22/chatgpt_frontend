import { focusLocalStorage, getBrowserOwnerId } from "./browser-storage";
import { readExamOptionDraft } from "./exam-option-draft";
import { GALLERY, type GalleryItem } from "./gallery";
import {
  inspectLibrary,
  libraryMatchesDraft,
  LIBRARY_KEY,
  withVersion,
  writeLibrary,
  type LibraryState,
} from "./library";
import { contentFromBrief } from "./local-design";
import type { PageComposition } from "./page-compositions";
import { isLayoutCheckpoint, STUDIO_KEY, writeCurrentDraft } from "./studio-draft-storage";
import {
  keepStudioCheckpoint,
  readStudioRecoveries,
  studioHistoryNeedsRecovery,
} from "./studio-recovery";
import { EMPTY, isEmptyStudioDraft, migrate, snap, type State } from "./studio-state";
import { evaluateStratosphereCandidate } from "./stratosphere";
import { record } from "./undo";

export const LAYOUT_SAMPLE = GALLERY.find((item) => item.id === "purr-and-paper")!;
export const LAYOUT_DEFAULT_THEME = GALLERY.find((item) => item.id === "graphite-precision")!;

export type LayoutDraftSnapshot = {
  state: State;
  hasWork: boolean;
  raw: string | null;
  libraryRaw: string | null;
  owner: string | null;
};

/** Exploring the catalog must never initialize or repair an owner's saved data. */
export function readLayoutDraft(): LayoutDraftSnapshot {
  const raw = focusLocalStorage.getItem(STUDIO_KEY);
  let state = EMPTY;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (studioHistoryNeedsRecovery(parsed)) throw new Error();
      state = migrate(parsed as Partial<State>);
    } catch {
      throw new Error("Open Studio to recover your previous draft before saving a layout.");
    }
  }
  const libraryRaw = focusLocalStorage.getItem(LIBRARY_KEY);
  return {
    state,
    hasWork: !isEmptyStudioDraft(state),
    raw,
    libraryRaw,
    owner: getBrowserOwnerId(),
  };
}

export function getLayoutDesign(
  snapshot: LayoutDraftSnapshot | null,
  composition: PageComposition,
  theme?: GalleryItem,
) {
  const state = snapshot?.state ?? EMPTY;
  const content = snapshot?.hasWork
    ? (state.content ?? contentFromBrief(state.brief, state.purpose))
    : LAYOUT_SAMPLE.content;
  const direction =
    theme?.direction ??
    state.directions.find((item) => item.name === state.direction) ??
    state.directions[0] ??
    LAYOUT_DEFAULT_THEME.direction;
  const tokens = theme?.direction.tokens ?? state.tokens ?? direction.tokens;
  // All catalog previews are website studies. The commit enforces scope again for the actual target.
  const result = evaluateStratosphereCandidate(
    {
      tokens,
      content,
      integration: "new",
      purpose: { ...state.purpose, experience: "website" },
      page: state.page,
      nav: state.nav,
    },
    "composition",
    composition,
  );
  return {
    content,
    tokens: result.tokens,
    page: { ...result.page, composition },
    direction,
    blocker: result.issues.find((issue) => issue.severity === "block")?.message ?? null,
  };
}

function checkSnapshot(snapshot: LayoutDraftSnapshot) {
  if (
    getBrowserOwnerId() !== snapshot.owner ||
    focusLocalStorage.getItem(STUDIO_KEY) !== snapshot.raw ||
    focusLocalStorage.getItem(LIBRARY_KEY) !== snapshot.libraryRaw
  )
    throw new Error(
      "Your saved work changed while you browsed. Reload the layouts to use the latest version.",
    );
}

function checkpointOriginal(raw: string) {
  if (
    readStudioRecoveries(focusLocalStorage, STUDIO_KEY).some(
      (copy) => isLayoutCheckpoint(copy.key) && copy.raw === raw,
    )
  )
    return;
  const key =
    STUDIO_KEY + ":recovery:" + new Date().toISOString() + ":layout:" + crypto.randomUUID();
  keepStudioCheckpoint(focusLocalStorage, key, raw);
}

export function commitLayoutDraft(
  snapshot: LayoutDraftSnapshot,
  composition: PageComposition,
  theme: GalleryItem | undefined,
  action: "use" | "copy",
): State {
  checkSnapshot(snapshot);
  const prior = snapshot.state;
  const copy = action === "copy";
  if (
    snapshot.hasWork &&
    !copy &&
    (prior.integration === "existing" || prior.purpose.experience === "app")
  )
    throw new Error(
      "Keep this project's structure and start a separate website copy to use this layout.",
    );
  const design = getLayoutDesign(snapshot, composition, theme);
  if (design.blocker) throw new Error(design.blocker);
  const library = inspectLibrary(snapshot.libraryRaw);
  if (library.needsRecovery)
    throw new Error("Open My designs to recover the saved library before using a layout.");
  const originalEntry = library.entries.find((entry) => entry.id === prior.libraryId);
  if (originalEntry && !libraryMatchesDraft(originalEntry, prior))
    throw new Error(
      "Studio and My designs have different versions of this draft. Back up your library and current draft, then reopen the version you want before choosing a layout.",
    );
  const libraryId = !copy && prior.libraryId ? prior.libraryId : crypto.randomUUID();
  if ((copy || !prior.libraryId) && library.entries.some((entry) => entry.id === libraryId))
    throw new Error("A design already has this identifier. Please try again.");

  const tokensChanged = JSON.stringify(prior.tokens) !== JSON.stringify(design.tokens);
  const hasOptionEdits = Object.values(prior.cache).some((options) =>
    options.some((option) => readExamOptionDraft(option.draft)),
  );
  const next: State = {
    ...prior,
    stage: "rx",
    integration: "new",
    purpose:
      prior.purpose.experience === "app"
        ? { ...prior.purpose, experience: "website" }
        : prior.purpose,
    brief: snapshot.hasWork ? prior.brief : LAYOUT_SAMPLE.brief,
    content: design.content,
    page: design.page,
    tokens: design.tokens,
    direction: theme || !prior.direction ? design.direction.name : prior.direction,
    directions: prior.directions.some((item) => item.name === design.direction.name)
      ? prior.directions
      : [...prior.directions, design.direction],
    cache: tokensChanged || copy ? {} : prior.cache,
    libraryId,
    ...(copy
      ? { projectId: null, savedHash: null, past: [], future: [] }
      : snapshot.hasWork
        ? record(prior, snap(prior))
        : {}),
  };
  const at = new Date().toISOString();
  let entries = library.entries;
  if (copy && prior.content && prior.tokens && !originalEntry) {
    const originalId = prior.libraryId ?? crypto.randomUUID();
    if (originalId === libraryId || entries.some((entry) => entry.id === originalId))
      throw new Error("A saved design already uses this identifier. Please try again.");
    const original = {
      ...prior,
      libraryId: originalId,
      content: prior.content,
      tokens: prior.tokens,
    };
    entries = withVersion(entries, original, at);
  }
  const saved = {
    ...next,
    content: design.content,
    tokens: design.tokens,
    libraryId,
  } satisfies LibraryState;
  entries = withVersion(entries, saved, at);
  if (copy) {
    const originalTitle = originalEntry?.title ?? design.content.brand;
    entries = entries.map((entry) =>
      entry.id === libraryId
        ? { ...entry, title: ("Copy of " + originalTitle).slice(0, 120) }
        : entry,
    );
  }

  // The library omits option drafts and incomplete designs. Keep the exact original before switching.
  const originalNeedsCheckpoint = copy && (!prior.tokens || !prior.content || hasOptionEdits);
  if (
    snapshot.raw !== null &&
    snapshot.hasWork &&
    (originalNeedsCheckpoint || (tokensChanged && hasOptionEdits))
  ) {
    try {
      checkpointOriginal(snapshot.raw);
    } catch {
      throw new Error(
        "Focus couldn't confirm a backup of your draft. Free browser storage and try again.",
      );
    }
  }
  checkSnapshot(snapshot);
  const committedLibrary = writeLibrary(entries, focusLocalStorage, snapshot.libraryRaw);
  try {
    writeCurrentDraft(next, snapshot.raw);
  } catch {
    // Undo only our own library write. Never roll back another tab's subsequent changes.
    if (focusLocalStorage.getItem(LIBRARY_KEY) === committedLibrary) {
      if (snapshot.libraryRaw === null) focusLocalStorage.removeItem(LIBRARY_KEY);
      else focusLocalStorage.setItem(LIBRARY_KEY, snapshot.libraryRaw);
    }
    throw new Error(
      "Focus couldn't confirm the Studio save. Reload to check your work before trying again.",
    );
  }
  return next;
}
