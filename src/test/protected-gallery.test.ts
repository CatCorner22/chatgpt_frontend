import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import originalDrafts from "@/lib/directions.data.json";
import {
  GALLERY,
  GALLERY_GROUPS,
  MADE_FOR_YOU_DRAFTS,
  ORIGINALS,
  type GalleryDraft,
} from "@/lib/gallery";
import inventory from "./fixtures/protected-gallery.json";

// The fixture records owner-approved settings at d94e3b0. Readable overrides capture
// Studio's existing normalization, including clamped radii and effects from extras.
// Fixed field order keeps source formatting irrelevant and preserves feature order.
function copyDigest(item: GalleryDraft) {
  const { brand, headline, sub, cta, features, quote } = item.content;
  const fields = [
    item.inspiration,
    item.bestFor ?? null,
    item.risk ?? null,
    item.brief,
    item.direction.why,
    brand,
    headline,
    sub,
    cta,
    features.map(({ title, body }) => [title, body]),
    quote,
  ];
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}

describe("protected gallery inventory", () => {
  it("assigns one stable ID to each selectable preset", () => {
    expect(inventory.length).toBeGreaterThanOrEqual(49);
    expect(new Set(GALLERY.map((item) => item.id)).size).toBe(GALLERY.length);
    expect(new Set(inventory.map((item) => item.id)).size).toBe(inventory.length);
  });

  it.each(inventory)("preserves $name ($id) from authored source to Studio", (expected) => {
    const original = expected.group !== "Made for you";
    const drafts: readonly GalleryDraft[] = original ? originalDrafts : MADE_FOR_YOU_DRAFTS;
    const authored = drafts.find((item) => item.id === expected.id);
    const selectable = GALLERY.find((item) => item.id === expected.id);
    expect(authored, "authored preset").toBeDefined();
    expect(selectable, "selectable preset").toBeDefined();
    expect(ORIGINALS.some((item) => item.id === expected.id)).toBe(original);
    expect(selectable!.group).toBe(expected.group);
    expect(GALLERY_GROUPS).toContain(expected.group);
    for (const item of [authored!, selectable!]) {
      expect(item.direction.name).toBe(expected.name);
      expect(item.direction.mood).toBe(expected.mood);
      expect(item.extras).toEqual(expected.extras);
      expect(copyDigest(item), "brief, rationale and sample copy").toBe(expected.copySha256);
    }
    expect(authored!.direction.tokens, "authored settings").toEqual(expected.tokens);
    expect(selectable!.direction.tokens, "Studio settings").toEqual({
      ...expected.tokens,
      ...expected.runtimeTokenOverrides,
    });
  });
});
