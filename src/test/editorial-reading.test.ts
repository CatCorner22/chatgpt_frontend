import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildAuthoredPage } from "@/lib/authored-page";
import { buildStudioLaunchArtifact } from "@/lib/studio-launch-artifact";
import { normalizePageSettings } from "@/lib/page-settings";
import { validateCompleteLibraryBackup } from "@/lib/transfer";
import { launchFingerprint } from "@/lib/launch";
import { isDesignStep, undo } from "@/lib/undo";
import { hasBrowserOnlyImage } from "@/lib/ux";
import { migrate, snap } from "@/lib/studio-state";

const sample = JSON.parse(readFileSync("public/examples/looking-room.focus.json", "utf8"));
const saved = migrate(sample.entries[0].state);
const story = saved.page.relatedStory!;
const image = {
  src: sample.assets.images[story.imageId!],
  alt: story.imageAlt,
  credit: story.imageCredit!,
};
const options = {
  ...saved.page,
  relatedStory: { title: story.title, url: story.url, placement: story.placement, image },
};
const render = (input: typeof options) => buildAuthoredPage(saved.tokens!, saved.content!, input);

describe("portable editorial reading", () => {
  it("retains the source image credit, genuine destination, and chosen order in both page formats", () => {
    const built = render(options);
    const doc = new DOMParser().parseFromString(built.html, "text/html");
    const row = doc.querySelector(".related-story")!;
    expect(row.querySelector("h2 a")?.getAttribute("href")).toBe(story.url);
    expect(row.querySelector("figcaption")?.textContent).toBe(story.imageCredit);
    expect(row.querySelector("img")?.getAttribute("alt")).toBe(story.imageAlt);
    expect(row.previousElementSibling?.id).toBe("details");
    const earlier = render({
      ...options,
      relatedStory: { ...options.relatedStory, placement: "after-intro" },
    });
    const linked = new DOMParser().parseFromString(earlier.files["index.html"]!, "text/html");
    expect(linked.querySelector(".hero + .related-story")?.nextElementSibling?.id).toBe("details");
  });
  it.each([
    "javascript:void(0)",
    "https://user:password@example.org/",
    "mailto:editor@example.org",
    "/guessed",
  ])("omits the incomplete reading link for %s", (url) => {
    const built = render({ ...options, relatedStory: { ...options.relatedStory, url } });
    expect(built.readiness.some((item) => item.id === "story-link")).toBe(true);
    expect(built.html).not.toContain('id="related-story-title"');
  });
  it("requires a credit for the supporting image and escapes words supplied by the owner", () => {
    const built = render({
      ...options,
      relatedStory: {
        ...options.relatedStory,
        title: "<em>Close reading</em>",
        image: { ...image, credit: " " },
      },
    });
    const row = new DOMParser()
      .parseFromString(built.html, "text/html")
      .querySelector(".related-story")!;
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector("h2 em")).toBeNull();
    expect(row.querySelector("a")?.textContent).toBe("<em>Close reading</em>");
    expect(built.readiness.some((item) => item.id === "story-image")).toBe(true);
  });
  it("changes the exact launch identity, survives reopening and undo, and recognizes story-only local images", () => {
    const revised = {
      ...saved,
      page: normalizePageSettings({
        ...saved.page,
        relatedStory: { ...story, title: "After the wave" },
      }),
    };
    expect(isDesignStep(saved, revised)).toBe(true);
    expect(launchFingerprint(saved.tokens, buildStudioLaunchArtifact(saved))).not.toBe(
      launchFingerprint(revised.tokens, buildStudioLaunchArtifact(revised)),
    );
    expect(
      undo({ past: [snap(saved)], future: [] }, snap(revised))!.state.page.relatedStory,
    ).toEqual(story);
    expect(migrate(JSON.parse(JSON.stringify(revised))).page.relatedStory?.title).toBe(
      "After the wave",
    );
    expect(hasBrowserOnlyImage({ ...saved, page: { ...saved.page, imageId: null } })).toBe(true);
  });
  it("retains the local-image reminder when a removed story image still belongs to Undo", () => {
    const previous = { ...saved, page: { ...saved.page, imageId: null } };
    const removed = { ...previous, page: normalizePageSettings(null), past: [snap(previous)] };
    expect(hasBrowserOnlyImage(removed)).toBe(true);
    expect(hasBrowserOnlyImage({ ...removed, past: [] })).toBe(false);
  });
  it("refuses a handoff missing the second image, including when it exists only in Undo", async () => {
    const broken = structuredClone(sample);
    const older = structuredClone(broken.entries[0].state);
    delete broken.entries[0].state.page.relatedStory;
    broken.entries[0].state.past = [older];
    delete broken.assets.images[story.imageId!];
    await expect(validateCompleteLibraryBackup(JSON.stringify(broken))).rejects.toThrow(
      /missing an image/,
    );
  });
});
