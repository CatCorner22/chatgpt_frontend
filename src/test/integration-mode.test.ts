import { describe, expect, it } from "vitest";
import { EMPTY, migrate, snap } from "@/lib/studio-state";
import { isDesignStep, record, undo, redo } from "@/lib/undo";
import { workHash, hasUnsavedWork } from "@/lib/ux";
import { archiveDesign, withVersion, type LibraryState } from "@/lib/library";
import { GALLERY } from "@/lib/gallery";

describe("explicit existing-project intent", () => {
  it("migrates legacy restyles without rewriting the owner's brief", () => {
    const brief = "Redesign this checkout without changing behavior";
    const legacy = migrate({ brief });
    expect(legacy).toMatchObject({ brief, integration: "existing" });
    expect(migrate({ ...legacy, integration: "new" })).toMatchObject({ brief, integration: "new" });
    expect(migrate({ brief: "A new bakery site" })).toMatchObject({ integration: "new" });
  });
  it("rejects unreadable intent instead of silently exporting a new-build pack", () => {
    expect(() => migrate({ integration: "overwrite" } as never)).toThrow("unreadable");
  });
  it("makes switching modes an undoable decision and invalidates the prior export", () => {
    const before = {
      ...EMPTY,
      integration: "new" as const,
      tokens: GALLERY[0]!.direction.tokens,
      content: GALLERY[0]!.content,
    };
    const after = { ...before, integration: "existing" as const, savedHash: workHash(before) };
    expect(isDesignStep(before, after)).toBe(true);
    expect(hasUnsavedWork(after)).toBe(true);
    const previous = undo(record(before, snap(before)), snap(after))!;
    expect(previous.state.integration).toBe("new");
    expect(redo(previous.t, previous.state)!.state.integration).toBe("existing");
  });
  it("retains the old deliverable intent as a library revision", () => {
    const state = {
      ...EMPTY,
      libraryId: "intent-test",
      tokens: GALLERY[0]!.direction.tokens,
      content: GALLERY[0]!.content,
    } as unknown as LibraryState;
    const list = archiveDesign([], state, "2026-11-18T00:00:00Z");
    const changed = withVersion(
      list,
      { ...state, integration: "existing" },
      "2026-11-18T00:01:00Z",
    );
    expect(changed[0]!.versions).toHaveLength(1);
    expect(migrate(changed[0]!.versions![0]!.state).integration).toBe("new");
  });
});
