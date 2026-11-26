import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LayoutPreview } from "@/components/LayoutPreview";
import { normalizeTokens } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";
import { pageOptionsWithImages } from "@/lib/page-options-with-images";
import { measureTrickyLayout, trickyLayoutExample } from "@/lib/layout-stress-preview";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/?view=studio">{children}</a>,
}));

// jsdom supplies no layout geometry. The browser suite covers actual text boxes and viewports.
vi.mock("@/lib/authored-viewport", () => ({ measureAuthoredViewport: () => () => {} }));
const content = {
  brand: "Garden workshop",
  headline: "Words from the owner",
  sub: "A small gathering",
  features: [{ title: "Morning lesson", body: "$35 with lunch" }],
  cta: "Choose a morning",
  quote: "",
};
const page = { ...DEFAULT_PAGE_SETTINGS, actionUrl: "https://example.test/gather" };
const tokens = normalizeTokens({});

describe("layout preview", () => {
  it("restores the exact ordinary preview after trying a different screen and tricky copy", async () => {
    const onReady = vi.fn();
    const saved = Object.entries(localStorage);
    render(<LayoutPreview content={content} page={page} tokens={tokens} onReady={onReady} />);
    const ordinary = await screen.findByTitle("Studio layout preview on phone");
    const original = ordinary.getAttribute("srcdoc");
    expect(original).toContain(content.headline);
    const previewDoc = new DOMParser().parseFromString(original!, "text/html");
    expect(previewDoc.querySelector("base")?.getAttribute("href")).toBe("about:srcdoc");
    expect(previewDoc.querySelector('a[href="#main"]')?.getAttribute("target")).toBeNull();
    expect(
      previewDoc.querySelector('a[href="https://example.test/gather"]')?.getAttribute("target"),
    ).toBe("_blank");
    expect(ordinary).toHaveAttribute("sandbox", "");
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));

    fireEvent.click(screen.getByRole("button", { name: "Try tricky content" }));
    expect(onReady).toHaveBeenLastCalledWith(false);
    const sample = screen.getByTitle("Studio layout preview on phone");
    expect(sample.getAttribute("srcdoc")).toContain("A weekend workshop");
    expect(sample.getAttribute("srcdoc")).toContain("$12,450.75");
    expect(sample.getAttribute("srcdoc")).not.toContain("example.invalid");
    fireEvent.load(sample);
    expect(onReady).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
    const wide = screen.getByTitle("Studio layout preview on desktop");
    expect(wide.style.width).toBe("1024px");
    fireEvent.click(screen.getByRole("button", { name: "Try tricky content" }));
    const restored = screen.getByTitle("Studio layout preview on desktop");
    expect(restored.getAttribute("srcdoc")).toBe(original);
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
    expect(Object.entries(localStorage)).toEqual(saved);
  });

  it("keeps missing image data out of the preview and withholds readiness", async () => {
    const onReady = vi.fn();
    render(
      <LayoutPreview
        content={content}
        page={{ ...page, imageId: "a".repeat(64), imageAlt: "Owner’s image" }}
        tokens={tokens}
        onReady={onReady}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/saved image is missing/),
    );
    expect(screen.queryByTitle(/layout preview on/)).toBeNull();
    expect(onReady).not.toHaveBeenCalledWith(true);
  });

  it("retains both owner image slots in the ordinary layout and removes only the lead photo from the rehearsal", () => {
    const lead = {
      imageAlt: "Kimono on a worktable",
      imageCredit: "Owner",
      imageId: "a".repeat(64),
    };
    const relatedStory = {
      title: "Reading",
      url: "https://example.test/reading",
      placement: "after-article" as const,
      imageId: "b".repeat(64),
      imageAlt: "Silk fabric",
      imageCredit: "Studio",
    };
    const options = pageOptionsWithImages(
      { ...page, ...lead, relatedStory },
      "lead-data",
      "story-data",
    );
    const source = JSON.stringify({ content, options });
    const rehearsal = trickyLayoutExample(content, options);
    expect(rehearsal.options).not.toHaveProperty("image");
    expect(rehearsal.options.relatedStory?.image?.src).toBe("story-data");
    expect(options.image).toEqual({ src: "lead-data", alt: lead.imageAlt, credit: "Owner" });
    expect(JSON.stringify({ content, options })).toBe(source);
  });

  it("reports absent or hidden text and sideways overflow independently", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    try {
      const doc = frame.contentDocument!;
      doc.body.innerHTML = "<main><h1>A weekend workshop</h1></main>";
      Object.defineProperties(doc.documentElement, {
        clientWidth: { value: 320 },
        scrollWidth: { value: 321 },
      });
      // Model just the glyph bounds and computed styles that jsdom cannot calculate.
      vi.spyOn(doc, "createRange").mockReturnValue({
        selectNodeContents() {},
        getClientRects: () => [
          { left: 20, right: 200, top: 0, bottom: 30, width: 180, height: 30 },
        ],
      } as unknown as Range);
      vi.spyOn(doc.defaultView!, "getComputedStyle").mockImplementation(
        (element) =>
          ({
            visibility: element.hasAttribute("data-hidden") ? "hidden" : "visible",
            opacity: "1",
            overflowX: "visible",
            overflowY: "visible",
          }) as CSSStyleDeclaration,
      );
      const main = doc.querySelector("main")!;
      for (const [index, feature] of trickyLayoutExample(
        content,
        page,
      ).content.features.entries()) {
        const section = doc.createElement("section");
        section.id = `feature-${index + 1}`;
        const price = doc.createElement("h3");
        price.textContent = feature.title;
        section.append(price);
        main.append(section);
      }
      const link = doc.createElement("a");
      link.className = "action";
      link.innerHTML = "<span>Reserve a place for your whole group</span>";
      // The renderer can put a visible action in the hero and repeat it in a clipped closing section.
      main.append(link.cloneNode(true));
      link.setAttribute("data-hidden", "true");
      const closing = doc.createElement("section");
      closing.className = "closing";
      closing.append(link);
      main.append(closing);
      doc.querySelector("#feature-3")!.remove();
      const issues = measureTrickyLayout(doc);
      expect(issues).toHaveLength(4);
      expect(issues.join(" ")).toMatch(/headline/);
      expect(issues.join(" ")).toMatch(/scrolls sideways/);
      expect(issues.join(" ")).toMatch(/Family table/);
      expect(issues.join(" ")).toMatch(/booking button label in the closing section/);
      link.removeAttribute("data-hidden");
      link.replaceChildren();
      expect(measureTrickyLayout(doc)).toEqual(issues);
    } finally {
      frame.remove();
    }
  });
});
