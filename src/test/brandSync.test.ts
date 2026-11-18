import { describe, expect, it } from "vitest";
import { GALLERY } from "@/lib/gallery";
import { fromRows, mergeBuilds, toRow } from "@/lib/brandSync";
import type { LibraryEntry } from "@/lib/library";

const g = GALLERY[0]!;
const e = (id: string, updated: string, title = "Site"): LibraryEntry => ({
  id,
  title,
  collection: "Acme",
  favorite: false,
  created: "2026-11-01T00:00:00Z",
  updated,
  state: { tokens: g.direction.tokens, content: g.content, libraryId: id },
});
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("brand sync across devices", () => {
  it("brings in builds made on another device", () => {
    const { merged, push } = mergeBuilds(
      [e(A, "2026-11-02T00:00:00Z")],
      [e(B, "2026-11-03T00:00:00Z")],
    );
    expect(merged.map((x) => x.id).sort()).toEqual([A, B]);
    expect(push.map((x) => x.id)).toEqual([A]);
  });
  it("keeps the newer edit of the same build", () => {
    const { merged, push } = mergeBuilds(
      [e(A, "2026-11-02T00:00:00Z", "old")],
      [e(A, "2026-11-05T00:00:00Z", "new")],
    );
    expect(merged[0]!.title).toBe("new");
    expect(push).toHaveLength(0);
  });
  it("uploads a newer browser edit", () => {
    expect(
      mergeBuilds([e(A, "2026-11-09T00:00:00Z")], [e(A, "2026-11-05T00:00:00Z")]).push,
    ).toHaveLength(1);
  });
  it("round-trips a build through the account format and skips damaged rows", () => {
    const back = fromRows([
      toRow(e(A, "2026-11-02T00:00:00Z")),
      { ...toRow(e(B, "2026-11-02T00:00:00Z")), state: { nope: 1 } },
    ]);
    expect(back.map((x) => x.id)).toEqual([A]);
    expect(back[0]!.collection).toBe("Acme");
  });
});
