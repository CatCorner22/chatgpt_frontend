import { describe, expect, it, vi } from "vitest";
import { createOwnerStorage } from "@/lib/browser-storage";
import {
  EMPTY_ONBOARDING,
  ONBOARDING_KEY,
  ONBOARDING_STEPS,
  onboardingChecklist,
  parseOnboardingProgress,
  readOnboardingProgress,
  saveOnboardingProgress,
} from "@/lib/onboarding";

describe("welcome guide progress", () => {
  it("recovers malformed or future data without modifying the storage", () => {
    for (const raw of [
      "{",
      "[]",
      "null",
      '{"version":2,"step":2,"finished":true}',
      '{"version":1,"step":"2","finished":false}',
    ]) {
      const storage = { getItem: vi.fn(() => raw), setItem: vi.fn() };
      expect(readOnboardingProgress(storage)).toEqual({
        progress: EMPTY_ONBOARDING,
        issue: "invalid",
      });
      expect(storage.setItem).not.toHaveBeenCalled();
    }
    expect(parseOnboardingProgress(" ".repeat(2049))).toBeNull();
  });

  it("bounds the resume position and never accepts completion at an earlier step", () => {
    expect(
      parseOnboardingProgress(JSON.stringify({ version: 1, step: -8, finished: true })),
    ).toEqual(EMPTY_ONBOARDING);
    expect(
      parseOnboardingProgress(JSON.stringify({ version: 1, step: 900, finished: false }))?.step,
    ).toBe(ONBOARDING_STEPS.length - 1);
    expect(
      parseOnboardingProgress(JSON.stringify({ version: 1, step: 3.5, finished: false })),
    ).toBeNull();
    expect(
      parseOnboardingProgress(JSON.stringify({ version: 1, step: 2, finished: true }))?.finished,
    ).toBe(false);
  });

  it("makes storage failures explicit without making the guide unusable", () => {
    const denied = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readOnboardingProgress(denied)).toEqual({
      progress: EMPTY_ONBOARDING,
      issue: "unavailable",
    });
    expect(saveOnboardingProgress(denied, { version: 1, step: 2, finished: false })).toBe(false);
  });

  it("stores only bounded reading progress and keeps hosted owners separate", () => {
    const raw = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return raw.size;
      },
      getItem: (key) => raw.get(key) ?? null,
      setItem: (key, value) => {
        raw.set(key, value);
      },
      removeItem: (key) => {
        raw.delete(key);
      },
      clear: () => raw.clear(),
      key: (index) => [...raw.keys()][index] ?? null,
    };
    const alice = createOwnerStorage(storage, "alice");
    const bob = createOwnerStorage(storage, "bob");
    const progress = {
      version: 1 as const,
      step: 4,
      finished: false,
      secret: "do-not-persist",
      projectApproved: true,
    };
    expect(saveOnboardingProgress(alice, progress)).toBe(true);
    expect(readOnboardingProgress(alice).progress.step).toBe(4);
    expect(readOnboardingProgress(bob).progress).toEqual(EMPTY_ONBOARDING);
    expect(alice.getItem(ONBOARDING_KEY)).toBe('{"version":1,"step":4,"finished":false}');
    expect(storage.length).toBe(1);
  });

  it("exports a blank project-specific trial sheet, never fabricated acceptance", () => {
    const text = onboardingChecklist();
    expect(text).toContain("blank working guide, not a test result or a release approval");
    expect(text).toContain("production credentials, webhooks, email delivery and payment services");
    expect(text).toContain("rollback");
    expect(text).toContain("Owner-reviewed release decision: ____________________");
    expect(text).not.toContain("[x]");
    expect(text).not.toMatch(/all tests passed/i);
    expect(text).toContain("never merge over existing files");
    expect(text).toContain("does not deploy the customer app");
  });
});
