// Pure helpers for the "effortless" layer. Tested in src/test/ux.test.ts.

// Fingerprint of the parts of a design a person would hate to lose.
type WorkState = {
  brief: string;
  tokens: unknown;
  picks: unknown[];
  direction: string;
  content?: unknown;
  page?: unknown;
  nav?: unknown;
  purpose?: unknown;
  integration?: unknown;
  savedHash?: string | null;
};
export function workHash(s: WorkState) {
  const str = JSON.stringify([
    s.brief,
    s.direction,
    s.tokens,
    s.picks,
    s.content,
    s.page,
    s.nav,
    s.purpose,
    s.integration,
  ]);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h);
}
// Unsaved work = there are decisions, and they differ from the last save/export.
export function hasUnsavedWork(s: WorkState) {
  if (!s.tokens || (s.picks.length === 0 && !s.content && !s.page)) return false;
  return workHash(s) !== s.savedHash;
}

/** Account rows carry page settings, while uploaded image bytes remain browser-local. */
export function hasBrowserOnlyImage(s: WorkState): boolean {
  return !!(s.page && typeof s.page === "object" && "imageId" in s.page && s.page.imageId);
}

/** A delayed save acknowledges its snapshot, never a different design or newer edits. */
export function accountSaveResult<
  T extends WorkState & { libraryId: string | null; projectId: string | null },
>(current: T, saved: T, projectId: string): T {
  if (current.libraryId !== saved.libraryId) return current;
  if (!saved.libraryId && workHash(current) !== workHash(saved)) return current;
  return {
    ...current,
    projectId,
    ...(!hasBrowserOnlyImage(saved) ? { savedHash: workHash(saved) } : {}),
  };
}

// What to say while waiting (Nielsen's 1 s / 10 s limits).
export function waitMessage(elapsedMs: number, label: string) {
  if (elapsedMs < 1000) return null;
  if (elapsedMs < 10000) return { text: `${label}…`, canCancel: false };
  return {
    text: `${label}… still working (${Math.floor(elapsedMs / 1000)} seconds)`,
    canCancel: true,
  };
}

// Keyboard shortcuts must never fire while someone is typing.
export function isTypingTarget(el: EventTarget | null) {
  const e = el as { tagName?: string; isContentEditable?: boolean } | null;
  if (!e?.tagName) return false;
  return e.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName);
}

// Runs an action after a delay unless cancelled — the basis for "Undo" on deletes.
export function scheduleUndoable(action: () => void, ms: number) {
  let done = false;
  const t = setTimeout(() => {
    done = true;
    action();
  }, ms);
  return {
    cancel: () => {
      if (done) return false;
      clearTimeout(t);
      done = true;
      return true;
    },
  };
}

// Which knowledge card explains each measured check or Critic finding.
export const CHECK_CARD: Record<string, string> = {
  "Line length": "body-text",
  "Clear text levels": "scale",
  "Main button height": "button-primary",
  "Uppercase headings": "type",
  "Text contrast": "palette",
  "Button text contrast": "accent",
  viewport: "layout",
  alt: "image",
  h1: "heading",
  order: "heading",
  fonts: "type",
  generic: "type",
  sizes: "scale",
  colors: "palette",
  gradient: "accent",
  cliche: "body-text",
  cta: "button-primary",
  length: "body-text",
  lang: "heading",
};
