import { describe, expect, it } from "vitest";
import { accountSaveResult, workHash } from "@/lib/ux";

const saved = {
  brief: "Studio",
  direction: "Calm",
  tokens: { ink: "#000000" },
  picks: [],
  content: { headline: "Our work" },
  page: { imageId: null as string | null },
  libraryId: "design-a",
  projectId: null as string | null,
  savedHash: null as string | null,
};

describe("account save acknowledgement", () => {
  it("marks only the submitted snapshot preserved while retaining later edits", () => {
    const current = { ...saved, content: { headline: "New words during save" } };
    const next = accountSaveResult(current, saved, "cloud-a");
    expect(next.content).toEqual(current.content);
    expect(next.projectId).toBe("cloud-a");
    expect(next.savedHash).toBe(workHash(saved));
    expect(next.savedHash).not.toBe(workHash(current));
  });
  it("does not claim locally stored image bytes were saved to the account", () => {
    const localImage = { ...saved, page: { imageId: "a".repeat(64) } };
    const next = accountSaveResult(localImage, localImage, "cloud-a");
    expect(next.projectId).toBe("cloud-a");
    expect(next.savedHash).toBeNull();
  });
  it("never attaches a delayed account save to a different design", () => {
    const different = { ...saved, libraryId: "design-b" };
    expect(accountSaveResult(different, saved, "cloud-a")).toBe(different);
  });
});
