import { useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { normalizeTokens, type Content } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/page-settings";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/quality">{children}</a>,
}));

const words: Content = {
  brand: "Riverside Workshop",
  headline: "A place to make something meaningful.",
  sub: "Small pottery classes beside the river, with materials included.",
  cta: "Choose your class",
  features: [{ title: "A guided session", body: "Work at your own pace with our tutor." }],
  quote: "I left with a bowl I made myself.",
};
const tokens = normalizeTokens({});
function Editor({
  composition = "studio",
  actionUrl = "",
}: {
  composition?: PageSettings["composition"];
  actionUrl?: string;
}) {
  const [content, setContent] = useState(words);
  const [settings, setSettings] = useState({ ...DEFAULT_PAGE_SETTINGS, composition, actionUrl });
  return (
    <AuthoredPagePanel
      tokens={tokens}
      content={content}
      settings={settings}
      onContent={setContent}
      onSettings={setSettings}
      onExport={() => undefined}
      projectState={{ libraryId: "content-flow", content, page: settings }}
    />
  );
}
function previewDocument() {
  const frame = screen.getByTitle("Working page preview") as HTMLIFrameElement;
  return new DOMParser().parseFromString(frame.srcdoc, "text/html");
}
function removeLastFeature() {
  fireEvent.click(screen.getByRole("button", { name: "Edit the page’s words" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove feature 1" }));
}
function expectOneOpeningExplanation(page: Document) {
  const explanation = page.querySelector(".hero-sub");
  expect(explanation?.textContent).toBe(words.sub);
  expect(page.body.textContent?.split(words.sub)).toHaveLength(2);
  expect(
    page.querySelector("h1")!.compareDocumentPosition(explanation!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const action = page.querySelector(".hero-actions a");
  if (action)
    expect(
      explanation!.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  for (const link of page.querySelectorAll('a[href^="#"]'))
    expect(page.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
}

afterEach(cleanup);

describe("Authored content editing flow", () => {
  it.each(["studio", "editorial", "product", "showcase", "journal"] as const)(
    "removes the last feature in %s without hiding the explanation or leaving a pretend action",
    (composition) => {
      render(<Editor composition={composition} />);
      expect(previewDocument().querySelector("#details")?.textContent).toContain(
        words.features[0]!.body,
      );
      removeLastFeature();
      const page = previewDocument();
      expectOneOpeningExplanation(page);
      expect(
        page.querySelector("#details, .hero-actions, .site-nav, .feature-index, .journal-index"),
      ).toBeNull();
      expect(page.querySelector('a[href="#details"]')).toBeNull();
      expect(page.querySelector(".brand")?.textContent).toBe(words.brand);
      expect(page.querySelector("h1")?.textContent).toBe(words.headline);
      expect(page.querySelector("blockquote")?.textContent).toContain(words.quote);
      expect(screen.getByLabelText("Supporting sentence")).toHaveValue(words.sub);
      expect(screen.getByLabelText("Main button text")).toHaveValue(words.cta);
      expect(screen.getByRole("button", { name: "Download working HTML" })).toBeEnabled();
    },
  );

  it("keeps the real destination and owner label when the last feature is removed", () => {
    const destination = "https://example.com/classes?source=riverside";
    render(<Editor composition="showcase" actionUrl={destination} />);
    removeLastFeature();
    const page = previewDocument();
    expectOneOpeningExplanation(page);
    expect(page.querySelector("#details")).toBeNull();
    expect(page.querySelector('a[href="#details"]')).toBeNull();
    for (const selector of [".site-nav a", ".hero-actions a", ".closing a"]) {
      const link = page.querySelector(selector);
      expect(link?.getAttribute("href")).toBe(destination);
      expect(link?.textContent?.trim()).toBe(words.cta);
    }
    expect(screen.getByLabelText("Where should the main action lead?")).toHaveValue(destination);
    expect(screen.getByLabelText("Business or project name")).toHaveValue(words.brand);
    expect(screen.getByLabelText("Headline")).toHaveValue(words.headline);
  });

  it("restores a useful details link only after a newly added feature contains real text", () => {
    render(<Editor composition="journal" actionUrl="javascript:alert(1)" />);
    expect(previewDocument().querySelector(".hero-actions a")?.getAttribute("href")).toBe(
      "#details",
    );
    removeLastFeature();
    expect(previewDocument().querySelector("#details, .hero-actions, .site-nav")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
    fireEvent.change(screen.getByLabelText("Feature 1"), { target: { value: "   " } });
    expect(previewDocument().querySelector("#details, .hero-actions, .site-nav")).toBeNull();
    fireEvent.change(screen.getByLabelText("Feature 1"), {
      target: { value: "Bring your curiosity" },
    });
    fireEvent.change(screen.getByLabelText("Feature 1 description"), {
      target: { value: "We provide the tools and clay." },
    });
    const page = previewDocument();
    expectOneOpeningExplanation(page);
    expect(page.querySelector("#details")?.textContent).toContain("We provide the tools and clay.");
    expect(page.querySelector(".hero-actions a")?.getAttribute("href")).toBe("#details");
    expect(page.querySelector(".hero-actions a")?.textContent).toContain("Explore details");
    expect(page.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(page.querySelector(".closing")).toBeNull();
    expect(screen.getByLabelText("Main button text")).toHaveValue(words.cta);
  });
});
