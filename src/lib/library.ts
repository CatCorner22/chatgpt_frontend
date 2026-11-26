import { focusLocalStorage } from "@/lib/browser-storage";
import { normalizeTokens, questionCount, type Tokens, type Content } from "./design";
import { assertRestorableStudioState, readStudioRecoveries } from "./studio-recovery";
import { migrate as migrateStudioState, type State as StudioState } from "./studio-state";

export const LIBRARY_KEY = "refraction:library:v1";
export type LibraryState = Record<string, unknown> & {
  tokens: Tokens;
  content: Content;
  libraryId: string;
};
export type LibraryEntry = {
  id: string;
  title: string;
  collection: string;
  favorite: boolean;
  created: string;
  updated: string;
  state: LibraryState;
  versions?: LibraryVersion[];
};
export type LibraryVersion = { at: string; label: string; state: LibraryState };
export const VERSION_LIMIT = 10;

type LibraryStorage = Pick<Storage, "getItem" | "setItem">;
export class LibraryRecoveryError extends Error {
  constructor(
    message: string,
    readonly raw: string | null,
  ) {
    super(message);
    this.name = "LibraryRecoveryError";
  }
}
export class LibraryChangedError extends Error {
  constructor() {
    super(
      "Your library changed after this view was loaded. The change was not applied. Reload the library and try again.",
    );
    this.name = "LibraryChangedError";
  }
}

function restorableState(value: unknown): value is LibraryState {
  try {
    assertRestorableStudioState(value);
    return !!value["tokens"] && !!value["content"];
  } catch {
    return false;
  }
}

function unreadableUndoHistory(value: unknown, depth = 0): boolean {
  try {
    if (depth > 8) return true;
    assertRestorableStudioState(value);
    return ["past", "future"].some((field) => {
      const steps = value[field];
      return Array.isArray(steps) && steps.some((step) => unreadableUndoHistory(step, depth + 1));
    });
  } catch {
    return true;
  }
}

/** Pure inspection keeps usable entries while identifying any data that would be discarded. */
export function inspectLibrary(raw: string | null): {
  entries: LibraryEntry[];
  needsRecovery: boolean;
} {
  if (raw === null) return { entries: [], needsRecovery: false };
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.entries))
      return { entries: [], needsRecovery: true };
    let needsRecovery = false;
    const ids = new Set<string>();
    const entries = data.entries.flatMap((e: LibraryEntry) => {
      if (!e || typeof e.id !== "string" || !e.id || ids.has(e.id) || !restorableState(e.state)) {
        needsRecovery = true;
        return [];
      }
      ids.add(e.id);
      if (unreadableUndoHistory(e.state)) needsRecovery = true;
      if (e.versions !== undefined && !Array.isArray(e.versions)) needsRecovery = true;
      const versions = (Array.isArray(e.versions) ? e.versions : []).filter((v) => {
        const valid = v && restorableState(v.state) && typeof v.at === "string";
        if (!valid) needsRecovery = true;
        else if (unreadableUndoHistory(v.state)) needsRecovery = true;
        return valid;
      });
      if (versions.length > VERSION_LIMIT) needsRecovery = true;
      return [
        {
          ...e,
          title: String(e.title ?? e.state.content.brand).slice(0, 120),
          collection: String(e.collection ?? "").slice(0, 60),
          favorite: e.favorite === true,
          created: String(e.created ?? ""),
          updated: String(e.updated ?? ""),
          state: { ...e.state, tokens: normalizeTokens(e.state.tokens), libraryId: e.id },
          versions: versions.slice(-VERSION_LIMIT).map((v) => ({
            at: v.at,
            label: String(v.label ?? "").slice(0, 120),
            state: { ...v.state, tokens: normalizeTokens(v.state.tokens), libraryId: e.id },
          })),
        },
      ];
    });
    return { entries, needsRecovery };
  } catch {
    return { entries: [], needsRecovery: true };
  }
}

export function parseLibrary(raw: string | null): LibraryEntry[] {
  return inspectLibrary(raw).entries;
}

/** Exact comparison resolves hash collisions; the hash only keeps storage keys short. */
export function preserveLibraryRecovery(
  raw: string,
  storage: LibraryStorage = focusLocalStorage,
): string {
  try {
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
    const base = `${LIBRARY_KEY}:recovery:${raw.length}-${(hash >>> 0).toString(16)}`;
    for (let attempt = 0; attempt < 1000; attempt++) {
      const key = attempt ? `${base}-${attempt}` : base;
      const prior = storage.getItem(key);
      if (prior !== null && prior !== raw) continue;
      if (prior === null) storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) throw new Error("Recovery copy was not retained");
      return key;
    }
    throw new Error("No recovery key available");
  } catch {
    throw new LibraryRecoveryError(
      "This saved library could not be read, and this browser could not keep a recovery copy. The original data has not been replaced. Download it below, free some browser storage, then try again.",
      raw,
    );
  }
}

export function readLibraryRecoveries(
  storage: Pick<Storage, "length" | "key" | "getItem"> = focusLocalStorage,
) {
  return readStudioRecoveries(storage, LIBRARY_KEY);
}

// Stable ID identifies one design, never its title. Metadata survives autosaving.
export function archiveDesign(
  list: LibraryEntry[],
  state: LibraryState,
  at: string,
): LibraryEntry[] {
  const prior = list.find((e) => e.id === state.libraryId);
  const { cache: _cache, ...small } = state;
  const next: LibraryEntry = {
    id: state.libraryId,
    title: prior?.title ?? state.content.brand,
    collection: prior?.collection ?? "",
    favorite: prior?.favorite ?? false,
    created: prior?.created ?? at,
    updated: at,
    state: { ...small, cache: {}, tokens: normalizeTokens(state.tokens) } as LibraryState,
    versions: nextVersions(prior, at),
  };
  return prior ? list.map((e) => (e.id === next.id ? next : e)) : [...list, next];
}

export function readLibrary(storage: LibraryStorage = focusLocalStorage) {
  return readLibrarySnapshot(storage).entries;
}
export function readLibrarySnapshot(storage: LibraryStorage = focusLocalStorage) {
  const raw = storage.getItem(LIBRARY_KEY);
  const result = inspectLibrary(raw);
  if (result.needsRecovery && raw !== null) preserveLibraryRecovery(raw, storage);
  return { ...result, raw };
}
export function writeLibrary(
  entries: LibraryEntry[],
  storage: LibraryStorage = focusLocalStorage,
  expectedRaw?: string | null,
) {
  const next = JSON.stringify({ version: 1, entries });
  const raw = storage.getItem(LIBRARY_KEY);
  if (expectedRaw !== undefined && raw !== expectedRaw) throw new LibraryChangedError();
  if (inspectLibrary(raw).needsRecovery && raw !== null) preserveLibraryRecovery(raw, storage);
  if (storage.getItem(LIBRARY_KEY) !== raw)
    throw new Error("Your saved library changed. Try saving again; no designs were replaced.");
  storage.setItem(LIBRARY_KEY, next);
  const retained = storage.getItem(LIBRARY_KEY);
  if (retained !== next) {
    if (retained !== raw) throw new LibraryChangedError();
    throw new Error("The library change could not be saved in this browser.");
  }
  return next;
}

/** A toast may outlive later edits or restores. Undo only its exact committed save. */
export function undoLibraryChange(
  before: LibraryEntry[],
  committedRaw: string,
  storage: LibraryStorage = focusLocalStorage,
): boolean {
  const previous = JSON.stringify({ version: 1, entries: before });
  if (storage.getItem(LIBRARY_KEY) !== committedRaw) return false;
  storage.setItem(LIBRARY_KEY, previous);
  if (storage.getItem(LIBRARY_KEY) !== previous)
    throw new Error("The undo could not be saved in this browser.");
  return true;
}

/** Plain "where you left off" wording for a saved design, honoring the short version. */
export function resumeLabel(state: Record<string, unknown>): string {
  const total = questionCount(state["quick"] === true);
  const picks = Array.isArray(state["picks"]) ? state["picks"].length : 0;
  if (state["stage"] === "rx") return "Open its Vision";
  if (state["stage"] === "review" || picks >= total) return "Review its answers";
  const at = Math.min(Number(state["stepIndex"] ?? 0) + 1, total);
  return `Continue at question ${at} of ${total}`;
}

function sortFields(_key: string, value: unknown): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value;
}

/** An independently edited library original must survive a layout change or checkpoint restore. */
export function libraryMatchesDraft(entry: LibraryEntry, draft: StudioState): boolean {
  const saved = migrateStudioState({ ...entry.state, libraryId: entry.id });
  return JSON.stringify(saved, sortFields) === JSON.stringify({ ...draft, cache: {} }, sortFields);
}
const look = (state: LibraryState) => {
  // Opening an older save adds defaults without editing the page. Compare the
  // same migrated state that the Studio renders before creating a revision.
  const s = migrateStudioState(state as Partial<StudioState>);
  return JSON.stringify(
    [
      normalizeTokens(s.tokens),
      s.content,
      s["page"],
      s["nav"],
      s["purpose"],
      s["brief"],
      s["direction"],
      s.integration,
    ],
    sortFields,
  );
};
const answersOf = (s: LibraryState) => (Array.isArray(s["picks"]) ? s["picks"].length : 0);
// Keep material page revisions; identical autosaves and status updates add no version.
function nextVersions(prior: LibraryEntry | undefined, _at: string): LibraryVersion[] {
  return prior?.versions ?? [];
}
/** Store the previous page, including words, layout, and navigation, when it differs. */
export function withVersion(list: LibraryEntry[], state: LibraryState, at: string): LibraryEntry[] {
  const prior = list.find((e) => e.id === state.libraryId);
  const next = archiveDesign(list, state, at);
  if (!prior) return next;
  const previousLook = look(prior.state);
  if (previousLook === look(state)) return next;
  const wordsOnly = look({ ...state, content: prior.state.content }) === previousLook;
  const elapsed = Date.parse(at) - Date.parse(prior.updated);
  // Keep the start of a typing burst rather than evicting useful versions per keystroke.
  if (
    wordsOnly &&
    prior.versions?.at(-1)?.label === "Before editing words" &&
    elapsed >= 0 &&
    elapsed < 1500
  )
    return next;
  const v: LibraryVersion = {
    at: prior.updated || at,
    label: wordsOnly
      ? "Before editing words"
      : JSON.stringify([prior.state["page"], prior.state["nav"], prior.state["purpose"]]) !==
          JSON.stringify([state["page"], state["nav"], state["purpose"]])
        ? "Before changing the page"
        : `${answersOf(prior.state)} answer${answersOf(prior.state) === 1 ? "" : "s"}`,
    state: prior.state,
  };
  return next.map((e) =>
    e.id === state.libraryId
      ? { ...e, versions: [...(prior.versions ?? []), v].slice(-VERSION_LIMIT) }
      : e,
  );
}
/** Opening one library entry keeps edits and autosave within the selected design.
 * Older duplicates can have source-project identities in their Studio timeline.
 * An ordinary live workspace can still undo a switch between designs.
 */
export function openLibraryDesign(entry: LibraryEntry): StudioState {
  const current = migrateStudioState({ ...entry.state, libraryId: entry.id });
  const ownStep = (step: StudioState["past"][number]) => {
    if (step.libraryId === entry.id && step.projectId === current.projectId) return step;
    if (!step.libraryId && !step.tokens && !step.content && !step.projectId && !step.savedHash)
      return step;
    return { ...step, libraryId: entry.id, projectId: current.projectId, savedHash: null };
  };
  return { ...current, past: current.past.map(ownStep), future: current.future.map(ownStep) };
}

function detachedState(input: Record<string, unknown>, id: string): Record<string, unknown> {
  return {
    ...input,
    libraryId: id,
    projectId: null,
    savedHash: null,
    cache: {},
    ...(Array.isArray(input["past"])
      ? { past: input["past"].map((item) => detachedState(item, id)) }
      : {}),
    ...(Array.isArray(input["future"])
      ? { future: input["future"].map((item) => detachedState(item, id)) }
      : {}),
  };
}

/** Preserve both branches when the active workspace and its saved design have independently changed. */
export function retainDraftIdentity(state: StudioState, entries: LibraryEntry[]): StudioState {
  const saved = entries.find((entry) => entry.id === state.libraryId);
  if (!saved || libraryMatchesDraft(saved, state)) return state;
  const id = crypto.randomUUID();
  if (entries.some((entry) => entry.id === id))
    throw new Error("A saved design already uses this identifier.");
  return migrateStudioState({ ...detachedState(state, id), cache: state.cache });
}

/** Detach a copied design and its histories from the source account and export receipts. */
export function detachedLibraryEntry(entry: LibraryEntry, id = entry.id): LibraryEntry {
  return {
    ...entry,
    id,
    state: detachedState(entry.state, id) as LibraryState,
    ...(entry.versions
      ? {
          versions: entry.versions.map((version) => ({
            ...version,
            state: detachedState(version.state, id) as LibraryState,
          })),
        }
      : {}),
  };
}
export function duplicateDesign(
  list: LibraryEntry[],
  id: string,
  newId: string,
  at: string,
): LibraryEntry[] {
  const src = list.find((e) => e.id === id);
  if (!src) return list;
  return [
    ...list,
    {
      ...detachedLibraryEntry({ ...src, versions: [] }, newId),
      title: `Copy of ${src.title}`.slice(0, 120),
      favorite: false,
      created: at,
      updated: at,
    },
  ];
}
/** Restoring keeps the current look as a version too, so a restore can itself be undone. */
export function restoreVersion(
  list: LibraryEntry[],
  id: string,
  index: number,
  at: string,
): LibraryEntry[] {
  const e = list.find((x) => x.id === id);
  const v = e?.versions?.[index];
  if (!e || !v) return list;
  const versions = [
    ...(e.versions ?? []).filter((_, i) => i !== index),
    { at: e.updated, label: "Before restoring", state: e.state },
  ].slice(-VERSION_LIMIT);
  // A version restores design work. Its old account link and receipt may belong to a parent copy.
  const state = {
    ...v.state,
    libraryId: id,
    projectId: e.state["projectId"] ?? null,
    savedHash: null,
  };
  return list.map((x) => (x.id === id ? { ...x, updated: at, state, versions } : x));
}
