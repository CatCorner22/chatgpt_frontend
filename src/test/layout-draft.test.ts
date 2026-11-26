import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GALLERY } from "@/lib/gallery";
import {
  commitLayoutDraft,
  getLayoutDesign,
  LAYOUT_DEFAULT_THEME,
  LAYOUT_SAMPLE,
  readLayoutDraft,
} from "@/lib/layout-draft";
import { LIBRARY_KEY, openLibraryDesign, readLibrary, retainDraftIdentity } from "@/lib/library";
import { PAGE_COMPOSITIONS } from "@/lib/page-compositions";
import { isLayoutCheckpoint, STUDIO_KEY } from "@/lib/studio-draft-storage";
import { readStudioRecoveries } from "@/lib/studio-recovery";
import { EMPTY, migrate, type State } from "@/lib/studio-state";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function setCurrent(patch: Partial<State> = {}) {
  const state: State = {
    ...EMPTY,
    stage: "rx",
    brief: "Owner written brief",
    content: { ...LAYOUT_SAMPLE.content, brand: "Customer" },
    direction: LAYOUT_DEFAULT_THEME.direction.name,
    directions: [LAYOUT_DEFAULT_THEME.direction],
    tokens: LAYOUT_DEFAULT_THEME.direction.tokens,
    libraryId: "ours",
    projectId: "account",
    savedHash: "saved",
    ...patch,
  };
  localStorage.setItem(STUDIO_KEY, JSON.stringify(state));
  return state;
}

describe("layout selection and durable handoff", () => {
  it.each(PAGE_COMPOSITIONS)(
    "keeps the shared preview and saved $title draft in sync",
    ({ id }) => {
      const snapshot = readLayoutDraft();
      const preview = getLayoutDesign(snapshot, id);
      expect(preview.blocker).toBeNull();
      expect(localStorage.length).toBe(0);
      const state = commitLayoutDraft(snapshot, id, undefined, "use");
      expect(readLayoutDraft().state).toEqual(state);
      expect(state).toMatchObject({
        stage: "rx",
        integration: "new",
        tokens: preview.tokens,
        content: preview.content,
        page: preview.page,
      });
      expect(openLibraryDesign(readLibrary()[0]!)).toEqual(state);
    },
  );

  it("changes an existing website draft's layout and theme as one undo step without replacing owner copy or page settings", () => {
    const prior = setCurrent({
      page: {
        ...EMPTY.page,
        actionUrl: "https://example.org/book",
        imageId: "a".repeat(64),
        imageAlt: "Handmade bowl",
      },
    });
    const theme = GALLERY.find((item) => item.id === "smoky-mountain-autumn")!;
    expect(theme).toBeDefined();
    const snapshot = readLayoutDraft();
    const next = commitLayoutDraft(snapshot, "journal", theme, "use");
    expect(next).toMatchObject({
      projectId: prior.projectId,
      libraryId: prior.libraryId,
      brief: prior.brief,
      content: prior.content,
      direction: theme.direction.name,
      tokens: { heroLayout: "editorial", headingFont: theme.direction.tokens.headingFont },
      page: { ...prior.page, composition: "journal" },
    });
    expect(next.past.at(-1)).toMatchObject({
      content: prior.content,
      page: prior.page,
      tokens: prior.tokens,
    });
    expect(() => commitLayoutDraft(snapshot, "showcase", theme, "use")).toThrow(/changed/);
  });

  it.each(["existing", "app"] as const)(
    "keeps %s projects intact and makes an independently editable website",
    (kind) => {
      const prior = setCurrent(
        kind === "existing"
          ? { integration: "existing" }
          : { purpose: { ...EMPTY.purpose, experience: "app" } },
      );
      const snapshot = readLayoutDraft();
      expect(() => commitLayoutDraft(snapshot, "journal", undefined, "use")).toThrow(
        /separate website/,
      );
      const copy = commitLayoutDraft(snapshot, "journal", undefined, "copy");
      expect(copy.libraryId).not.toBe(prior.libraryId);
      expect(copy).toMatchObject({
        integration: "new",
        past: [],
        future: [],
        projectId: null,
        savedHash: null,
        content: prior.content,
      });
      expect(copy.purpose.experience).not.toBe("app");
      expect(readStudioRecoveries(localStorage, STUDIO_KEY)).toHaveLength(0);
      expect(readLibrary().find((entry) => entry.id === copy.libraryId)?.title).toBe(
        "Copy of Customer",
      );
      expect(
        openLibraryDesign(readLibrary().find((entry) => entry.id === prior.libraryId)!),
      ).toEqual(migrate(prior));
    },
  );

  it("preserves a partially written original exactly and derives the layout preview from its actual brief", () => {
    const raw = JSON.stringify({ ...EMPTY, brief: "A hand-thrown teacup collection for winter." });
    localStorage.setItem(STUDIO_KEY, raw);
    const snapshot = readLayoutDraft();
    const preview = getLayoutDesign(snapshot, "showcase");
    expect(preview.content.headline).toBe(snapshot.state.brief);
    const copy = commitLayoutDraft(snapshot, "showcase", undefined, "copy");
    const checkpoint = readStudioRecoveries(localStorage, STUDIO_KEY)[0]!;
    expect(isLayoutCheckpoint(checkpoint.key)).toBe(true);
    expect(checkpoint.raw).toBe(raw);
    expect(copy.content).toEqual(preview.content);
  });

  it("keeps a restorable copy of authored option notes when a changed layout invalidates cached token snapshots", () => {
    const tokens = LAYOUT_DEFAULT_THEME.direction.tokens;
    const original = setCurrent({
      cache: {
        density: [
          {
            label: "Keep this shape",
            why: "Owner notes",
            tokens,
            draft: { reason: "Our customers use gloves", nudges: [] },
          },
        ],
      },
    });
    const raw = localStorage.getItem(STUDIO_KEY);
    const result = commitLayoutDraft(readLayoutDraft(), "journal", undefined, "use");
    expect(result.cache).toEqual({});
    expect(result.tokens?.heroLayout).not.toBe(original.tokens?.heroLayout);
    expect(readStudioRecoveries(localStorage, STUDIO_KEY)[0]?.raw).toBe(raw);
  });

  it("detects an identifier collision when a legacy original and its new copy both need identities", () => {
    setCurrent({ libraryId: null });
    const snapshot = readLayoutDraft();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-1111-1111-111111111111");
    expect(() => commitLayoutDraft(snapshot, "journal", undefined, "copy")).toThrow(/identifier/);
    expect(localStorage.getItem(STUDIO_KEY)).toBe(snapshot.raw);
    expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  });

  it("protects another tab's draft or library and visibly refuses unreadable history without writing", () => {
    setCurrent();
    const snapshot = readLayoutDraft();
    const raw = snapshot.raw;
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: [] }));
    expect(() => commitLayoutDraft(snapshot, "comparison", undefined, "copy")).toThrow(/changed/);
    expect(localStorage.getItem(STUDIO_KEY)).toBe(raw);
    const newer = readLayoutDraft();
    const corrupt = JSON.stringify({ ...newer.state, past: [null] });
    localStorage.setItem(STUDIO_KEY, corrupt);
    expect(() => commitLayoutDraft(newer, "product", undefined, "use")).toThrow(/changed/);
    expect(() => readLayoutDraft()).toThrow(/recover/);
    expect(localStorage.getItem(STUDIO_KEY)).toBe(corrupt);
    expect(readStudioRecoveries(localStorage, STUDIO_KEY)).toHaveLength(0);
  });

  it("keeps the original and rolls back its own library write if the browser refuses to save the new draft", () => {
    localStorage.setItem(STUDIO_KEY, JSON.stringify({ ...EMPTY, brief: "An unfinished original" }));
    const snapshot = readLayoutDraft();
    const setter = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key !== STUDIO_KEY) setter.call(this, key, value);
    });
    expect(() => commitLayoutDraft(snapshot, "product", undefined, "copy")).toThrow(/confirm/);
    expect(localStorage.getItem(STUDIO_KEY)).toBe(snapshot.raw);
    expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
    expect(readStudioRecoveries(localStorage, STUDIO_KEY)[0]!.raw).toBe(snapshot.raw);
  });

  it("preserves both differing versions of the same design when the library and active Studio have diverged", () => {
    const first = commitLayoutDraft(readLayoutDraft(), "showcase", undefined, "use");
    const entries = localStorage.getItem(LIBRARY_KEY);
    const raw = JSON.stringify({ ...first, brief: "The owner's newer thought" });
    localStorage.setItem(STUDIO_KEY, raw);
    const snapshot = readLayoutDraft();
    for (const action of ["use", "copy"] as const) {
      expect(() => commitLayoutDraft(snapshot, "journal", undefined, action)).toThrow(
        /different versions/,
      );
      expect(localStorage.getItem(STUDIO_KEY)).toBe(raw);
      expect(localStorage.getItem(LIBRARY_KEY)).toBe(entries);
    }
    const recovered = retainDraftIdentity(snapshot.state, readLibrary());
    expect(recovered.libraryId).not.toBe(first.libraryId);
    expect(recovered).toMatchObject({
      brief: "The owner's newer thought",
      projectId: null,
      savedHash: null,
    });
    expect(retainDraftIdentity(first, readLibrary())).toBe(first);
  });

  it("keeps browsing available for invalid palettes and stops at the same measured constraint as Studio", () => {
    const theme = {
      ...LAYOUT_DEFAULT_THEME,
      direction: {
        ...LAYOUT_DEFAULT_THEME.direction,
        tokens: { ...LAYOUT_DEFAULT_THEME.direction.tokens, ink: "#ffffff", bg: "#ffffff" },
      },
    };
    const snapshot = readLayoutDraft();
    expect(getLayoutDesign(snapshot, "journal", theme).blocker).toMatch(/4.5/);
    expect(() => commitLayoutDraft(snapshot, "journal", theme, "use")).toThrow(/4.5/);
    expect(localStorage.length).toBe(0);
  });
});
