import { describe, expect, it } from "vitest";
import { ORIGINALS } from "@/lib/gallery";
import { designId } from "@/lib/launch";
import { readFocusTag, analyzePage } from "@/lib/critic";
import { provenance } from "@/lib/exportPack";
import { findByDesignId } from "@/lib/brands";
import { tagChange } from "@/lib/watchtower";
import type { LibraryEntry } from "@/lib/library";

const t = ORIGINALS[0]!.direction.tokens;
const id = designId(t);

describe("Focus design ID", () => {
  it("is short, stable, changes with any value and reveals no values", () => {
    expect(id).toMatch(/^f-[0-9a-f]{10}$/);
    expect(designId({ ...t })).toBe(id);
    expect(designId({ ...t, accent: "#123456" })).not.toBe(id);
    expect(provenance(t)).toBe(`Focus design ${id}`);
    expect(provenance(t)).not.toContain(t.bg);
    expect(provenance(t)).not.toContain(t.headingFont);
  });
  it("is read from the page head or stylesheet comment", () => {
    expect(readFocusTag(`<head><meta name="generator" content="Focus design ${id}"></head>`)).toBe(id);
    expect(readFocusTag(`<meta content='Focus design ${id}' name='generator'>`)).toBe(id);
    expect(readFocusTag("<p>hi</p>", `/* Focus design ${id} */ :root{}`)).toBe(id);
    expect(analyzePage(`<html><head><meta name="generator" content="Focus design ${id}"></head><body>x</body></html>`, "").facts.focusId).toBe(id);
  });
  it("ignores missing, malformed and padded tags", () => {
    expect(readFocusTag("<html></html>")).toBeNull();
    expect(readFocusTag(`<meta name="generator" content="Focus design f-XYZ">`)).toBeNull();
    expect(readFocusTag(`<meta name="generator" content="Focus design ${id} <script>">`)).toBeNull();
    expect(readFocusTag(`<meta name="description" content="Focus design ${id}">`)).toBeNull();
  });
  it("matches the page to the saved design with the same values", () => {
    const e = { id: "a", title: "Mine", state: { tokens: t } } as unknown as LibraryEntry;
    const other = { id: "b", title: "Other", state: { tokens: ORIGINALS[1]!.direction.tokens } } as unknown as LibraryEntry;
    expect(findByDesignId(id, [other, e])?.title).toBe("Mine");
    expect(findByDesignId("f-0000000000", [e])).toBeNull();
  });
  it("Site monitor flags a tag that disappears or changes", () => {
    expect(tagChange([{ designId: id }, { designId: null }])).toBe("missing");
    expect(tagChange([{ designId: id }, { designId: "f-0000000000" }])).toBe("changed");
    expect(tagChange([{ designId: id }, { designId: id }])).toBeNull();
    expect(tagChange([{ designId: id }])).toBeNull();
  });
});
