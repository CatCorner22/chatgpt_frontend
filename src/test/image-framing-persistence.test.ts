import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { normalizeTokens } from "@/lib/design";
import { normalizePageSettings } from "@/lib/page-settings";
import { EMPTY, migrate, snap, type State } from "@/lib/studio-state";
import { buildStudioLaunchArtifact } from "@/lib/studio-launch-artifact";
import { restoreStudioSave } from "@/lib/studio-recovery";
import { isDesignStep, record, redo, undo } from "@/lib/undo";
import {
  LIBRARY_KEY,
  parseLibrary,
  restoreVersion,
  withVersion,
  writeLibrary,
  type LibraryEntry,
  type LibraryState,
} from "@/lib/library";
import {
  createLibraryBackup,
  restoreLibraryBackup,
  validateCompleteLibraryBackup,
} from "@/lib/transfer";
import { accountSaveResult, hasUnsavedWork, workHash } from "@/lib/ux";
import {
  EMPTY_LAUNCH,
  launchFingerprint,
  upsertProgress,
  type ProgressRecord,
  type ReviewEvidence,
} from "@/lib/launch";

const defaultFraming = { fit: "cover", position: "center", narrowPosition: "same" } as const;
const leftFraming = { fit: "cover", position: "left", narrowPosition: "top" } as const;
const rightFraming = { fit: "contain", position: "bottom-right", narrowPosition: "right" } as const;
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=",
  "base64",
);
const imageId = createHash("sha256").update(imageBytes).digest("hex");
const imageData = `data:image/png;base64,${imageBytes.toString("base64")}`;
const imageKey = `focus:page-image:${imageId}`;
const tokens = normalizeTokens({ bg: "#f7fbff", accent: "#245cd6" });
const content = {
  brand: "River Studio",
  headline: "Make room for the image",
  sub: "A small collection of work.",
  cta: "View the collection",
  quote: "",
  features: [],
};
// This pre-framing page shape is deliberately literal: no new default helper can alter it.
const legacyPage = {
  composition: "studio" as const,
  actionUrl: "https://example.com/collection",
  imageId,
  imageAlt: "A blue bowl beside a river",
};

function state(imageFraming?: unknown): State {
  return {
    ...EMPTY,
    stage: "rx",
    brief: "A small ceramics portfolio",
    direction: "Clear river",
    tokens,
    content,
    libraryId: "framing-design",
    purpose: {
      audience: "general public",
      tone: "calm and trustworthy",
      experience: "website",
    },
    page: normalizePageSettings({
      ...legacyPage,
      ...(imageFraming === undefined ? {} : { imageFraming }),
    }),
    past: [],
    future: [],
  };
}

// Use Studio's actual artifact boundary, including independently versioned renderer changes.
const artifact = buildStudioLaunchArtifact;
const libraryState = (s: State) => s as unknown as LibraryState;
const asState = (s: Record<string, unknown>) => migrate(s as Partial<State>);
function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  // Transfer runs real MIME/hash validation. Raster decode is stubbed in this persistence test.
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1;
      naturalHeight = 1;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("image framing persistence and evidence identity", () => {
  it("keeps legacy/default page bytes, work hash and current-renderer launch identity unchanged", () => {
    const legacy = { ...state(), page: legacyPage };
    const raw = JSON.stringify(legacy);
    const opened = migrate(JSON.parse(raw));
    const explicitDefault = migrate({
      ...legacy,
      page: normalizePageSettings({ ...legacyPage, imageFraming: defaultFraming }),
    });
    expect(JSON.stringify(opened.page)).toBe(JSON.stringify(legacyPage));
    expect(JSON.stringify(explicitDefault.page)).toBe(JSON.stringify(legacyPage));
    expect(explicitDefault.page).not.toHaveProperty("imageFraming");
    expect(workHash(opened)).toBe("672765259");
    // The no-feature content-flow renderer revision changes evidence identity, not saved work.
    expect(launchFingerprint(tokens, artifact(opened))).toBe("artifact-v1:63fb8b14380a96a0");
    expect(workHash(explicitDefault)).toBe(workHash(legacy));
    expect(launchFingerprint(tokens, artifact(explicitDefault))).toBe(
      launchFingerprint(tokens, artifact(legacy)),
    );
    expect(isDesignStep(opened, explicitDefault)).toBe(false);
    expect(JSON.stringify(legacy)).toBe(raw);
    const saved = withVersion([], libraryState(legacy), "2026-11-18T10:00:00Z");
    expect(
      withVersion(saved, libraryState(explicitDefault), "2026-11-18T11:00:00Z")[0]!.versions,
    ).toHaveLength(0);
  });

  it.each([
    { fit: "contain", position: "center", narrowPosition: "same" },
    { fit: "cover", position: "top-left", narrowPosition: "same" },
    { fit: "cover", position: "center", narrowPosition: "bottom" },
  ])(
    "keeps a material $fit/$position/$narrowPosition edit dirty and invalidates prior review identity",
    (framing) => {
      const original = state();
      const changed = state(framing);
      expect(changed.page).toMatchObject({ imageFraming: framing, imageId });
      expect(workHash(changed)).not.toBe(workHash(original));
      expect(hasUnsavedWork({ ...changed, savedHash: workHash(original) })).toBe(true);
      expect(isDesignStep(original, changed)).toBe(true);
      const review: ReviewEvidence = {
        kind: "page",
        target: "https://example.com/collection",
        at: "2026-11-18T10:00:00Z",
        score: null,
        summary: "Owned fixture evidence for the previous composition only.",
        checks: [],
        prescription: [],
        priorities: [],
        repair: "",
      };
      const prior = upsertProgress(
        [],
        original.libraryId!,
        content.brand,
        tokens,
        "2026-11-18T10:00:00Z",
        artifact(original),
      )[0]!;
      const reviewed: ProgressRecord = {
        ...prior,
        details: { ...EMPTY_LAUNCH, status: "reviewed", tasks: ["main"], reviews: [review] },
      };
      const unchanged = upsertProgress(
        [reviewed],
        prior.id,
        content.brand,
        tokens,
        "2026-11-18T11:00:00Z",
        artifact(state(defaultFraming)),
      )[0]!;
      expect(unchanged.details).toEqual(reviewed.details);
      const updated = upsertProgress(
        [reviewed],
        prior.id,
        content.brand,
        tokens,
        "2026-11-18T11:00:00Z",
        artifact(changed),
      )[0]!;
      expect(updated.fingerprint).not.toBe(reviewed.fingerprint);
      expect(updated.details).toEqual(EMPTY_LAUNCH);
      expect(updated.completedAt).toBe(reviewed.completedAt);
    },
  );

  it("survives browser-save migration and Undo/Redo without embedding image bytes in snapshots", () => {
    const original = state();
    const changed = state(leftFraming);
    const timeline = record({ past: original.past, future: original.future }, snap(original));
    const saved = { ...changed, ...timeline, future: [snap(state(rightFraming))] };
    const raw = JSON.stringify(saved);
    const store = memoryStore({ studio: raw, [imageKey]: imageData });
    const restored = restoreStudioSave(
      store,
      "studio",
      (text) => migrate(JSON.parse(text)),
      EMPTY,
      "studio:recovery:fixture",
    );
    expect(restored.status).toBe("ready");
    if (restored.status !== "ready") throw new Error("The owned save should restore.");
    expect(restored.state.page).toMatchObject({ imageFraming: leftFraming });
    expect(restored.state.past[0]!.page).toEqual(legacyPage);
    expect(restored.state.future[0]!.page).toMatchObject({ imageFraming: rightFraming });
    const undone = undo(restored.state, snap(restored.state))!;
    expect(undone.state.page).toEqual(legacyPage);
    const redone = redo(undone.t, undone.state)!;
    expect(redone.state.page).toMatchObject({ imageFraming: leftFraming, imageId });
    expect(raw).not.toContain("data:image/");
    expect(store.getItem("studio")).toBe(raw);
    expect(store.getItem(imageKey)).toBe(imageData);
    expect(store.setItem).not.toHaveBeenCalled();
  });

  it("creates a page revision for a framing-only edit and restores either crop without losing it", () => {
    const initial = state(leftFraming);
    const edited = state(rightFraming);
    const first = withVersion([], libraryState(initial), "2026-11-18T10:00:00Z");
    const changed = withVersion(first, libraryState(edited), "2026-11-18T11:00:00Z");
    expect(changed[0]!.versions).toHaveLength(1);
    expect(changed[0]!.versions![0]!.label).toBe("Before changing the page");
    const store = memoryStore({ [imageKey]: imageData });
    const savedRaw = writeLibrary(changed, store, null);
    const reopened = parseLibrary(savedRaw);
    expect(asState(reopened[0]!.state).page).toMatchObject({ imageFraming: rightFraming });
    expect(asState(reopened[0]!.versions![0]!.state).page).toMatchObject({
      imageFraming: leftFraming,
    });
    const restored = restoreVersion(reopened, initial.libraryId!, 0, "2026-11-18T12:00:00Z");
    expect(asState(restored[0]!.state).page).toMatchObject({ imageFraming: leftFraming });
    expect(asState(restored[0]!.versions!.at(-1)!.state).page).toMatchObject({
      imageFraming: rightFraming,
    });
    expect(
      withVersion(reopened, libraryState(asState(reopened[0]!.state)), "2026-11-18T13:00:00Z")[0]!
        .versions,
    ).toHaveLength(1);
    expect(store.getItem(imageKey)).toBe(imageData);
    expect(
      store.setItem.mock.calls.filter(([key]) => key.startsWith("focus:page-image:")),
    ).toHaveLength(0);
  });

  it("backs up and restores framing in current/version/undo states while transferring one exact image", async () => {
    const initial = state();
    const current = {
      ...state(rightFraming),
      past: [snap(state(leftFraming))],
      future: [snap(initial)],
    };
    const entry: LibraryEntry = {
      id: current.libraryId!,
      title: content.brand,
      collection: "Images",
      favorite: false,
      created: "2026-11-18T10:00:00Z",
      updated: "2026-11-18T11:00:00Z",
      state: libraryState(current),
      versions: [
        {
          at: "2026-11-18T10:00:00Z",
          label: "Earlier crop",
          state: libraryState(state(leftFraming)),
        },
      ],
    };
    const source = memoryStore({ [imageKey]: imageData });
    const originalEntry = JSON.stringify(entry);
    const raw = await createLibraryBackup([entry], source);
    await expect(validateCompleteLibraryBackup(raw)).resolves.toBeUndefined();
    const backup = JSON.parse(raw);
    expect(backup.assets.images).toEqual({ [imageId]: imageData });
    expect(JSON.stringify(backup.entries)).not.toContain("data:image/");
    expect(JSON.stringify(entry)).toBe(originalEntry);
    expect(source.setItem).not.toHaveBeenCalled();
    const target = memoryStore();
    const restored = await restoreLibraryBackup(raw, target);
    const opened = asState(restored.entries[0]!.state);
    expect(opened.page).toMatchObject({ imageFraming: rightFraming, imageId });
    expect(opened.past[0]!.page).toMatchObject({ imageFraming: leftFraming, imageId });
    expect(opened.future[0]!.page).toEqual(legacyPage);
    expect(asState(restored.entries[0]!.versions![0]!.state).page).toMatchObject({
      imageFraming: leftFraming,
      imageId,
    });
    expect((await restoreLibraryBackup(raw, target)).added).toBe(0);
    expect(target.setItem.mock.calls.filter(([key]) => key === imageKey)).toHaveLength(1);
    expect(target.getItem(imageKey)).toBe(imageData);
    expect(
      createHash("sha256")
        .update(Buffer.from(target.getItem(imageKey)!.split(",")[1]!, "base64"))
        .digest("hex"),
    ).toBe(imageId);

    // A changed crop is a different saved work, even though the image bytes are identical.
    const edited = JSON.parse(target.getItem(LIBRARY_KEY)!);
    edited.entries[0].state.page.imageFraming = leftFraming;
    target.setItem(LIBRARY_KEY, JSON.stringify(edited));
    const incomingAgain = await restoreLibraryBackup(raw, target);
    expect(incomingAgain.added).toBe(1);
    expect(incomingAgain.conflicts).toBe(1);
    expect(incomingAgain.entries).toHaveLength(2);
    expect(asState(incomingAgain.entries[0]!.state).page).toMatchObject({
      imageFraming: leftFraming,
    });
    expect(asState(incomingAgain.entries[1]!.state).page).toMatchObject({
      imageFraming: rightFraming,
    });
    expect(target.setItem.mock.calls.filter(([key]) => key === imageKey)).toHaveLength(1);
  });

  it("retains a later crop during an account acknowledgement without claiming image bytes were uploaded", () => {
    const submitted = state(leftFraming);
    const current = state(rightFraming);
    const next = accountSaveResult(current, submitted, "account-row");
    expect(next.page).toMatchObject({ imageFraming: rightFraming, imageId });
    expect(next.projectId).toBe("account-row");
    expect(next.savedHash).toBeNull();
    expect(next.content).toEqual(current.content);
  });
});
