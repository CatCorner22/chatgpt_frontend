import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIBRARY_KEY,
  LibraryChangedError,
  archiveDesign,
  duplicateDesign,
  readLibrary,
  undoLibraryChange,
  writeLibrary,
  type LibraryState,
} from "@/lib/library";
import { normalizeTokens } from "@/lib/design";

const state: LibraryState = {
  libraryId: "design-a",
  tokens: normalizeTokens({}),
  content: { brand: "Work", headline: "Keep this", sub: "", cta: "Go", quote: "", features: [] },
};
const at = "2026-11-18T12:00:00Z";
const original = () => archiveDesign([], state, at);
beforeEach(() => localStorage.clear());

describe("guarded library Undo", () => {
  it("permits an edit based on the current saved snapshot", () => {
    const before = original();
    const expected = writeLibrary(before);
    const next = duplicateDesign(before, "design-a", "copy", at);
    expect(writeLibrary(next, localStorage, expected)).toBe(localStorage.getItem(LIBRARY_KEY));
    expect(readLibrary()).toHaveLength(2);
  });

  it("blocks a normal save from a stale view before replacing later work", () => {
    const before = original();
    const expected = writeLibrary(before);
    const later = writeLibrary(archiveDesign(before, { ...state, libraryId: "other-tab" }, at));
    expect(() =>
      writeLibrary(duplicateDesign(before, "design-a", "copy", at), localStorage, expected),
    ).toThrow(LibraryChangedError);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(later);
  });
  it("undoes a copy when the committed library is still current", () => {
    const before = original();
    const copied = duplicateDesign(before, "design-a", "design-copy", at);
    const committed = writeLibrary(copied);
    expect(undoLibraryChange(before, committed)).toBe(true);
    expect(readLibrary().map((entry) => entry.id)).toEqual(["design-a"]);
  });

  it("preserves a later restored entry when an earlier copy toast is undone", () => {
    const before = original();
    const copied = duplicateDesign(before, "design-a", "design-copy", at);
    const committed = writeLibrary(copied);
    const later = archiveDesign(copied, { ...state, libraryId: "restored-c" }, at);
    const laterRaw = writeLibrary(later);
    expect(undoLibraryChange(before, committed)).toBe(false);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(laterRaw);
    expect(readLibrary().map((entry) => entry.id)).toEqual([
      "design-a",
      "design-copy",
      "restored-c",
    ]);
  });

  it("preserves later edits even when entry identities are unchanged", () => {
    const before = original();
    const copied = duplicateDesign(before, "design-a", "design-copy", at);
    const committed = writeLibrary(copied);
    const edited = copied.map((entry) => ({ ...entry, title: "Changed after the copy" }));
    const editedRaw = writeLibrary(edited);
    expect(undoLibraryChange(before, committed)).toBe(false);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(editedRaw);
  });

  it("does not overwrite damaged or removed storage with an old snapshot", () => {
    const before = original();
    const committed = writeLibrary(duplicateDesign(before, "design-a", "copy", at));
    localStorage.setItem(LIBRARY_KEY, "{damaged-after-copy");
    expect(undoLibraryChange(before, committed)).toBe(false);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe("{damaged-after-copy");
    localStorage.removeItem(LIBRARY_KEY);
    expect(undoLibraryChange(before, committed)).toBe(false);
    expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  });

  it("reports a failed undo write without changing the committed library", () => {
    const before = original();
    const committed = writeLibrary(duplicateDesign(before, "design-a", "copy", at));
    const store = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: vi.fn(() => {
        throw new Error("Quota exceeded");
      }),
    };
    expect(() => undoLibraryChange(before, committed, store)).toThrow(/Quota/);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(committed);
  });

  it("does not claim success if the undo write was silently discarded", () => {
    const before = original();
    const committed = writeLibrary(duplicateDesign(before, "design-a", "copy", at));
    expect(() =>
      undoLibraryChange(before, committed, {
        getItem: (key) => localStorage.getItem(key),
        setItem: vi.fn(),
      }),
    ).toThrow(/could not be saved/);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(committed);
  });
});
