import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { GALLERY, MADE_FOR_YOU } from "@/lib/gallery";
import { STORY_STARTERS } from "@/lib/gallery-collection";
import { buildPrescription, contrast, contrastNotes, normalizeTokens } from "@/lib/design";
import { measuredChecks } from "@/lib/engine";
import { signalText } from "@/lib/appDesign";
import { buildPack, packFiles, validatePack } from "@/lib/exportPack";
import { matchDirections } from "@/lib/matcher";

const ids = [
  "purr-and-paper",
  "velvet-afterglow",
  "midnight-muse",
  "wildflower-hour",
  "cocoa-atelier",
  "moonlit-mischief",
];
const starters = GALLERY.filter((item) => ids.includes(item.id));

describe("cat, cinematic and peaceful starter collection", () => {
  it("adds six distinct selectable starters to Made for you without replacing older designs", () => {
    expect(starters).toHaveLength(6);
    expect(starters.every((item) => item.group === MADE_FOR_YOU)).toBe(true);
    expect(new Set(GALLERY.map((item) => item.id)).size).toBe(GALLERY.length);
    expect(GALLERY.slice(0, 5).map((item) => item.id)).toEqual([
      "summertime-sadness",
      "unconquerable",
      "straight-from-the-block",
      "velvet-and-ink",
      "plush",
    ]);
    expect(new Set(starters.map((item) => item.direction.tokens.headingFont)).size).toBe(6);
    expect(new Set(starters.map((item) => item.direction.tokens.heroLayout)).size).toBe(4);
    expect(new Set(starters.map((item) => item.direction.tokens.density)).size).toBe(3);
  });

  it.each(ids)("%s retains its supported tokens and readable semantic colors", (id) => {
    const item = GALLERY.find((entry) => entry.id === id)!;
    expect(item).toBeDefined();
    const t = item.direction.tokens;
    // A misspelled authored font/layout must not silently become a normalizer fallback.
    expect(t).toEqual(STORY_STARTERS.find((entry) => entry.id === id)!.direction.tokens);
    expect(normalizeTokens(t)).toEqual(t);
    expect(contrastNotes(t).filter((check) => !check.ok)).toEqual([]);
    expect(contrast(t.muted, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signalText(t), t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signalText(t, t.surface), t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(measuredChecks(t).filter((check) => !check.ok)).toEqual([]);
  });

  it.each(ids)("%s exports valid new-project and scoped existing-project ZIPs", async (id) => {
    const item = GALLERY.find((entry) => entry.id === id)!;
    expect(item).toBeDefined();
    for (const mode of ["new", "existing"] as const) {
      const md = buildPrescription({
        brief: item.brief,
        content: item.content,
        direction: item.direction.name,
        tokens: item.direction.tokens,
        picks: [],
        tool: "Lovable",
        integration: mode,
      });
      const files = packFiles(md, item.direction.tokens, item.content.brand, undefined, mode);
      expect(validatePack(files, item.direction.tokens, mode)).toEqual([]);
      const zip = await JSZip.loadAsync(
        await buildPack(md, item.direction.tokens, item.content.brand, undefined, mode),
        { checkCRC32: true },
      );
      const root = mode === "existing" ? "focus-restyle/" : "";
      expect(JSON.parse(await zip.file(`${root}tokens.json`)!.async("string"))).toEqual(
        item.direction.tokens,
      );
      expect(await zip.file(`${root}DESIGN.md`)!.async("string")).toBe(files["DESIGN.md"]);
      if (mode === "existing") {
        expect(zip.file("AGENTS.md")).toBeNull();
        expect(await zip.file(`${root}focus-tokens.css`)!.async("string")).toContain(
          "data-focus-restyle",
        );
        expect(zip.file(`${root}UNDO.md`)).not.toBeNull();
      }
    }
  });

  it.each([
    ["cat cafe reading community bookshop", "purr-and-paper"],
    ["cinematic vintage boutique records", "velvet-afterglow"],
    ["gothic literary magazine mysterious reading", "midnight-muse"],
    ["peaceful nature garden journal", "wildflower-hour"],
    ["brunette inclusive fashion boutique curves", "cocoa-atelier"],
    ["playful cat creative studio stickers", "moonlit-mischief"],
  ])("finds the intended starter for %s", (brief, id) => {
    expect(matchDirections(brief).map((match) => match.item.id)).toContain(id);
  });

  it("keeps public sample content original and free of private identity or celebrity claims", () => {
    expect(starters).toHaveLength(6);
    const content = JSON.stringify(starters);
    expect(content).not.toMatch(/Lana Del Rey|Blake|wife|endorsed|official celebrity/i);
    for (const item of starters) {
      expect(item.content.features).toHaveLength(3);
      expect(item.bestFor).toBeTruthy();
      expect(item.risk).toBeTruthy();
    }
  });
});
