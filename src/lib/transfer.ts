import { focusLocalStorage } from "./browser-storage";
import { z } from "zod";
import { safeUrl } from "./critic";
import { normalizeTokens, type Tokens } from "./design";
import {
  LIBRARY_KEY,
  inspectLibrary,
  preserveLibraryRecovery,
  type LibraryEntry,
  type LibraryState,
} from "./library";
import { MAX_PAGE_IMAGE_BYTES, rasterMime } from "./page-settings";
import { assertRestorableStudioState } from "./studio-recovery";
import { migrate as migrateStudioState, type State as StudioState } from "./studio-state";

export const inventorySchema = z.object({
  url: z.string().max(500),
  links: z.array(z.string().max(500)).max(200),
  forms: z.array(z.string().max(500)).max(80),
  fields: z.array(z.string().max(300)).max(200),
  // Older saves had no buttons; default keeps them loadable.
  buttons: z.array(z.string().max(120)).max(200).default([]),
  // Legacy originals predate coverage metadata; never upgrade them to complete by inference.
  completeness: z.enum(["complete", "partial", "unknown"]).optional(),
  truncated: z.array(z.enum(["source", "links", "forms", "fields", "buttons"])).optional(),
});
export type Inventory = z.infer<typeof inventorySchema>;
export const sourceAttribute = (s: string, key: string) => {
  // Consume complete attributes so data-href and quoted "href=..." text cannot impersonate href.
  const attributes = /(?:^|\s)([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+)))?/g;
  for (const match of s.matchAll(attributes))
    if (match[1]?.toLowerCase() === key) return match[2] ?? match[3] ?? match[4] ?? "";
  return "";
};
const attr = sourceAttribute;
/** Source-level opening tags; quoted '>' characters remain inside their attribute. */
export function sourceOpeningTags(html: string, names: readonly string[]) {
  const wanted = new Set(names);
  return [...html.matchAll(/<([a-z][a-z0-9:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)]
    .filter((match) => wanted.has(match[1]!.toLowerCase()))
    .map((match) => ({
      name: match[1]!.toLowerCase(),
      attributes: match[2] ?? "",
      end: (match.index ?? 0) + match[0].length,
    }));
}
export function publicSourceMarkup(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
}
const unique = (items: string[], max: number) => [...new Set(items)].slice(0, max);
// Repeats are kept so losing one of two identical fields/buttons is still detected.
const all = (items: string[], max: number) => items.slice(0, max);
const text = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
const destination = (raw: string, base: string) => {
  try {
    const u = new URL(raw.replace(/&amp;/gi, "&"), base);
    // Route identity survives domain changes, but not destination/query changes.
    return u.origin === new URL(base).origin ? `${u.pathname}${u.search}${u.hash}` : u.href;
  } catch {
    return raw.slice(0, 500);
  }
};

/** Public source evidence only; never infer JavaScript actions or private routes. */
export function pageInventory(html: string, url: string, sourceComplete = true): Inventory {
  const clean = publicSourceMarkup(html);
  const values = {
    links: sourceOpeningTags(clean, ["a"])
      .map((m) => attr(m.attributes, "href"))
      .filter(Boolean)
      .map((h) => destination(h, url)),
    forms: sourceOpeningTags(clean, ["form"]).map(
      (m) =>
        `${(attr(m.attributes, "method") || "get").toLowerCase()} ${destination(attr(m.attributes, "action") || url, url)}`,
    ),
    fields: sourceOpeningTags(clean, ["input", "select", "textarea"]).map(
      (m) =>
        `${m.name}:${attr(m.attributes, "name") || attr(m.attributes, "id")}:${attr(m.attributes, "type") || "text"}`,
    ),
    buttons: [
      ...sourceOpeningTags(clean, ["button"]).map((m) => {
        const closing = clean.slice(m.end).search(/<\/button\s*>/i);
        const body = closing < 0 ? "" : clean.slice(m.end, m.end + closing);
        return `button:${text(body) || attr(m.attributes, "aria-label") || attr(m.attributes, "name")}`;
      }),
      ...sourceOpeningTags(clean, ["input"])
        .filter((m) => /^(submit|button|reset)$/i.test(attr(m.attributes, "type")))
        .map(
          (m) =>
            `button:${attr(m.attributes, "value") || attr(m.attributes, "aria-label") || attr(m.attributes, "name")}`,
        ),
    ],
  };
  const limits = { links: 200, forms: 80, fields: 200, buttons: 200 };
  const truncated: NonNullable<Inventory["truncated"]> = sourceComplete ? [] : ["source"];
  for (const kind of ["links", "forms", "fields", "buttons"] as const) {
    if (
      values[kind].length > limits[kind] ||
      values[kind].some(
        (value) => value.length > (kind === "fields" ? 300 : kind === "buttons" ? 120 : 500),
      )
    )
      truncated.push(kind);
    values[kind] = all(values[kind], limits[kind]).map((value) =>
      value.slice(0, kind === "fields" ? 300 : kind === "buttons" ? 120 : 500),
    );
  }
  return { url, ...values, completeness: truncated.length ? "partial" : "complete", truncated };
}
const counts = (xs: string[]) =>
  xs.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>());
/** Count-aware: "1 of 2 missing" when one of several identical items disappears. */
export function lostFeatures(before: Inventory, after: Inventory) {
  return (["links", "forms", "fields", "buttons"] as const).flatMap((kind) => {
    const now = counts(after[kind] ?? []);
    return [...counts(before[kind] ?? [])]
      .filter(([v, n]) => (now.get(v) ?? 0) < n)
      .map(([v, n]) => {
        const gone = n - (now.get(v) ?? 0);
        return { kind, value: n > 1 ? `${v} (${gone} of ${n} missing)` : v };
      });
  });
}
export function preservationComparison(before: Inventory, after: Inventory) {
  const missing = lostFeatures(before, after);
  const complete = before.completeness === "complete" && after.completeness === "complete";
  return {
    missing,
    complete,
    message: missing.length
      ? `${missing.length} original items were not found in the checked HTML. Check whether the makeover removed them.`
      : complete
        ? "No missing links, forms, fields or buttons found in this page's public HTML."
        : "No missing items found in the checked portion. This is an incomplete comparison, not confirmation that every original item remains.",
  };
}
export function samePage(before: Inventory, after: Inventory) {
  try {
    const key = (url: string) => {
      const u = new URL(url);
      return u.pathname.replace(/\/$/, "") + u.search + u.hash;
    };
    return key(before.url) === key(after.url);
  } catch {
    return false;
  }
}
export const BASELINE_KEY = "focus:transfer-baselines:v1";
export function readBaselines(raw: string | null): Inventory[] {
  try {
    return z
      .array(inventorySchema)
      .max(20)
      .parse(JSON.parse(raw ?? "[]"))
      .filter((v) => safeUrl(v.url))
      .map((v) => ({ ...v, completeness: v.completeness ?? "unknown" }));
  } catch {
    return [];
  }
}
/** Never throws (private browsing / full storage); callers must report false honestly. */
export function saveBaseline(
  before: Inventory,
  store: Pick<Storage, "getItem" | "setItem"> = focusLocalStorage,
): boolean {
  try {
    const old = readBaselines(store.getItem(BASELINE_KEY));
    store.setItem(
      BASELINE_KEY,
      JSON.stringify([...old.filter((v) => v.url !== before.url), before].slice(-20)),
    );
    return true;
  } catch {
    return false;
  }
}

export type StyleEvidence = { radii: number[]; spaces: number[] };
/** Declared values, not computed/rendered styles. Absence must remain unknown. */
export function styleEvidence(css: string): StyleEvidence {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const numbers = (re: RegExp) =>
    unique(
      [...clean.matchAll(re)].map((m) => String(Number(m[1]))),
      40,
    ).map(Number);
  return {
    radii: numbers(/(?:border-radius|--(?:focus-)?radius)\s*:\s*(\d+(?:\.\d+)?)px\b/gi),
    spaces: numbers(/--(?:focus-)?space-unit\s*:\s*(\d+(?:\.\d+)?)rem\b/gi),
  };
}
export function matchVision(
  facts: { fonts: string[]; colors: string[]; style?: StyleEvidence },
  t: Tokens,
) {
  const color = (v: string) =>
    v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase() : v.toLowerCase();
  const items = [
    ...(["headingFont", "bodyFont"] as const).map((key) => ({
      name: key === "headingFont" ? "Heading font" : "Body font",
      expected: t[key],
      known: facts.fonts.length > 0,
      ok: facts.fonts.some((v) => v.toLowerCase() === t[key].toLowerCase()),
      fix: `Set ${key === "headingFont" ? "heading" : "body"} font-family to "${t[key]}" and load that font. Preserve all content and actions.`,
    })),
    ...(["bg", "surface", "ink", "muted", "accent", "accentInk"] as const).map((key) => ({
      name: {
        bg: "Background",
        surface: "Surface",
        ink: "Text",
        muted: "Quiet text",
        accent: "Accent",
        accentInk: "Text on accent",
      }[key],
      expected: t[key],
      known: facts.colors.length > 0,
      ok: facts.colors.some((v) => color(v) === color(t[key])),
      fix: `Use ${t[key]} for ${key}; keep all functionality and repair text contrast if needed.`,
    })),
    {
      name: "Corners",
      expected: `${t.radius}px`,
      known: !!facts.style?.radii.length,
      ok: facts.style?.radii.includes(t.radius) ?? false,
      fix: `Use ${t.radius}px corners on the intended components; do not change dimensions or behavior.`,
    },
    {
      name: "Spacing unit",
      expected: `${{ airy: 1.5, balanced: 1, compact: 0.7 }[t.density]}rem`,
      known: !!facts.style?.spaces.length,
      ok:
        facts.style?.spaces.includes({ airy: 1.5, balanced: 1, compact: 0.7 }[t.density]) ?? false,
      fix: `Use the Vision spacing unit ${{ airy: 1.5, balanced: 1, compact: 0.7 }[t.density]}rem; preserve usable touch targets and existing layout behavior.`,
    },
  ];
  return { items, matched: items.filter((v) => v.known && v.ok).length };
}
// Library transfers keep the original version-1 entry envelope. Older readers
// ignore the additive image manifest; current readers require every image used
// by a design, saved version, or retained undo/redo snapshot to be available.

export const MAX_LIBRARY_BACKUP_BYTES = 20 * 1024 * 1024;
const IMAGE_STORAGE_PREFIX = "focus:page-image:";
const MAX_TRANSFER_ENTRIES = 200;
const MAX_TRANSFER_IMAGES = 128;
type TransferStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const imageIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const transferContentSchema = z
  .object({
    brand: z.string().max(10000),
    headline: z.string().max(10000),
    sub: z.string().max(10000),
    cta: z.string().max(10000),
    quote: z.string().max(10000).default(""),
    features: z
      .array(z.object({ title: z.string().max(10000), body: z.string().max(10000) }))
      .max(20),
  })
  .passthrough();
const transferStateSchema = z
  .object({
    tokens: z.record(z.string(), z.unknown()).nullable().optional(),
    content: transferContentSchema.nullable().optional(),
    page: z.object({ imageId: imageIdSchema.nullish() }).passthrough().optional(),
    stage: z.enum(["brief", "directions", "exam", "review", "rx"]).optional(),
    stepIndex: z.number().int().min(0).max(8).optional(),
    brief: z.string().max(20000).optional(),
    direction: z.string().max(2000).optional(),
    history: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
    directions: z
      .array(
        z.object({
          name: z.string(),
          mood: z.string(),
          why: z.string(),
          tokens: z.record(z.string(), z.unknown()),
        }),
      )
      .max(20)
      .optional(),
    picks: z
      .array(
        z.object({
          step: z.string().max(2000),
          label: z.string().max(2000),
          reason: z.string().max(4000).default(""),
        }),
      )
      .max(100)
      .optional(),
    purpose: z.record(z.string(), z.string()).optional(),
    past: z.array(z.unknown()).max(30).optional(),
    future: z.array(z.unknown()).max(30).optional(),
  })
  .passthrough();
const transferEntrySchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().max(1000),
    collection: z.string().max(1000),
    favorite: z.boolean(),
    created: z.string().max(100),
    updated: z.string().max(100),
    state: z.unknown(),
    versions: z
      .array(z.object({ at: z.string().max(100), label: z.string().max(1000), state: z.unknown() }))
      .max(10)
      .optional(),
  })
  .passthrough();
const libraryEnvelopeSchema = z.object({
  kind: z.literal("focus-library-backup").optional(),
  version: z.literal(1),
  entries: z.array(transferEntrySchema).max(MAX_TRANSFER_ENTRIES),
  assets: z
    .object({ version: z.literal(1), images: z.record(imageIdSchema, z.string().max(1_010_000)) })
    .strict()
    .optional(),
});

function boundedBackupText(raw: string): void {
  if (
    raw.length > MAX_LIBRARY_BACKUP_BYTES ||
    new TextEncoder().encode(raw).length > MAX_LIBRARY_BACKUP_BYTES
  )
    throw new Error("This library backup is larger than 20 MB. Back up fewer designs at once.");
}
function validatedEntries(input: unknown): { entries: LibraryEntry[]; imageIds: Set<string> } {
  const parsed = z.array(transferEntrySchema).max(MAX_TRANSFER_ENTRIES).parse(input);
  const ids = new Set<string>();
  const imageIds = new Set<string>();
  let visited = 0;
  const state = (value: unknown, required: boolean, depth = 0): Record<string, unknown> => {
    if (++visited > 5000 || depth > 8)
      throw new Error("This backup contains too much nested design history.");
    const next = transferStateSchema.parse(value);
    // Transfer limits and legacy defaults complement the same state validation
    // used when the Studio opens a save, including every retained snapshot.
    assertRestorableStudioState(next);
    if (required && (!next.tokens || !next.content))
      throw new Error("A saved design is missing its content or design values.");
    if (next.page?.imageId) imageIds.add(next.page.imageId);
    return {
      ...next,
      ...(next.tokens ? { tokens: normalizeTokens(next.tokens) } : {}),
      ...(next.past ? { past: next.past.map((item) => state(item, false, depth + 1)) } : {}),
      ...(next.future ? { future: next.future.map((item) => state(item, false, depth + 1)) } : {}),
    };
  };
  const entries = parsed.map((entry): LibraryEntry => {
    if (ids.has(entry.id))
      throw new Error("This backup repeats a design identifier. No designs were restored.");
    ids.add(entry.id);
    const { versions, ...fields } = entry;
    return {
      ...fields,
      state: { ...state(entry.state, true), libraryId: entry.id } as LibraryState,
      ...(versions
        ? {
            versions: versions.map((version) => ({
              ...version,
              state: { ...state(version.state, true), libraryId: entry.id } as LibraryState,
            })),
          }
        : {}),
    };
  });
  if (imageIds.size > MAX_TRANSFER_IMAGES)
    throw new Error("This backup refers to more than 128 images.");
  return { entries, imageIds };
}
async function contentHash(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function validateImageAsset(id: string, value: string): Promise<string> {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2]!.length > 1_000_000 || match[2]!.length % 4 !== 0)
    throw new Error("A backup image is not a supported PNG, JPEG, or WebP file under 750 KB.");
  let decoded: string;
  try {
    decoded = atob(match[2]!);
  } catch {
    throw new Error("A backup image contains invalid data.");
  }
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  if (
    !bytes.length ||
    bytes.length > MAX_PAGE_IMAGE_BYTES ||
    rasterMime(bytes) !== match[1] ||
    btoa(decoded) !== match[2]
  )
    throw new Error("A backup image has invalid data or does not match its file type.");
  if ((await contentHash(bytes)) !== id)
    throw new Error("A backup image does not match its identifier. No designs were restored.");
  return value;
}
function decodeImageAsset(data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (problem?: string) => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (problem) reject(new Error(problem));
      else resolve();
    };
    const timeout = setTimeout(
      () => finish("Checking a backup image took too long. No designs were restored. Try again."),
      10000,
    );
    image.onload = () =>
      finish(
        image.naturalWidth && image.naturalHeight
          ? undefined
          : "A backup image could not be decoded.",
      );
    image.onerror = () => finish("A backup image could not be decoded. No designs were restored.");
    image.src = data;
  });
}

/** A complete backup either contains every referenced image or fails explicitly. */
export async function createLibraryBackup(
  entries: LibraryEntry[],
  store: Pick<Storage, "getItem"> = focusLocalStorage,
): Promise<string> {
  // Bound before validation, including unknown fields carried by an older save.
  boundedBackupText(JSON.stringify({ version: 1, entries }));
  let checked: ReturnType<typeof validatedEntries>;
  try {
    checked = validatedEntries(entries);
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new Error(
        "A saved design or its history has an invalid format. No backup was created; your browser copy is unchanged.",
      );
    throw error;
  }
  const images: Record<string, string> = {};
  for (const id of checked.imageIds) {
    const stored = store.getItem(IMAGE_STORAGE_PREFIX + id);
    if (!stored)
      throw new Error(
        "A saved design or earlier version has a missing image. Add that image again before making a complete backup.",
      );
    images[id] = await validateImageAsset(id, stored);
    await decodeImageAsset(stored);
  }
  const raw = JSON.stringify(
    {
      kind: "focus-library-backup",
      version: 1,
      entries: checked.entries,
      assets: { version: 1, images },
    },
    null,
    2,
  );
  boundedBackupText(raw);
  return raw;
}

function parsedLibraryEnvelope(raw: string) {
  boundedBackupText(raw);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("This backup is not valid JSON. Choose a library backup and try again.");
  }
  const parsed = libraryEnvelopeSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "This file could not be restored. Choose a Focus library backup downloaded from My designs. Your existing designs have not changed.",
    );
  return parsed.data;
}
/** Server-safe validation of a self-contained backup; browser restore also decodes every raster. */
export async function validateCompleteLibraryBackup(raw: string): Promise<void> {
  const envelope = parsedLibraryEnvelope(raw);
  if (envelope.kind !== "focus-library-backup" || !envelope.assets)
    throw new Error("Choose a complete library backup with its image files from My designs.");
  const incoming = validatedEntries(envelope.entries);
  const images = envelope.assets.images;
  const keys = Object.keys(images);
  if (keys.length > MAX_TRANSFER_IMAGES || keys.some((id) => !incoming.imageIds.has(id)))
    throw new Error("The image manifest contains unreferenced images.");
  for (const id of incoming.imageIds) {
    const value = images[id];
    if (!value) throw new Error("The backup is missing an image used by a design or its history.");
    await validateImageAsset(id, value);
  }
}

function canonicalTransferValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalTransferValue).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalTransferValue((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function portableEntry(entry: LibraryEntry, id = entry.id): LibraryEntry {
  const state = (input: Record<string, unknown>): Record<string, unknown> => ({
    ...input,
    libraryId: id,
    projectId: null,
    savedHash: null,
    cache: {},
    ...(Array.isArray(input["past"])
      ? { past: input["past"].map((item) => state(item as Record<string, unknown>)) }
      : {}),
    ...(Array.isArray(input["future"])
      ? { future: input["future"].map((item) => state(item as Record<string, unknown>)) }
      : {}),
  });
  return {
    ...entry,
    id,
    state: state(entry.state) as LibraryState,
    ...(entry.versions
      ? {
          versions: entry.versions.map((version) => ({
            ...version,
            state: state(version.state) as LibraryState,
          })),
        }
      : {}),
  };
}
const transferIdentity = (entry: LibraryEntry) => {
  // Opening a design updates this bookkeeping time without changing the work.
  // Keep content, settings, organization, creation time, and saved history in the comparison.
  const { updated: _updated, ...work } = portableEntry(entry, "transfer-identity");
  // Compare the state the Studio actually opens, including the same legacy
  // defaults and snapshot migration; keep meaningful work and history distinct.
  const stateIdentity = (state: Record<string, unknown>): Record<string, unknown> => {
    const migrated = migrateStudioState(state as Partial<StudioState>);
    // Studio snapshots flatten their own timelines. Transfer still preserves
    // bounded nested histories, so keep comparing those recursively as well.
    return {
      ...migrated,
      past: Array.isArray(state["past"])
        ? state["past"].map((step) => stateIdentity(step as Record<string, unknown>))
        : migrated.past,
      future: Array.isArray(state["future"])
        ? state["future"].map((step) => stateIdentity(step as Record<string, unknown>))
        : migrated.future,
    };
  };
  return canonicalTransferValue({
    ...work,
    state: stateIdentity(work.state),
    ...(work.versions
      ? {
          versions: work.versions.map((version) => ({
            ...version,
            state: stateIdentity(version.state),
          })),
        }
      : {}),
  });
};

/**
 * Restores by merging, never replacing a design or existing image. All parsing,
 * hashing and raster decoding finish before writes. New image keys are rolled
 * back if a write fails; the library is committed last in one Storage operation.
 * Web Storage cannot offer a transaction across tabs, so concurrent changes are
 * checked immediately before the synchronous write sequence.
 */
export async function restoreLibraryBackup(raw: string, store: TransferStore = focusLocalStorage) {
  const envelope = parsedLibraryEnvelope(raw);
  let incoming: ReturnType<typeof validatedEntries>;
  try {
    incoming = validatedEntries(envelope.entries);
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new Error(
        "This backup contains an invalid design or history entry. No designs were restored.",
      );
    throw error;
  }
  const supplied = envelope.assets?.images;
  const keys = Object.keys(supplied ?? {});
  if (keys.length > MAX_TRANSFER_IMAGES || keys.some((id) => !incoming.imageIds.has(id)))
    throw new Error("The image manifest contains unreferenced images. No designs were restored.");
  const assets = new Map<string, string>();
  for (const id of incoming.imageIds) {
    const value = supplied ? supplied[id] : store.getItem(IMAGE_STORAGE_PREFIX + id);
    if (!value)
      throw new Error(
        supplied
          ? "This backup is missing an image used by a design or its history. No designs were restored."
          : "This older backup did not include image files, and a referenced image is missing from this browser. Restore it in the original browser and create a new complete backup, or add the missing image there first. No designs were restored.",
      );
    await validateImageAsset(id, value);
    await decodeImageAsset(value);
    assets.set(id, value);
  }

  const before = store.getItem(LIBRARY_KEY);
  const inspected = inspectLibrary(before);
  const existing = validatedEntries(inspected.entries).entries;
  const merged = [...existing];
  let added = 0,
    duplicates = 0,
    conflicts = 0;
  for (const entry of incoming.entries) {
    const occupied = merged.find((candidate) => candidate.id === entry.id);
    const identity = transferIdentity(entry);
    if (occupied && transferIdentity(occupied) === identity) {
      duplicates++;
      continue;
    }
    let id = entry.id;
    if (occupied) {
      const base = `restored-${await contentHash(new TextEncoder().encode(identity))}`;
      const priorCopy = merged.find(
        (candidate) =>
          (candidate.id === base || candidate.id.startsWith(`${base}-`)) &&
          transferIdentity(candidate) === identity,
      );
      if (priorCopy) {
        duplicates++;
        continue;
      }
      id = base;
      let suffix = 2;
      while (merged.some((candidate) => candidate.id === id)) id = `${base}-${suffix++}`;
      conflicts++;
    }
    merged.push(portableEntry(entry, id));
    added++;
  }
  if (merged.length > MAX_TRANSFER_ENTRIES)
    throw new Error(
      "Restoring this backup would exceed 200 designs. Your existing library is unchanged.",
    );
  const next = JSON.stringify({ version: 1, entries: merged });
  boundedBackupText(next);
  if (store.getItem(LIBRARY_KEY) !== before)
    throw new Error(
      "Your library changed while the backup was being checked. Try restoring again; no designs were replaced.",
    );
  const pending: [string, string][] = [];
  for (const [id, data] of assets) {
    const key = IMAGE_STORAGE_PREFIX + id;
    const value = store.getItem(key);
    if (value !== null && value !== data)
      throw new Error(
        "An existing image has conflicting data. No images or designs were replaced.",
      );
    if (value === null) pending.push([key, data]);
  }
  // Preserve unreadable local data only after the incoming backup is fully
  // validated, and before any image or library write can replace existing work.
  if (added && inspected.needsRecovery && before !== null) preserveLibraryRecovery(before, store);
  if (store.getItem(LIBRARY_KEY) !== before)
    throw new Error(
      "Your library changed while the backup was being checked. Try restoring again; no designs were replaced.",
    );
  const written: [string, string][] = [];
  try {
    for (const [key, data] of pending) {
      store.setItem(key, data);
      written.push([key, data]);
    }
    if (added) store.setItem(LIBRARY_KEY, next);
  } catch {
    let rollbackFailed = false;
    for (const [key, data] of written.reverse()) {
      try {
        if (store.getItem(key) === data) store.removeItem(key);
      } catch {
        rollbackFailed = true;
      }
    }
    throw new Error(
      rollbackFailed
        ? "Browser storage stopped the restore. Existing designs were not replaced, but some unused image copies could not be removed. Keep your backup file and retry after freeing space."
        : "There is not enough browser storage to restore this backup. No designs were replaced and new image copies were removed. Keep your backup file and retry after freeing space.",
    );
  }
  return {
    entries: merged,
    added,
    duplicates,
    conflicts,
    imageCount: assets.size,
    imagesAdded: pending.length,
    legacy: !envelope.assets,
    designCount: incoming.entries.length,
  };
}
