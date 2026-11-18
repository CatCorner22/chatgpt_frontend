import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECK_CARD,
  hasUnsavedWork,
  isTypingTarget,
  scheduleUndoable,
  waitMessage,
  workHash,
} from "@/lib/ux";
import { GLOSSARY } from "@/lib/glossary";
import { cardFor } from "@/lib/knowledge";

const base = { brief: "b", tokens: { a: 1 }, picks: [{ step: "x" }], direction: "d" };

describe("unsaved work", () => {
  it("nothing to lose before any decision", () => {
    expect(hasUnsavedWork({ ...base, picks: [] })).toBe(false);
  });
  it("decisions not yet saved count as unsaved", () => {
    expect(hasUnsavedWork({ ...base, savedHash: null })).toBe(true);
  });
  it("after saving, nothing is unsaved until something changes", () => {
    const savedHash = workHash(base);
    expect(hasUnsavedWork({ ...base, savedHash })).toBe(false);
    expect(hasUnsavedWork({ ...base, picks: [...base.picks, { step: "y" }], savedHash })).toBe(
      true,
    );
  });
  it("navigation and experience changes invalidate an earlier export", () => {
    const state = { ...base, nav: { pattern: "top-menu" }, purpose: { experience: "website" } };
    const savedHash = workHash(state);
    expect(hasUnsavedWork({ ...state, nav: { pattern: "bottom-tabs" }, savedHash })).toBe(true);
    expect(hasUnsavedWork({ ...state, purpose: { experience: "app" }, savedHash })).toBe(true);
    expect(hasUnsavedWork({ ...state, savedHash })).toBe(false);
  });
});

describe("waiting feedback", () => {
  it("shows nothing under one second", () => expect(waitMessage(900, "Designing")).toBeNull());
  it("labels the work between 1 and 10 seconds, no cancel yet", () =>
    expect(waitMessage(3000, "Designing")).toEqual({ text: "Designing…", canCancel: false }));
  it("offers cancel after 10 seconds", () =>
    expect(waitMessage(10500, "Designing")?.canCancel).toBe(true));
});

describe("shortcuts", () => {
  it("are ignored while typing", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
  });
});

describe("undoable delete", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("does not delete before the 8-second window ends", () => {
    const del = vi.fn();
    scheduleUndoable(del, 8000);
    vi.advanceTimersByTime(7999);
    expect(del).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(del).toHaveBeenCalledOnce();
  });
  it("Undo inside the window keeps the project", () => {
    const del = vi.fn();
    const h = scheduleUndoable(del, 8000);
    vi.advanceTimersByTime(5000);
    expect(h.cancel()).toBe(true);
    vi.advanceTimersByTime(10000);
    expect(del).not.toHaveBeenCalled();
  });
});

describe("help text", () => {
  it("every glossary term has a definition", () => {
    for (const g of Object.values(GLOSSARY)) expect(g.def.length).toBeGreaterThan(20);
  });
  it("every check and finding maps to a real knowledge card", () => {
    for (const id of Object.values(CHECK_CARD)) expect(cardFor(id)).toBeDefined();
  });
});
