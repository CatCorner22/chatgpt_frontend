import { exportSourceFromPreview } from "../../scripts/fixtures/preview-source.mjs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthoredPageEditor } from "@/components/AuthoredPageEditor";
import { families } from "@/lib/authored-families";
import { CompositionComparison } from "@/components/CompositionComparison";
import { normalizeTokens, type Content } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/page-settings";
import { renderAuthoredPage } from "@/lib/render-authored-page";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/quality">{children}</a>,
}));

const words: Content = {
  brand: "River Press",
  headline: "Walking the reed beds",
  sub: "Three generations have cut reeds on this bend.",
  cta: "Read the field notes",
  features: [
    { title: "Finding the channel", body: "A narrow tide window." },
    { title: "A hand-built boat", body: "Making the shallow hull." },
  ],
  quote: "We travel on the tide.",
};
const options = { ...DEFAULT_PAGE_SETTINGS, actionUrl: "https://example.org/field" };
const tokens = normalizeTokens({});
function html(title: string) {
  return exportSourceFromPreview((screen.getByTitle(title) as HTMLIFrameElement).srcdoc);
}
function open() {
  fireEvent.click(screen.getByRole("button", { name: "Compare layouts with your content" }));
}
afterEach(cleanup);

describe("task-based authored page comparison", () => {
  it("auditions distinct reading structures using the exact delivered copy, with no changes until applied", () => {
    const changes = vi.fn(),
      onExport = vi.fn();
    function Editor() {
      const [settings, setSettings] = useState<PageSettings>(options);
      return (
        <AuthoredPageEditor
          families={families}
          tokens={tokens}
          content={words}
          settings={settings}
          onSettings={(next) => {
            changes(next);
            setSettings(next);
          }}
          onContent={vi.fn()}
          onExport={onExport}
          projectState={{ libraryId: "editorial" }}
        />
      );
    }
    render(<Editor />);
    expect(screen.queryByTitle(/comparison on/)).toBeNull();
    open();
    fireEvent.change(screen.getByLabelText("What does your visitor want to do?"), {
      target: { value: "read" },
    });
    const expected = renderAuthoredPage(
      tokens,
      words,
      { ...options, composition: "journal" },
      families,
    ).html;
    expect(html("Journal comparison on phone")).toBe(expected);
    expect(html("Editorial comparison on phone")).not.toContain(
      'aria-labelledby="page-index-title"',
    );
    expect(html("Journal comparison on phone")).toContain('aria-labelledby="page-index-title"');
    fireEvent.change(screen.getByLabelText("Compare", { exact: true }), {
      target: { value: "second" },
    });
    expect(screen.getByTitle("Journal comparison on desktop")).toHaveStyle({ width: "1024px" });
    expect(screen.getByTitle("Journal comparison on phone")).toHaveStyle({ width: "320px" });
    expect(html("Journal comparison on desktop")).toBe(expected);
    expect(changes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use Journal layout" }));
    expect(changes).toHaveBeenCalledExactlyOnceWith({ ...options, composition: "journal" });
    expect(html("Working page preview")).toBe(expected);
    expect(screen.getByRole("button", { name: "Using Journal" })).toBeDisabled();
    expect(onExport).not.toHaveBeenCalled();
    open();
    expect(screen.queryByTitle(/comparison on/)).toBeNull();
  });

  it("withdraws incomplete previews and keeps workshop constraints active", () => {
    const choose = vi.fn();
    const props = {
      tokens,
      content: { ...words, features: [] },
      options,
      families,
      onChoose: choose,
    };
    const { rerender } = render(<CompositionComparison {...props} assetsBlocked applyBlocked />);
    open();
    expect(screen.queryByTitle(/comparison on/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use Product layout" }));
    expect(choose).not.toHaveBeenCalled();
    rerender(<CompositionComparison {...props} assetsBlocked={false} applyBlocked />);
    expect(html("Product comparison on phone")).toContain(words.headline);
    expect(screen.getByText(/add descriptions to your details/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Product layout" })).toBeDisabled();
    rerender(<CompositionComparison {...props} assetsBlocked={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Product layout" }));
    expect(choose).toHaveBeenCalledExactlyOnceWith("product");
  });
});
