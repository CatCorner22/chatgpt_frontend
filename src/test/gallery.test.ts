import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { GALLERY } from "@/lib/gallery";
import { TOOLS, buildPrescription, contrastNotes, normalizeTokens } from "@/lib/design";
import { buildPack, dtcgTokens, shortPrompt } from "@/lib/exportPack";

describe("inspiration gallery", () => {
  it.each(GALLERY.map((g) => [g.direction.name, g] as const))(
    "%s meets every 4.5:1 contrast check",
    (_, g) => {
      expect(contrastNotes(g.direction.tokens).filter((n) => !n.ok)).toEqual([]);
    },
  );
  it("keeps its chosen fonts through normalizeTokens", () => {
    for (const g of GALLERY)
      expect(normalizeTokens(g.direction.tokens)).toEqual(g.direction.tokens);
    expect(GALLERY.find((g) => g.id === "unconquerable")!.direction.tokens.headingFont).toBe(
      "Cinzel",
    );
  });
});

describe("any-tool export", () => {
  const g = GALLERY[0]!;
  it("writes a tool-specific line for every listed tool", () => {
    for (const tool of TOOLS) {
      const md = buildPrescription({
        brief: g.brief,
        content: g.content,
        direction: "d",
        tokens: g.direction.tokens,
        picks: [],
        tool,
      });
      expect(md).toContain(`## Tool instruction (${tool})`);
      expect(md).not.toContain("undefined");
    }
  });
  it("pack includes files for other tools and a short prompt", async () => {
    const zip = await JSZip.loadAsync(await buildPack("# rx", g.direction.tokens, "Brand"));
    for (const f of [
      "DESIGN.md",
      "AGENTS.md",
      ".cursorrules",
      ".windsurfrules",
      ".github/copilot-instructions.md",
      "PROMPT-SHORT.md",
      "design-tokens.json",
    ])
      expect(zip.file(f), f).not.toBeNull();
  });
  it("short prompt carries the exact colors", () => {
    const p = shortPrompt(g.direction.tokens, "Brand");
    expect(p).toContain(g.direction.tokens.accent);
    expect(dtcgTokens(g.direction.tokens).color.accent.$value).toBe(g.direction.tokens.accent);
  });
});

import { provenance } from "@/lib/exportPack";
import { ORIGINALS as OG } from "@/lib/gallery";
describe("exports respect each design's effects", () => {
  it("short prompt allows frosted cards and a second colour only when the design has them", () => {
    const glass = OG.find(
      (g) => g.direction.tokens.card === "glass" && g.direction.tokens.accent2,
    )!;
    const p = shortPrompt(glass.direction.tokens, "X");
    expect(p).toContain("frosted glass");
    expect(p).not.toContain("glass cards,");
    expect(p).toContain("a third accent color");
    const plain = OG.find((g) => !g.direction.tokens.card && !g.direction.tokens.accent2)!;
    expect(shortPrompt(plain.direction.tokens, "X")).toContain("glass cards, ");
  });
  it("stamps the same design id for the same values and a new id when values change", () => {
    const t = OG[0]!.direction.tokens;
    expect(provenance(t)).toBe(provenance({ ...t }));
    expect(provenance(t)).not.toBe(provenance({ ...t, radius: t.radius + 2 }));
  });
});
