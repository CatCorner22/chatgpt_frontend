import { afterEach, describe, expect, it } from "vitest";
import { record, undo, redo, UNDO_LIMIT, isDesignStep } from "@/lib/undo";
import {
  duplicateDesign,
  openLibraryDesign,
  restoreVersion,
  withVersion,
  parseLibrary,
  readLibrary,
  writeLibrary,
  resumeLabel,
  VERSION_LIMIT,
  type LibraryState,
} from "@/lib/library";
import { normalizeTokens } from "@/lib/design";
import { afterAnswer } from "@/lib/design";
import { EMPTY, migrate, snap } from "@/lib/studio-state";
import { badgePasses, BADGE_MIN_SCORE } from "@/lib/badge";
import { readPageImage } from "@/lib/page-settings";
import { pngAsset } from "./image-asset.fixture";

const content = { brand: "Kiln", headline: "h", sub: "s", cta: "c", features: [], quote: "" };
const st = (accent: string, id = "a") =>
  ({
    tokens: normalizeTokens({ accent }),
    content,
    libraryId: id,
    picks: [],
  }) as unknown as LibraryState;

describe("review before Vision", () => {
  it("the last answer opens the review, not the Vision", () => {
    expect(afterAnswer(7, false).stage).toBe("review");
    expect(resumeLabel({ stage: "review", picks: [] })).toBe("Review its answers");
  });
});

describe("undo across questions", () => {
  it("undo then redo returns to the same step", () => {
    const t = record({ past: [], future: [] }, 1);
    const u = undo(t, 2)!;
    expect(u.state).toBe(1);
    expect(redo(u.t, u.state)!.state).toBe(2);
  });
  it("a new step clears redo", () => {
    const u = undo(record({ past: [], future: [] }, 1), 2)!;
    expect(record(u.t, 1).future).toEqual([]);
  });
  it(`keeps at most ${UNDO_LIMIT} steps`, () => {
    let t = { past: [] as number[], future: [] as number[] };
    for (let i = 0; i < 50; i++) t = record(t, i);
    expect(t.past.length).toBe(30);
  });
  it("only design changes count as steps", () => {
    expect(isDesignStep({ stepIndex: 1, aiCalls: 1 }, { stepIndex: 1, aiCalls: 2 })).toBe(false);
    expect(isDesignStep({ stepIndex: 1 }, { stepIndex: 2 })).toBe(true);
    expect(
      isDesignStep({ nav: { pattern: "top-menu" } }, { nav: { pattern: "bottom-tabs" } }),
    ).toBe(true);
    expect(
      isDesignStep({ purpose: { experience: "website" } }, { purpose: { experience: "app" } }),
    ).toBe(true);
  });
});

describe("saved design copies and versions", () => {
  afterEach(() => localStorage.clear());
  it("keeps the pre-edit words through a typing burst, then records a new editing session", () => {
    const initial = st("#aa0000");
    let list = withVersion([], initial, "2026-11-18T13:00:00.000Z");
    for (let i = 1; i <= 20; i++) {
      list = withVersion(
        list,
        { ...initial, content: { ...content, headline: "x".repeat(i) } },
        new Date(Date.parse("2026-11-18T13:00:00.000Z") + i * 100).toISOString(),
      );
    }
    expect(list[0]!.versions).toHaveLength(1);
    expect(list[0]!.versions![0]!.state.content.headline).toBe("h");
    list = withVersion(
      list,
      { ...initial, content: { ...content, headline: "Another session" } },
      "2026-11-18T13:00:05.000Z",
    );
    expect(list[0]!.versions).toHaveLength(2);
    expect(list[0]!.versions![1]!.state.content.headline).toBe("x".repeat(20));
  });
  it("retains words, composition, and navigation revisions even when tokens stay the same", () => {
    const initial = {
      ...st("#aa0000"),
      page: { composition: "studio" },
      nav: "top-menu",
    };
    let list = withVersion([], initial, "1");
    const changed = {
      ...initial,
      page: { composition: "editorial" },
      content: { ...content, headline: "Revised words" },
      nav: "bottom-tabs",
    };
    list = withVersion(list, changed, "2");
    expect(list[0]!.versions).toHaveLength(1);
    const restored = restoreVersion(list, "a", 0, "3");
    expect(restored[0]!.state.content.headline).toBe("h");
    expect(restored[0]!.state["page"]).toEqual({ composition: "studio" });
    expect(restored[0]!.state["nav"]).toBe("top-menu");
    expect(restored[0]!.versions!.at(-1)!.state.content.headline).toBe("Revised words");
    expect(withVersion(list, changed, "4")[0]!.versions).toHaveLength(1);
  });
  it("records a navigation-only edit after applying the shared migration", () => {
    const initial = { ...st("#aa0000"), nav: "top-menu" };
    const first = withVersion([], initial, "1");
    const changed = withVersion(first, { ...initial, nav: "bottom-tabs" }, "2");
    expect(changed[0]!.versions).toHaveLength(1);
    expect(changed[0]!.versions![0]!.state["nav"]).toBe("top-menu");
    expect(changed[0]!.state["nav"]).toBe("bottom-tabs");
  });
  it("a changed look keeps the previous look as a version; an unchanged save does not", () => {
    let l = withVersion([], st("#aa0000"), "1");
    l = withVersion(l, st("#aa0000"), "2");
    expect(l[0]!.versions).toHaveLength(0);
    l = withVersion(l, st("#0000aa"), "3");
    expect(l[0]!.versions).toHaveLength(1);
    expect(l[0]!.versions![0]!.state.tokens.accent).toBe(
      normalizeTokens({ accent: "#aa0000" }).accent,
    );
  });
  it(`keeps at most ${VERSION_LIMIT} versions`, () => {
    let l = withVersion([], st("#000001"), "0");
    for (let i = 2; i < 30; i++)
      l = withVersion(l, st(`#0000${i.toString(16).padStart(2, "0")}`), String(i));
    expect(l[0]!.versions!.length).toBeLessThanOrEqual(10);
  });
  it("restoring swaps the look and keeps the current one as a version", () => {
    let l = withVersion([], st("#aa0000"), "1");
    l = withVersion(l, st("#0000aa"), "2");
    const r = restoreVersion(l, "a", 0, "3");
    expect(r[0]!.state.tokens.accent).toBe(normalizeTokens({ accent: "#aa0000" }).accent);
    expect(r[0]!.versions!.at(-1)!.state.tokens.accent).toBe(
      normalizeTokens({ accent: "#0000aa" }).accent,
    );
  });
  it.each(["new", "legacy"] as const)(
    "keeps words, image bytes, history and autosave with the %s copy after reopening",
    (kind) => {
      const images = [pngAsset("before"), pngAsset("current"), pngAsset("later")] as const;
      for (const image of images) localStorage.setItem(`focus:page-image:${image.id}`, image.src);
      const first = {
        ...EMPTY,
        ...st("#aa0000"),
        stage: "rx" as const,
        libraryId: "source",
        projectId: "source-project",
        savedHash: "source-receipt",
        page: {
          ...EMPTY.page,
          actionUrl: "https://kiln.example/book",
          imageId: images[0].id,
          imageAlt: "A cup before firing",
          imageCredit: "Kiln studio",
        },
      };
      const latest = {
        ...first,
        content: { ...content, headline: "Latest" },
        page: { ...first.page, imageId: images[1].id, imageAlt: "A fired cup" },
      };
      const later = {
        ...first,
        content: { ...content, headline: "Later" },
        page: {
          ...first.page,
          imageId: images[2].id,
          imageAlt: "A cup with a blue glaze",
          imageFraming: { fit: "contain", position: "left", narrowPosition: "top" } as const,
        },
      };
      const list = withVersion(
        withVersion([], first, "1"),
        {
          ...latest,
          past: [snap(first)],
          future: [snap(later)],
        },
        "2",
      );
      const sourceBeforeCopy = structuredClone(list[0]!);
      const copies = duplicateDesign(list, "source", "copy", "2");
      const copy = copies[1]!;
      if (kind === "legacy") {
        // Earlier releases detached only the top-level state when making a copy.
        copy.state = {
          ...copy.state,
          past: [snap(first)],
          future: [{ ...snap(later), libraryId: null }],
        };
      } else {
        for (const timeline of [copy.state["past"], copy.state["future"]])
          expect(timeline).toMatchObject([{ libraryId: "copy", projectId: null, savedHash: null }]);
      }
      writeLibrary(copies);
      const saved = readLibrary();
      const opened = openLibraryDesign(saved[1]!);
      expect(opened).toMatchObject({
        libraryId: "copy",
        projectId: null,
        savedHash: null,
        content: latest.content,
        page: latest.page,
        tokens: latest.tokens,
      });
      expect(readPageImage(opened.page.imageId)).toBe(images[1].src);
      for (const [move, original, image] of [
        [undo, first, images[0]],
        [redo, later, images[2]],
      ] as const) {
        const step = move(opened, snap(opened))!;
        const next = { ...opened, ...step.state, ...step.t };
        expect(next).toMatchObject({
          libraryId: "copy",
          projectId: null,
          savedHash: null,
          content: original.content,
          page: original.page,
          tokens: original.tokens,
        });
        expect(readPageImage(next.page.imageId)).toBe(image.src);
        writeLibrary(withVersion(saved, next as LibraryState, "3"));
        const [source, copy] = readLibrary();
        expect(source).toEqual(sourceBeforeCopy);
        expect(copy!.state.content).toEqual(original.content);
        expect(copy!.state["page"]).toEqual(original.page);
        expect(copy!.versions!.at(-1)!.state).toMatchObject({
          libraryId: "copy",
          projectId: null,
          savedHash: null,
          page: latest.page,
          content: latest.content,
        });
      }
    },
  );
  it("keeps live workspace Undo across New design and same-design history when opening the library", () => {
    const source = {
      ...EMPTY,
      ...st("#aa0000"),
      libraryId: "source",
      projectId: "source-project",
      savedHash: "source-receipt",
    };
    const live = migrate({ ...EMPTY, ...record(EMPTY, snap(source)) });
    expect(undo(live, snap(live))!.state).toEqual(snap(source));
    const [entry] = withVersion([], { ...source, past: [snap(EMPTY), snap(source)] }, "1");
    expect(openLibraryDesign(entry!).past).toEqual([snap(EMPTY), snap(source)]);
  });
  it("a copy gets its own identity and survives reload", () => {
    const l = duplicateDesign(withVersion([], st("#aa0000"), "1"), "a", "b", "2");
    expect(l.map((e) => e.id)).toEqual(["a", "b"]);
    expect(l[1]!.state.libraryId).toBe("b");
    expect(l[1]!.title).toMatch(/^Copy of /);
    expect(parseLibrary(JSON.stringify({ version: 1, entries: l }))).toHaveLength(2);
  });
});

describe("Crafted with Focus badge", () => {
  const good = {
    stamp: "signed" as const,
    idMatches: true,
    score: BADGE_MIN_SCORE,
    highFails: 0,
    matched: 5,
  };
  it("passes only with a signed matching code, score 80+, no serious problems and 5 of 5 values", () => {
    expect(badgePasses(good)).toBe(true);
    expect(badgePasses({ ...good, stamp: "unsigned" })).toBe(false);
    expect(badgePasses({ ...good, stamp: "forged" })).toBe(false);
    expect(badgePasses({ ...good, idMatches: false })).toBe(false);
    expect(badgePasses({ ...good, score: 79 })).toBe(false);
    expect(badgePasses({ ...good, highFails: 1 })).toBe(false);
    expect(badgePasses({ ...good, matched: 4 })).toBe(false);
  });
});

describe("taste that compounds", async () => {
  const { markPassed, styleSoFar, tasteText, parseTaste } = await import("@/lib/taste");
  const picks = [{ step: "Fonts", label: "Bookish serif", reason: "" }];
  it("choices behind a passing badge are marked and come first for the AI", () => {
    const l = markPassed(
      [{ step: "Fonts", label: "Geometric sans", reason: "clean", brand: "B" }],
      picks,
      "A",
    );
    expect(l.find((e) => e.label === "Bookish serif")?.passed).toBe(true);
    expect(tasteText(l).startsWith("Fonts: Bookish serif")).toBe(true);
    expect(parseTaste(JSON.stringify(l)).filter((e) => e.passed)).toHaveLength(1);
  });
  it("style so far prefers the answer used on passing sites", () => {
    const l = [
      { step: "Fonts", label: "Geometric sans", reason: "", brand: "B" },
      { step: "Fonts", label: "Geometric sans", reason: "", brand: "C" },
      { step: "Fonts", label: "Bookish serif", reason: "", brand: "A", passed: true },
    ];
    expect(styleSoFar(l)).toEqual([{ step: "Fonts", label: "Bookish serif", times: 1, passed: 1 }]);
  });
});
