import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import * as transfer from "@/lib/transfer";
import { LIBRARY_KEY, withVersion, type LibraryEntry } from "@/lib/library";
import { normalizeTokens } from "@/lib/design";
import { normalizePageSettings } from "@/lib/page-settings";
import { migrate as migrateStudioState, type State as StudioState } from "@/lib/studio-state";

const IMAGE_PREFIX = "focus:page-image:";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=",
  "base64",
);
const image = (suffix = "") => {
  const bytes = Buffer.concat([png, Buffer.from(suffix)]);
  return {
    id: createHash("sha256").update(bytes).digest("hex"),
    src: `data:image/png;base64,${bytes.toString("base64")}`,
  };
};
const current = image(),
  prior = image("prior"),
  undo = image("undo"),
  redo = image("redo"),
  unused = image("unused");
const entry = (id = "design-one"): LibraryEntry => ({
  id,
  title: "Clay House",
  collection: "Work",
  favorite: true,
  created: "2026-11-18T12:00:00Z",
  updated: "2026-11-18T12:00:00Z",
  state: {
    libraryId: id,
    tokens: normalizeTokens({}),
    content: {
      brand: "Clay House",
      headline: "Make a cup",
      sub: "Weekly classes.",
      cta: "Book",
      features: [],
      quote: "",
    },
    stage: "rx",
    page: { composition: "studio", actionUrl: "", imageId: current.id, imageAlt: "A cup" },
    past: [{ page: { imageId: undo.id } }],
    future: [{ page: { imageId: redo.id } }],
  },
  versions: [
    {
      at: "2026-11-17T12:00:00Z",
      label: "Earlier photo",
      state: {
        libraryId: id,
        tokens: normalizeTokens({}),
        content: {
          brand: "Clay House",
          headline: "Earlier title",
          sub: "",
          cta: "",
          features: [],
          quote: "",
        },
        page: { imageId: prior.id },
      },
    },
  ],
});
function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
const sourceStore = () =>
  memoryStore(
    Object.fromEntries(
      [current, prior, undo, redo, unused].map((asset) => [IMAGE_PREFIX + asset.id, asset.src]),
    ),
  );

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
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

describe("library backups retain referenced images", () => {
  it("includes current, earlier-version, and undo images exactly once, without unrelated assets", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const backup = JSON.parse(raw);
    expect(backup.version).toBe(1);
    expect(Object.keys(backup.assets.images).sort()).toEqual(
      [current.id, prior.id, undo.id, redo.id].sort(),
    );
    expect(backup.assets.images[current.id]).toBe(current.src);
    expect(backup.entries[0].versions[0].state.page.imageId).toBe(prior.id);
  });
  it("refuses to call a backup complete when any referenced image is missing", async () => {
    const store = sourceStore();
    store.removeItem(IMAGE_PREFIX + prior.id);
    await expect(transfer.createLibraryBackup([entry()], store)).rejects.toThrow(
      /missing.*image|image.*missing/i,
    );
  });
});

describe("library backup recovery", () => {
  it("exports a readable legacy pick without a reason and restores it with an empty reason", async () => {
    const legacy = entry();
    legacy.state["picks"] = [{ step: "palette", label: "Warm" }];
    const raw = await transfer.createLibraryBackup([legacy], sourceStore());
    expect(JSON.parse(raw).entries[0].state.picks[0].reason).toBe("");
    const target = memoryStore();
    const result = await transfer.restoreLibraryBackup(raw, target);
    expect(result.added).toBe(1);
    expect(result.entries[0]!.state["picks"]).toEqual([
      { step: "palette", label: "Warm", reason: "" },
    ]);
  });
  it("keeps a readable legacy neighbor when restoring another valid design", async () => {
    const legacy = entry("legacy-design");
    legacy.state["picks"] = [{ step: "palette", label: "Warm" }];
    const target = sourceStore();
    target.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: [legacy] }));
    const incoming = await transfer.createLibraryBackup([entry("new-design")], sourceStore());
    const result = await transfer.restoreLibraryBackup(incoming, target);
    expect(result.entries.map((item) => item.id)).toEqual(["legacy-design", "new-design"]);
    expect(result.entries[0]!.state.content).toEqual(legacy.state.content);
    expect(result.entries[0]!.state["picks"]).toEqual([
      { step: "palette", label: "Warm", reason: "" },
    ]);
  });
  it("restores the current image, saved-version image and undo image into a fresh browser", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const destination = memoryStore();
    const restored = await transfer.restoreLibraryBackup(raw, destination);
    expect(restored.added).toBe(1);
    expect(restored.imageCount).toBe(4);
    for (const asset of [current, prior, undo, redo])
      expect(destination.getItem(IMAGE_PREFIX + asset.id)).toBe(asset.src);
    expect(JSON.parse(destination.getItem(LIBRARY_KEY)!).entries[0].state.content.brand).toBe(
      "Clay House",
    );
  });
  it("rejects a mismatched image hash before any storage write", async () => {
    const backup = JSON.parse(await transfer.createLibraryBackup([entry()], sourceStore()));
    backup.assets.images[current.id] = prior.src;
    const destination = memoryStore({ untouched: "keep" });
    await expect(
      transfer.restoreLibraryBackup(JSON.stringify(backup), destination),
    ).rejects.toThrow(/identifier/);
    expect([...destination.data]).toEqual([["untouched", "keep"]]);
  });
  it("rolls back new image keys if the library write runs out of storage", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const old = JSON.stringify({ version: 1, entries: [] });
    const destination = memoryStore({
      [LIBRARY_KEY]: old,
      [IMAGE_PREFIX + current.id]: current.src,
    });
    const set = destination.setItem;
    destination.setItem = (key, value) => {
      if (key === LIBRARY_KEY) throw new Error("quota");
      set(key, value);
    };
    await expect(transfer.restoreLibraryBackup(raw, destination)).rejects.toThrow(/storage|space/i);
    expect([...destination.data]).toEqual([
      [LIBRARY_KEY, old],
      [IMAGE_PREFIX + current.id, current.src],
    ]);
  });
  it("preserves existing designs on ID conflict and does not duplicate a repeated restore", async () => {
    const existing = entry();
    existing.title = "Keep this title";
    const destination = sourceStore();
    destination.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: [existing] }));
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const first = await transfer.restoreLibraryBackup(raw, destination);
    expect(first.added).toBe(1);
    expect(first.conflicts).toBe(1);
    expect(first.entries[0]?.title).toBe("Keep this title");
    expect(first.entries[1]?.id).not.toBe(existing.id);
    const second = await transfer.restoreLibraryBackup(raw, destination);
    expect(second.added).toBe(0);
    expect(second.entries).toHaveLength(2);
  });
});

describe("library backup failure boundaries", () => {
  it.each(["current", "version", "past", "future"])(
    "rejects an unreadable %s state before any write",
    async (where) => {
      const backup = JSON.parse(await transfer.createLibraryBackup([entry()], sourceStore()));
      const saved = backup.entries[0];
      const state =
        where === "current"
          ? saved.state
          : where === "version"
            ? saved.versions[0].state
            : saved.state[where][0];
      state.quick = "yes";
      const old = JSON.stringify({ version: 1, entries: [entry("keep-me")] });
      const target = sourceStore();
      target.setItem(LIBRARY_KEY, old);
      const before = [...target.data];
      await expect(transfer.restoreLibraryBackup(JSON.stringify(backup), target)).rejects.toThrow();
      expect([...target.data]).toEqual(before);
    },
  );
  it("loads a legacy version-1 backup without images but refuses an unavailable legacy image", async () => {
    const plain = entry();
    delete plain.state["page"];
    delete plain.state["past"];
    delete plain.state["future"];
    plain.versions = [];
    const destination = memoryStore();
    expect(
      (
        await transfer.restoreLibraryBackup(
          JSON.stringify({ version: 1, entries: [plain] }),
          destination,
        )
      ).legacy,
    ).toBe(true);
    const priorData = [...destination.data];
    await expect(
      transfer.restoreLibraryBackup(
        JSON.stringify({ version: 1, entries: [entry()] }),
        destination,
      ),
    ).rejects.toThrow(/older backup.*did not include image/i);
    expect([...destination.data]).toEqual(priorData);
  });
  it("rejects unreferenced assets, duplicate entry IDs, malformed envelopes and oversized text", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const extra = JSON.parse(raw);
    extra.assets.images[unused.id] = unused.src;
    const destination = memoryStore();
    await expect(transfer.restoreLibraryBackup(JSON.stringify(extra), destination)).rejects.toThrow(
      /unreferenced/,
    );
    const repeated = JSON.parse(raw);
    repeated.entries.push(repeated.entries[0]);
    await expect(
      transfer.restoreLibraryBackup(JSON.stringify(repeated), destination),
    ).rejects.toThrow(/repeats/);
    await expect(
      transfer.restoreLibraryBackup('{"version":99,"entries":[]}', destination),
    ).rejects.toThrow(/Choose a Focus library backup.*existing designs have not changed/);
    await expect(transfer.restoreLibraryBackup("{", destination)).rejects.toThrow(/valid JSON/);
    await expect(
      transfer.restoreLibraryBackup(" ".repeat(transfer.MAX_LIBRARY_BACKUP_BYTES + 1), destination),
    ).rejects.toThrow(/20 MB/);
    expect(destination.data.size).toBe(0);
  });
  it("rejects a raster that cannot decode before touching the existing library", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const destination = memoryStore({ [LIBRARY_KEY]: '{"version":1,"entries":[]}' });
    await expect(transfer.restoreLibraryBackup(raw, destination)).rejects.toThrow(/decoded/);
    expect([...destination.data]).toEqual([[LIBRARY_KEY, '{"version":1,"entries":[]}']]);
  });
  it("rolls back an earlier new image when a later image write fails, then supports retry", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const destination = memoryStore();
    const original = destination.setItem;
    let writes = 0;
    destination.setItem = (key, value) => {
      if (++writes === 2) throw new Error("quota");
      original(key, value);
    };
    await expect(transfer.restoreLibraryBackup(raw, destination)).rejects.toThrow(/storage/);
    expect(destination.data.size).toBe(0);
    destination.setItem = original;
    expect((await transfer.restoreLibraryBackup(raw, destination)).added).toBe(1);
  });
  it("does not overwrite conflicting image bytes and retains corrupt library bytes before recovery", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const destination = memoryStore({ [IMAGE_PREFIX + current.id]: "keep-existing-bytes" });
    await expect(transfer.restoreLibraryBackup(raw, destination)).rejects.toThrow(
      /conflicting data/,
    );
    expect([...destination.data]).toEqual([[IMAGE_PREFIX + current.id, "keep-existing-bytes"]]);
    destination.data.clear();
    destination.setItem(LIBRARY_KEY, "corrupt-existing-library");
    const result = await transfer.restoreLibraryBackup(raw, destination);
    expect(result.added).toBe(1);
    expect(
      [...destination.data]
        .filter(([key]) => key.startsWith(`${LIBRARY_KEY}:recovery:`))
        .map(([, value]) => value),
    ).toEqual(["corrupt-existing-library"]);
    expect(JSON.parse(destination.getItem(LIBRARY_KEY)!).entries).toHaveLength(1);
  });

  it("keeps corrupt library bytes and adds no images when a recovery copy cannot be retained", async () => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const destination = memoryStore({ [LIBRARY_KEY]: "{original-damage" });
    const write = destination.setItem;
    destination.setItem = (key, value) => {
      if (key.startsWith(`${LIBRARY_KEY}:recovery:`)) throw new Error("quota");
      write(key, value);
    };
    await expect(transfer.restoreLibraryBackup(raw, destination)).rejects.toThrow(/recovery copy/i);
    expect([...destination.data]).toEqual([[LIBRARY_KEY, "{original-damage"]]);
  });
});

it("refuses to export image bytes that cannot be decoded", async () => {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
  await expect(transfer.createLibraryBackup([entry()], sourceStore())).rejects.toThrow(/decoded/);
});

it("preserves the existing library when restoring an empty valid backup", async () => {
  const old = JSON.stringify({ version: 1, entries: [entry()] });
  const destination = sourceStore();
  destination.setItem(LIBRARY_KEY, old);
  const result = await transfer.restoreLibraryBackup(
    JSON.stringify({ version: 1, entries: [] }),
    destination,
  );
  expect(result.designCount).toBe(0);
  expect(result.added).toBe(0);
  expect(destination.getItem(LIBRARY_KEY)).toBe(old);
});

it("does not duplicate a restored design after opening changes only its updated time", async () => {
  const raw = await transfer.createLibraryBackup([entry()], sourceStore());
  const destination = memoryStore();
  await transfer.restoreLibraryBackup(raw, destination);
  const opened = JSON.parse(destination.getItem(LIBRARY_KEY)!);
  opened.entries[0].updated = "2026-11-18T13:45:00Z";
  destination.setItem(LIBRARY_KEY, JSON.stringify(opened));
  const repeated = await transfer.restoreLibraryBackup(raw, destination);
  expect(repeated.added).toBe(0);
  expect(repeated.entries).toHaveLength(1);
  expect(repeated.entries[0]?.updated).toBe("2026-11-18T13:45:00Z");
});

it("treats omitted and migrated empty undo histories as the same saved work", async () => {
  const original = entry();
  delete original.state["past"];
  delete original.state["future"];
  const raw = await transfer.createLibraryBackup([original], sourceStore());
  const target = memoryStore();
  await transfer.restoreLibraryBackup(raw, target);
  const opened = JSON.parse(target.getItem(LIBRARY_KEY)!);
  opened.entries[0].state.past = [];
  opened.entries[0].state.future = [];
  target.setItem(LIBRARY_KEY, JSON.stringify(opened));
  const result = await transfer.restoreLibraryBackup(raw, target);
  expect(result.added).toBe(0);
  expect(result.entries).toHaveLength(1);
});

it("uses the Studio migration when comparing a reopened version-1 save with missing modern fields", async () => {
  const original = entry();
  original.state = {
    libraryId: original.id,
    tokens: original.state.tokens,
    content: original.state.content,
    stage: "rx",
    version: 1,
    past: [{ content: { ...original.state.content, headline: "An earlier choice" } }],
  };
  const raw = await transfer.createLibraryBackup([original], sourceStore());
  const target = memoryStore();
  await transfer.restoreLibraryBackup(raw, target);
  const opened = JSON.parse(target.getItem(LIBRARY_KEY)!);
  const unchangedInput = structuredClone(opened.entries[0].state);
  const migrated = migrateStudioState(opened.entries[0].state as Partial<StudioState>);
  expect(opened.entries[0].state).toEqual(unchangedInput);
  const autosaved = withVersion(
    opened.entries,
    { ...migrated, tokens: migrated.tokens!, content: migrated.content!, libraryId: original.id },
    "2026-11-18T15:00:00Z",
  );
  expect(autosaved[0]!.versions).toHaveLength(original.versions!.length);
  target.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: autosaved }));
  const result = await transfer.restoreLibraryBackup(raw, target);
  expect(result.added).toBe(0);
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0]!.state["past"]).toHaveLength(1);
});

it("compares saved versions with the same migration without discarding their words", async () => {
  const raw = await transfer.createLibraryBackup([entry()], sourceStore());
  const target = memoryStore();
  await transfer.restoreLibraryBackup(raw, target);
  const normalized = JSON.parse(target.getItem(LIBRARY_KEY)!);
  const prior = normalized.entries[0].versions[0];
  prior.state = migrateStudioState(prior.state as Partial<StudioState>);
  target.setItem(LIBRARY_KEY, JSON.stringify(normalized));
  const result = await transfer.restoreLibraryBackup(raw, target);
  expect(result.added).toBe(0);
  expect(result.entries[0]!.versions![0]!.state.content.headline).toBe("Earlier title");
});

it("keeps separate copies when a retained undo snapshot was materially changed", async () => {
  const raw = await transfer.createLibraryBackup([entry()], sourceStore());
  const target = memoryStore();
  await transfer.restoreLibraryBackup(raw, target);
  const changed = JSON.parse(target.getItem(LIBRARY_KEY)!);
  changed.entries[0].state.past[0].page.imageId = prior.id;
  target.setItem(LIBRARY_KEY, JSON.stringify(changed));
  const result = await transfer.restoreLibraryBackup(raw, target);
  expect(result.added).toBe(1);
  expect(result.entries).toHaveLength(2);
});

it("does not deduplicate different nonempty nested timelines accepted by transfer", async () => {
  const original = entry();
  original.state["past"] = [
    { page: { imageId: undo.id }, past: [{ page: { imageId: prior.id } }] },
  ];
  const raw = await transfer.createLibraryBackup([original], sourceStore());
  const target = memoryStore();
  await transfer.restoreLibraryBackup(raw, target);
  const changed = JSON.parse(target.getItem(LIBRARY_KEY)!);
  changed.entries[0].state.past[0].past[0].page.imageId = current.id;
  target.setItem(LIBRARY_KEY, JSON.stringify(changed));
  const result = await transfer.restoreLibraryBackup(raw, target);
  expect(result.added).toBe(1);
  expect(result.entries).toHaveLength(2);
  expect(result.entries[0]!.state).toEqual(changed.entries[0].state);
});

it("does not create a false page version when Studio opens a restored design", async () => {
  const raw = await transfer.createLibraryBackup([entry()], sourceStore());
  const destination = memoryStore();
  const restored = await transfer.restoreLibraryBackup(raw, destination);
  const state = restored.entries[0]!.state;
  const opened = withVersion(
    restored.entries,
    { ...state, page: normalizePageSettings(state["page"]) },
    "2026-11-18T13:45:00Z",
  );
  expect(opened[0]!.versions).toHaveLength(restored.entries[0]!.versions!.length);
  destination.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: opened }));
  const repeated = await transfer.restoreLibraryBackup(raw, destination);
  expect(repeated.added).toBe(0);
  expect(repeated.entries).toHaveLength(1);
});

it.each(["content", "settings"])(
  "keeps both designs when restored %s was materially changed",
  async (change) => {
    const raw = await transfer.createLibraryBackup([entry()], sourceStore());
    const destination = memoryStore();
    await transfer.restoreLibraryBackup(raw, destination);
    const edited = JSON.parse(destination.getItem(LIBRARY_KEY)!);
    if (change === "content") edited.entries[0].state.content.headline = "Keep this new headline";
    else edited.entries[0].state.page.actionUrl = "https://example.com/new-booking";
    destination.setItem(LIBRARY_KEY, JSON.stringify(edited));
    const repeated = await transfer.restoreLibraryBackup(raw, destination);
    expect(repeated.added).toBe(1);
    expect(repeated.entries).toHaveLength(2);
    expect(repeated.entries[0]?.state).toEqual(edited.entries[0].state);
  },
);

describe("design-bound Garden briefs travel with the customer's library", () => {
  it("restores exact choices, preserves a changed local brief as a separate design, and repeats safely", async () => {
    const { newGardenJourney, gardenJourneyKey, parseGardenJourney } =
      await import("@/lib/garden-journey");
    const design = entry();
    const key = gardenJourneyKey(design.id);
    const original = { ...newGardenJourney(design.id, "existing"), task: "Book exactly once" };
    const src = sourceStore();
    src.setItem(key, JSON.stringify(original));
    const backup = await transfer.createLibraryBackup([design], src);
    await transfer.validateCompleteLibraryBackup(backup);
    const dst = memoryStore();
    expect((await transfer.restoreLibraryBackup(backup, dst)).journeysAdded).toBe(1);
    expect(parseGardenJourney(dst.getItem(key)!, design.id)).toEqual(original);
    dst.setItem(key, JSON.stringify({ ...original, task: "Keep my later decision" }));
    const result = await transfer.restoreLibraryBackup(backup, dst);
    expect(result.conflicts).toBe(1);
    const other = result.entries.find((item) => item.id !== design.id)!;
    expect(parseGardenJourney(dst.getItem(gardenJourneyKey(other.id))!, other.id)).toEqual({
      ...original,
      designId: other.id,
    });
    expect(parseGardenJourney(dst.getItem(key)!, design.id).task).toBe("Keep my later decision");
    expect((await transfer.restoreLibraryBackup(backup, dst)).added).toBe(0);
    expect((await transfer.restoreLibraryBackup(backup, dst)).journeysAdded).toBe(0);
  });

  it("restores a missing brief beside an unchanged design and rejects orphan or duplicate incoming briefs before writes", async () => {
    const { newGardenJourney, gardenJourneyKey } = await import("@/lib/garden-journey");
    const design = entry();
    const src = sourceStore();
    const legacy = await transfer.createLibraryBackup([design], src);
    const sourceBrief = newGardenJourney(design.id, "new");
    src.setItem(gardenJourneyKey(design.id), JSON.stringify(sourceBrief));
    const backup = await transfer.createLibraryBackup([design], src);
    const dst = memoryStore();
    await transfer.restoreLibraryBackup(legacy, dst);
    expect(await transfer.restoreLibraryBackup(backup, dst)).toMatchObject({
      added: 0,
      journeysAdded: 1,
    });
    for (const journeys of [[{ ...sourceBrief, designId: "absent" }], [sourceBrief, sourceBrief]]) {
      const invalid = JSON.stringify({ ...JSON.parse(backup), journeys });
      const empty = memoryStore();
      await expect(transfer.validateCompleteLibraryBackup(invalid)).rejects.toThrow(/Garden brief/);
      await expect(transfer.restoreLibraryBackup(invalid, empty)).rejects.toThrow(/Garden brief/);
      expect(empty.data.size).toBe(0);
    }
  });

  it("removes newly written brief and images if the library commit fails", async () => {
    const { newGardenJourney, gardenJourneyKey } = await import("@/lib/garden-journey");
    const design = entry();
    const src = sourceStore();
    src.setItem(
      gardenJourneyKey(design.id),
      JSON.stringify(newGardenJourney(design.id, "existing")),
    );
    const backup = await transfer.createLibraryBackup([design], src);
    const dst = memoryStore();
    const failAtCommit = {
      ...dst,
      setItem(key: string, value: string) {
        if (key === LIBRARY_KEY) throw new Error("Storage full");
        dst.setItem(key, value);
      },
    };
    await expect(transfer.restoreLibraryBackup(backup, failAtCommit)).rejects.toThrow(/storage/i);
    expect(dst.data.size).toBe(0);
  });
});
