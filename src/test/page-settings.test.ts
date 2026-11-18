import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SETTINGS,
  normalizePageSettings,
  readPageImage,
  rasterMime,
} from "@/lib/page-settings";
import { workHash, hasUnsavedWork } from "@/lib/ux";
import { isDesignStep } from "@/lib/undo";

afterEach(() => localStorage.clear());
describe("portable page settings", () => {
  it.each(["showcase", "journal"])(
    "preserves the %s choice when returning to a saved page",
    (composition) => {
      expect(normalizePageSettings({ composition }).composition).toBe(composition);
    },
  );
  it("identifies image bytes independently of the untrusted filename and MIME label", () => {
    expect(rasterMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(rasterMime(new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
    expect(rasterMime(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))).toBe(
      "image/webp",
    );
    expect(rasterMime(new TextEncoder().encode("<svg/>"))).toBeNull();
    expect(rasterMime(new Uint8Array())).toBeNull();
  });
  it("migrates missing or malformed saved settings without trusting asset URLs", () => {
    expect(normalizePageSettings(null)).toEqual(DEFAULT_PAGE_SETTINGS);
    expect(
      normalizePageSettings({
        composition: "script",
        actionUrl: 42,
        imageId: "https://example.com/track",
        imageAlt: {},
      }),
    ).toEqual(DEFAULT_PAGE_SETTINGS);
    const valid = {
      composition: "editorial",
      actionUrl: "mailto:hello@example.com",
      imageId: "a".repeat(64),
      imageAlt: "A ceramic vase",
    };
    expect(normalizePageSettings(valid)).toEqual(valid);
  });
  it("only restores embedded raster assets with a stable key", () => {
    const id = "a".repeat(64);
    localStorage.setItem("focus:page-image:" + id, "https://example.com/track");
    expect(readPageImage(id)).toBeNull();
    localStorage.setItem("focus:page-image:" + id, "data:image/svg+xml;base64,AAAA");
    expect(readPageImage(id)).toBeNull();
    localStorage.setItem("focus:page-image:" + id, "data:image/png;base64,AAAA");
    expect(readPageImage(id)).toBe("data:image/png;base64,AAAA");
    expect(readPageImage("../bad")).toBeNull();
  });
  it("treats edited words and page decisions as work worth preserving even with skipped questions", () => {
    const state = {
      brief: "Ceramics",
      direction: "Garden",
      tokens: { bg: "#fff" },
      picks: [],
      content: { brand: "Clay House" },
      page: DEFAULT_PAGE_SETTINGS,
    };
    const savedHash = workHash(state);
    expect(hasUnsavedWork({ ...state, savedHash })).toBe(false);
    const page = { ...DEFAULT_PAGE_SETTINGS, actionUrl: "https://example.com/book" };
    expect(hasUnsavedWork({ ...state, page, savedHash })).toBe(true);
    expect(workHash({ ...state, content: { brand: "New name" } })).not.toBe(savedHash);
    expect(isDesignStep(state, { ...state, page })).toBe(true);
    expect(isDesignStep(state, { ...state, content: { brand: "New name" } })).toBe(true);
  });
});
