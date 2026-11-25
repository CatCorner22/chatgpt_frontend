import { describe, expect, it } from "vitest";
import { groupBrands, newBuild, syncLook } from "@/lib/brands";
import { GALLERY } from "@/lib/gallery";
import type { LibraryEntry } from "@/lib/library";

const g = GALLERY[0]!,
  h = GALLERY[1]!;
const entry = (
  id: string,
  tokens = g.direction.tokens,
  collection = "",
  created = "2026-01-01",
): LibraryEntry => ({
  id,
  title: id,
  collection,
  favorite: false,
  created,
  updated: created,
  state: { tokens, content: g.content, libraryId: id, purpose: {} },
});

describe("brand workspace", () => {
  it("groups builds of the same brand together", () => {
    const b = groupBrands([
      entry("a"),
      entry("b", g.direction.tokens, "", "2026-02-01"),
      { ...entry("c"), state: { ...entry("c").state, content: h.content } },
    ]);
    expect(b).toHaveLength(2);
    expect(b.find((x) => x.name === g.content.brand)!.builds.map((x) => x.entry.id)).toEqual([
      "a",
      "b",
    ]);
  });
  it("a new app build shares the look, keeps the words, and is its own design", () => {
    const n = newBuild(entry("a"), "app", "z", "2026-03-01");
    expect(n.id).toBe("z");
    expect(n.state.libraryId).toBe("z");
    expect(n.state.tokens).toEqual(g.direction.tokens);
    expect((n.state["purpose"] as { experience: string }).experience).toBe("app");
    expect(groupBrands([entry("a"), n])[0]!.builds.map((x) => [x.kind, x.sameLook])).toEqual([
      ["website", true],
      ["app", true],
    ]);
  });
  it("detaches both inherited timeline directions from the main build and its account save", () => {
    const lead = entry("main");
    const step = { ...lead.state, projectId: "main-project", savedHash: "main-receipt" };
    lead.state = { ...step, past: [step], future: [step] };
    const next = newBuild(lead, "app", "second", "2026-03-01");
    for (const history of ["past", "future"]) {
      expect(next.state[history]).toEqual([
        { ...step, libraryId: "second", projectId: null, savedHash: null, cache: {} },
      ]);
      expect(lead.state[history]).toEqual([step]);
    }
  });
  it("flags a build whose look drifted and can bring it back in line", () => {
    const drift = entry("b", h.direction.tokens, g.content.brand, "2026-02-01");
    const b = groupBrands([entry("a"), drift])[0]!;
    expect(b.builds[1]!.sameLook).toBe(false);
    const fixed = syncLook(drift, b.lead, "2026-04-01");
    expect(groupBrands([entry("a"), fixed])[0]!.builds[1]!.sameLook).toBe(true);
    expect(fixed.state.content).toEqual(drift.state.content);
  });
});
