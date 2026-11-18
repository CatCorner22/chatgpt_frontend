import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe("owner-scoped browser storage", () => {
  it("keeps library, images, recoveries and session handoffs separate for two owners", async () => {
    const { createOwnerStorage } = await import("@/lib/browser-storage");
    localStorage.setItem("refraction:library:v1", "legacy work");
    const a = createOwnerStorage(localStorage, "owner:a");
    const b = createOwnerStorage(localStorage, "owner:b");
    for (const key of [
      "refraction:library:v1",
      "focus:page-image:hash",
      "refraction:v1:recovery:1",
    ]) {
      a.setItem(key, `A ${key}`);
      expect(b.getItem(key)).toBeNull();
      b.setItem(key, `B ${key}`);
      expect(a.getItem(key)).toBe(`A ${key}`);
    }
    expect(a.length).toBe(3);
    expect(Array.from({ length: a.length }, (_, i) => a.key(i))).toEqual([
      "refraction:library:v1",
      "focus:page-image:hash",
      "refraction:v1:recovery:1",
    ]);
    expect(a.key(3)).toBeNull();
    const aSession = createOwnerStorage(sessionStorage, "owner:a");
    const bSession = createOwnerStorage(sessionStorage, "owner:b");
    aSession.setItem("refraction:pending-rescue", "A's pending design");
    expect(bSession.getItem("refraction:pending-rescue")).toBeNull();
    a.clear();
    expect(a.length).toBe(0);
    expect(b.length).toBe(3);
    expect(localStorage.getItem("refraction:library:v1")).toBe("legacy work");
  });

  it("uses an unambiguous prefix even when an owner contains delimiters", async () => {
    const { createOwnerStorage } = await import("@/lib/browser-storage");
    const a = createOwnerStorage(localStorage, "one");
    const b = createOwnerStorage(localStorage, "one:two");
    a.setItem("two:secret", "private");
    expect(b.getItem("secret")).toBeNull();
    expect(b.length).toBe(0);
  });

  it("leaves portable browser storage compatible with existing saves", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "false");
    const { focusLocalStorage, focusSessionStorage } = await import("@/lib/browser-storage");
    localStorage.setItem("refraction:v1", "existing");
    expect(focusLocalStorage.getItem("refraction:v1")).toBe("existing");
    focusSessionStorage.setItem("pending", "work");
    expect(sessionStorage.getItem("pending")).toBe("work");
  });

  it("fails closed before owner initialization and never switches an initialized document", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "true");
    const module = await import("@/lib/browser-storage");
    expect(() => module.focusLocalStorage.getItem("refraction:v1")).toThrow(/identity/i);
    module.initializeBrowserOwner("A");
    module.focusLocalStorage.setItem("refraction:v1", "A draft");
    module.initializeBrowserOwner("A");
    expect(() => module.initializeBrowserOwner("B")).toThrow(/reload/i);
    expect(module.focusLocalStorage.getItem("refraction:v1")).toBe("A draft");
    module.lockBrowserOwner();
    expect(() => module.focusLocalStorage.getItem("refraction:v1")).toThrow(/session/i);
    expect(() => module.focusLocalStorage.setItem("refraction:v1", "late callback")).toThrow(
      /session/i,
    );
    expect(() => module.initializeBrowserOwner("B")).toThrow(/reload/i);
    expect(module.createOwnerStorage(localStorage, "A").getItem("refraction:v1")).toBe("A draft");
  });

  it("a late callback from an old document cannot write into the next owner's namespace", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "true");
    const oldDocument = await import("@/lib/browser-storage");
    oldDocument.initializeBrowserOwner("A");
    oldDocument.focusLocalStorage.setItem("draft", "A");
    vi.resetModules();
    const newDocument = await import("@/lib/browser-storage");
    newDocument.initializeBrowserOwner("B");
    newDocument.focusLocalStorage.setItem("draft", "B");
    oldDocument.focusLocalStorage.setItem("draft", "A late");
    expect(newDocument.focusLocalStorage.getItem("draft")).toBe("B");
    expect(oldDocument.focusLocalStorage.getItem("draft")).toBe("A late");
  });

  it("keeps actual library, recovery and image readers isolated with their default stores", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "true");
    const ownerA = await import("@/lib/browser-storage");
    const libraryA = await import("@/lib/library");
    const imagesA = await import("@/lib/page-settings");
    const { normalizeTokens } = await import("@/lib/design");
    ownerA.initializeBrowserOwner("sites:A");
    const imageId = "a".repeat(64);
    const image = "data:image/png;base64,iVBORw0KGgo=";
    ownerA.focusLocalStorage.setItem(`focus:page-image:${imageId}`, image);
    libraryA.writeLibrary(
      libraryA.archiveDesign(
        [],
        {
          libraryId: "A-design",
          tokens: normalizeTokens({}),
          content: {
            brand: "A confidential",
            headline: "A work",
            sub: "",
            cta: "Go",
            quote: "",
            features: [],
          },
        },
        "2026-11-18T12:00:00Z",
      ),
    );
    libraryA.preserveLibraryRecovery("A damaged copy");
    expect(ownerA.getBrowserOwnerId()).toBe("A");
    expect(imagesA.readPageImage(imageId)).toBe(image);

    vi.resetModules();
    const ownerB = await import("@/lib/browser-storage");
    const libraryB = await import("@/lib/library");
    const imagesB = await import("@/lib/page-settings");
    ownerB.initializeBrowserOwner("sites:B");
    expect(libraryB.readLibrary()).toEqual([]);
    expect(libraryB.readLibraryRecoveries()).toEqual([]);
    expect(imagesB.readPageImage(imageId)).toBeNull();
    libraryB.writeLibrary([]);
    expect(libraryA.readLibrary()[0]?.title).toBe("A confidential");
    expect(libraryA.readLibraryRecoveries()).toHaveLength(1);
    expect(imagesA.readPageImage(imageId)).toBe(image);
  });

  it("preserves storage write failures instead of reporting a false save", async () => {
    const { createOwnerStorage } = await import("@/lib/browser-storage");
    const store: Storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Full", "QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    expect(() => createOwnerStorage(store, "A").setItem("draft", "work")).toThrow("Full");
  });

  it("resumes a paused store only for the already verified document owner", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "true");
    const module = await import("@/lib/browser-storage");
    module.initializeBrowserOwner("sites:A");
    module.focusLocalStorage.setItem("draft", "A work");
    module.lockBrowserOwner();
    expect(() => module.resumeBrowserOwner("sites:B")).toThrow(/reload/i);
    expect(() => module.getBrowserOwnerId()).toThrow(/session/i);
    module.resumeBrowserOwner("sites:A");
    expect(module.focusLocalStorage.getItem("draft")).toBe("A work");
    expect(module.getBrowserOwnerId()).toBe("A");
  });
});
