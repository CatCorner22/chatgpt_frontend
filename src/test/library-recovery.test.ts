import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIBRARY_KEY,
  archiveDesign,
  parseLibrary,
  preserveLibraryRecovery,
  readLibrary,
  writeLibrary,
  type LibraryState,
} from "@/lib/library";
import { normalizeTokens } from "@/lib/design";
import { readStudioRecoveries } from "@/lib/studio-recovery";

const state: LibraryState = {
  libraryId: "current-design",
  tokens: normalizeTokens({}),
  content: {
    brand: "Current work",
    headline: "Keep it",
    sub: "",
    cta: "Go",
    quote: "",
    features: [],
  },
};
const at = "2026-11-18T12:00:00Z";
const entries = () => archiveDesign([], state, at);
const copies = () => readStudioRecoveries(localStorage, LIBRARY_KEY);
beforeEach(() => localStorage.clear());

describe("library corruption recovery", () => {
  it("preserves the exact damaged library before Studio autosave replaces it", () => {
    const raw = '{"version":1,"entries":[{"id":"unreadable-work"';
    localStorage.setItem(LIBRARY_KEY, raw);
    const next = archiveDesign(readLibrary(), state, at);
    writeLibrary(next);
    expect(parseLibrary(localStorage.getItem(LIBRARY_KEY))).toHaveLength(1);
    expect(copies().map((copy) => copy.raw)).toEqual([raw]);
  });

  it("protects a direct write and does not make repeated copies of the same damage", () => {
    const raw = "{broken";
    localStorage.setItem(LIBRARY_KEY, raw);
    readLibrary();
    readLibrary();
    writeLibrary(entries());
    expect(copies().map((copy) => copy.raw)).toEqual([raw]);
    localStorage.setItem(LIBRARY_KEY, "{different-damage");
    writeLibrary(entries());
    expect(
      copies()
        .map((copy) => copy.raw)
        .sort(),
    ).toEqual([raw, "{different-damage"].sort());
  });

  it("leaves the original untouched when the recovery write runs out of space", () => {
    const raw = "{do-not-overwrite";
    localStorage.setItem(LIBRARY_KEY, raw);
    const store = {
      getItem: (key: string) => localStorage.getItem(key),
      key: (index: number) => localStorage.key(index),
      get length() {
        return localStorage.length;
      },
      setItem: vi.fn((_key: string, _value: string) => {
        throw new Error("Quota exceeded");
      }),
    };
    expect(() => readLibrary(store)).toThrow(/recovery copy/i);
    expect(() => writeLibrary(entries(), store)).toThrow(/recovery copy/i);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(raw);
    expect(copies()).toEqual([]);
    expect(store.setItem.mock.calls.every(([key]) => key !== LIBRARY_KEY)).toBe(true);
  });

  it.each(["", "null", '{"version":99,"entries":[]}', '{"version":1,"entries":[{}]}'])(
    "distinguishes an unreadable saved value from a missing or empty library: %s",
    (raw) => {
      localStorage.setItem(LIBRARY_KEY, raw);
      expect(readLibrary()).toEqual([]);
      expect(localStorage.getItem(LIBRARY_KEY)).toBe(raw);
      expect(copies().map((copy) => copy.raw)).toEqual([raw]);
    },
  );

  it("keeps ordinary missing, empty and valid libraries free of recovery copies", () => {
    expect(readLibrary()).toEqual([]);
    writeLibrary([]);
    expect(readLibrary()).toEqual([]);
    writeLibrary(entries());
    expect(readLibrary()).toHaveLength(1);
    expect(copies()).toEqual([]);
  });

  it("retains the full original if malformed entries or versions must be omitted", () => {
    const good = entries()[0]!;
    const raw = JSON.stringify({
      version: 1,
      entries: [{ ...good, versions: [{ at, state: { content: null } }] }, null],
    });
    localStorage.setItem(LIBRARY_KEY, raw);
    const readable = readLibrary();
    expect(readable).toHaveLength(1);
    expect(readable[0]!.versions).toEqual([]);
    writeLibrary(readable);
    expect(copies().map((copy) => copy.raw)).toEqual([raw]);
  });

  it("does not trust a recovery write that was silently discarded", () => {
    const raw = "{original";
    localStorage.setItem(LIBRARY_KEY, raw);
    const store = { getItem: (key: string) => localStorage.getItem(key), setItem: vi.fn() };
    expect(() => writeLibrary(entries(), store)).toThrow(/recovery copy/i);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(raw);
    expect(store.setItem.mock.calls.every(([key]) => key !== LIBRARY_KEY)).toBe(true);
  });

  it("preserves unreadable undo snapshots before opening can discard them", () => {
    const current = entries()[0]!;
    const raw = JSON.stringify({
      version: 1,
      entries: [
        { ...current, state: { ...current.state, past: [{ content: { features: null } }] } },
      ],
    });
    localStorage.setItem(LIBRARY_KEY, raw);
    expect(readLibrary()).toHaveLength(1);
    writeLibrary(entries());
    expect(copies().map((copy) => copy.raw)).toEqual([raw]);
  });

  it("does not overwrite an earlier recovery copy on a storage-key collision", () => {
    const raw = "{original";
    const firstKey = preserveLibraryRecovery(raw);
    localStorage.setItem(firstKey, "an earlier recovery");
    const secondKey = preserveLibraryRecovery(raw);
    expect(secondKey).not.toBe(firstKey);
    expect(localStorage.getItem(firstKey)).toBe("an earlier recovery");
    expect(localStorage.getItem(secondKey)).toBe(raw);
    expect(preserveLibraryRecovery(raw)).toBe(secondKey);
    expect(copies()).toHaveLength(2);
  });

  it("stops when the live library changes during the recovery write", () => {
    localStorage.setItem(LIBRARY_KEY, "{original");
    const changed = JSON.stringify({ version: 1, entries: [] });
    const store = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
        if (key.startsWith(`${LIBRARY_KEY}:recovery:`)) localStorage.setItem(LIBRARY_KEY, changed);
      },
    };
    expect(() => writeLibrary(entries(), store)).toThrow(/library changed/);
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(changed);
    expect(copies().map((copy) => copy.raw)).toEqual(["{original"]);
  });
});
