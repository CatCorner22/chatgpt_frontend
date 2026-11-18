import { describe, expect, it, vi } from "vitest";
import {
  GARDEN_DEFAULTS,
  GARDEN_KEY,
  readGardenPreferences,
  writeGardenPreferences,
  type GardenPreferences,
} from "@/lib/garden-preferences";

const chosen: GardenPreferences = { version: 1, step: "handoff", goal: "new", brief: false };

describe("Garden preferences", () => {
  it("uses independent defaults when absent without writing or repairing storage", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const first = readGardenPreferences(storage);
    expect(first).toEqual({ value: GARDEN_DEFAULTS, issue: "" });
    expect(first.value).toEqual({ version: 1, step: "goal", goal: "existing", brief: true });
    first.value.step = "check";
    expect(readGardenPreferences(storage).value.step).toBe("goal");
    expect(storage.getItem).toHaveBeenCalledWith(GARDEN_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("restores all saved choices without treating a later step as completion evidence", () => {
    for (const step of ["goal", "direction", "plan", "handoff", "check"] as const) {
      const value = { ...chosen, step };
      expect(readGardenPreferences({ getItem: () => JSON.stringify(value) })).toEqual({
        value,
        issue: "",
      });
    }
  });

  it.each([
    "{",
    "null",
    "[]",
    JSON.stringify({ ...chosen, version: 2 }),
    JSON.stringify({ ...chosen, step: "published" }),
    JSON.stringify({ ...chosen, goal: "unknown" }),
    JSON.stringify({ ...chosen, brief: "false" }),
    JSON.stringify({ version: 1, step: "goal", goal: "existing" }),
    JSON.stringify({ ...chosen, projectApproved: true }),
    " ".repeat(2049),
  ])("preserves malformed, unsupported or oversized saved data: %s", (raw) => {
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn() };
    const result = readGardenPreferences(storage);
    expect(result.value).toEqual(GARDEN_DEFAULTS);
    expect(result.issue).toMatch(/could not be read/i);
    expect(result.issue).toMatch(/not been changed/i);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem()).toBe(raw);
  });

  it("keeps defaults usable when browser storage access is denied", () => {
    const result = readGardenPreferences({
      getItem: () => {
        throw new Error("Access denied");
      },
    });
    expect(result.value).toEqual(GARDEN_DEFAULTS);
    expect(result.issue).toMatch(/could not be read/i);
    expect(result.issue).toMatch(/this tab/i);
  });

  it("confirms a saved preference by reading it back and touches only its own key", () => {
    const data = new Map([
      ["focus-studio", "unfinished studio"],
      ["focus:library:v1", "saved customer designs"],
      ["focus:welcome:v1", "welcome reading progress"],
    ]);
    const original = [...data];
    const storage = {
      getItem: vi.fn((key: string) => data.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        data.set(key, value);
      }),
    };
    expect(writeGardenPreferences(storage, chosen)).toBe("");
    expect(readGardenPreferences(storage)).toEqual({ value: chosen, issue: "" });
    expect(storage.getItem.mock.calls.every(([key]) => key === GARDEN_KEY)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(GARDEN_KEY, JSON.stringify(chosen));
    for (const [key, value] of original) expect(data.get(key)).toBe(value);
    expect(data.size).toBe(original.length + 1);
  });

  it("refuses invalid write values and unknown fields before accessing storage", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    for (const value of [null, { ...chosen, version: 99 }, { ...chosen, secret: "private" }]) {
      expect(writeGardenPreferences(storage, value as GardenPreferences)).toMatch(/invalid/i);
    }
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("does not report a denied write as saved or change the in-memory choice", () => {
    const value = { ...chosen };
    const storage = {
      getItem: vi.fn(() => JSON.stringify(GARDEN_DEFAULTS)),
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    };
    expect(writeGardenPreferences(storage, value)).toMatch(/could not be confirmed as saved/i);
    expect(value).toEqual(chosen);
    expect(storage.getItem()).toBe(JSON.stringify(GARDEN_DEFAULTS));
  });

  it("reports a silently dropped save without clearing the earlier preferences", () => {
    const before = JSON.stringify(GARDEN_DEFAULTS);
    const storage = { getItem: vi.fn(() => before), setItem: vi.fn() };
    expect(writeGardenPreferences(storage, chosen)).toMatch(/could not be confirmed as saved/i);
    expect(storage.getItem()).toBe(before);
  });

  it("reports an unconfirmed save when the readback is denied", () => {
    const storage = {
      setItem: vi.fn(),
      getItem: () => {
        throw new Error("Readback denied");
      },
    };
    expect(writeGardenPreferences(storage, chosen)).toMatch(/could not be confirmed as saved/i);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(GARDEN_KEY, JSON.stringify(chosen));
  });
});
