import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertRestorableStudioState,
  readStudioRecoveries,
  restoreStudioSave,
  studioHistoryNeedsRecovery,
} from "@/lib/studio-recovery";

const key = "studio";
const recoveryKey = "studio:recovery:2026-11-18:unique";
const parse = (raw: string): { brief: string } => {
  const value = JSON.parse(raw);
  if (!value || typeof value.brief !== "string") throw new Error("Invalid state");
  return value;
};
beforeEach(() => localStorage.clear());

describe("safe studio recovery", () => {
  it("distinguishes intact legacy history from entries migration would discard", () => {
    expect(studioHistoryNeedsRecovery({ brief: "Legacy" })).toBe(false);
    expect(studioHistoryNeedsRecovery({ past: [{ brief: "Earlier" }], future: [] })).toBe(false);
    expect(studioHistoryNeedsRecovery({ past: [null] })).toBe(true);
    expect(studioHistoryNeedsRecovery({ past: null })).toBe(true);
    expect(studioHistoryNeedsRecovery({ future: {} })).toBe(true);
    expect(studioHistoryNeedsRecovery({ past: [{ content: { features: null } }] })).toBe(true);
    expect(studioHistoryNeedsRecovery({ future: [{ past: [{ brief: "Nested" }] }] })).toBe(true);
    expect(studioHistoryNeedsRecovery({ past: Array.from({ length: 31 }, () => ({})) })).toBe(true);
  });
  it("preserves the original when migration repairs history while retaining usable current work", () => {
    const raw = JSON.stringify({ brief: "Current work", past: [{ content: { features: null } }] });
    localStorage.setItem(key, raw);
    const repaired = { brief: "Current work", past: [] };
    const result = restoreStudioSave(
      localStorage,
      key,
      () => repaired,
      { brief: "", past: [] },
      recoveryKey,
      () => true,
    );
    expect(result).toEqual({ status: "ready", state: repaired, recoveryKey });
    expect(localStorage.getItem(recoveryKey)).toBe(raw);
    expect(localStorage.getItem(key)).toBe(raw);
  });
  it("blocks a lossy migration when the original cannot be preserved", () => {
    const raw = JSON.stringify({ brief: "Current work", past: [null] });
    const store = {
      getItem: (name: string) => (name === key ? raw : null),
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    };
    const result = restoreStudioSave(
      store,
      key,
      () => ({ brief: "Current work", past: [] }),
      { brief: "", past: [] },
      recoveryKey,
      () => true,
    );
    expect(result).toMatchObject({ status: "blocked", raw });
  });
  it.each([
    {
      content: { brand: "Work", headline: "Hello", sub: "", cta: "Go", features: null, quote: "" },
    },
    { history: {} },
    { picks: [null] },
    { cache: { palette: { label: "Bad options" } } },
  ])("quarantines valid JSON with an unsafe state shape", (value) => {
    expect(() => assertRestorableStudioState(value)).toThrow("unreadable structure");
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    const result = restoreStudioSave(
      localStorage,
      key,
      (text) => {
        const parsed = JSON.parse(text);
        assertRestorableStudioState(parsed);
        return parsed;
      },
      {},
      recoveryKey,
    );
    expect(result).toEqual({ status: "ready", state: {}, recoveryKey });
    expect(localStorage.getItem(recoveryKey)).toBe(raw);
  });
  it("accepts legitimate older partial states for migration", () => {
    expect(() => assertRestorableStudioState({ brief: "Old work", stage: "brief" })).not.toThrow();
    expect(() =>
      assertRestorableStudioState({
        tokens: { bg: "#ffffff" },
        history: [],
        content: { brand: "Work", headline: "Hello", sub: "", cta: "Go", features: [], quote: "" },
      }),
    ).not.toThrow();
  });
  it("restores valid data and distinguishes missing data from corrupt empty data", () => {
    expect(restoreStudioSave(localStorage, key, parse, { brief: "" }, recoveryKey)).toEqual({
      status: "ready",
      state: { brief: "" },
    });
    localStorage.setItem(key, JSON.stringify({ brief: "My work" }));
    expect(restoreStudioSave(localStorage, key, parse, { brief: "" }, recoveryKey)).toEqual({
      status: "ready",
      state: { brief: "My work" },
    });
    expect(localStorage.getItem(recoveryKey)).toBeNull();
  });
  it.each(["{broken-json", "", "null", '{"brief":42}'])(
    "retains exact unreadable data before enabling a new save: %s",
    (raw) => {
      localStorage.setItem(key, raw);
      const result = restoreStudioSave(localStorage, key, parse, { brief: "" }, recoveryKey);
      expect(result).toEqual({ status: "ready", state: { brief: "" }, recoveryKey });
      expect(localStorage.getItem(key)).toBe(raw);
      expect(localStorage.getItem(recoveryKey)).toBe(raw);
      localStorage.setItem(key, JSON.stringify({ brief: "New work" }));
      expect(readStudioRecoveries(localStorage, key)).toEqual([{ key: recoveryKey, raw }]);
      expect(restoreStudioSave(localStorage, key, parse, { brief: "" }, "unused")).toEqual({
        status: "ready",
        state: { brief: "New work" },
      });
    },
  );
  it("blocks editing when quarantine fails and leaves the original untouched", () => {
    localStorage.setItem(key, "{broken-json");
    const storage = {
      getItem: (name: string) => localStorage.getItem(name),
      setItem: vi.fn(() => {
        throw new Error("Quota full");
      }),
    };
    expect(restoreStudioSave(storage, key, parse, { brief: "" }, recoveryKey)).toMatchObject({
      status: "blocked",
      raw: "{broken-json",
    });
    expect(localStorage.getItem(key)).toBe("{broken-json");
  });
  it("does not overwrite an earlier backup or trust an unretained recovery write", () => {
    localStorage.setItem(key, "{broken-json");
    localStorage.setItem(recoveryKey, "older data");
    expect(restoreStudioSave(localStorage, key, parse, { brief: "" }, recoveryKey).status).toBe(
      "blocked",
    );
    expect(localStorage.getItem(recoveryKey)).toBe("older data");
    const noWrites = {
      getItem: (name: string) => (name === key ? "{broken-json" : null),
      setItem: vi.fn(),
    };
    expect(restoreStudioSave(noWrites, key, parse, { brief: "" }, recoveryKey).status).toBe(
      "blocked",
    );
  });
  it("reports blocked storage without pretending an empty studio was restored", () => {
    const storage = {
      getItem: () => {
        throw new Error("Storage blocked");
      },
      setItem: vi.fn(),
    };
    expect(restoreStudioSave(storage, key, parse, { brief: "" }, recoveryKey)).toMatchObject({
      status: "blocked",
      raw: null,
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
