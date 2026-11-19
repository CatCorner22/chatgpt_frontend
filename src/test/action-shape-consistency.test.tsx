import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DesignPreview } from "@/components/DesignPreview";
import { ComponentSheet } from "@/components/ComponentSheet";
import { PageType } from "@/components/PageTypes";
import { normalizeTokens } from "@/lib/design";
import { buildAuthoredPage } from "@/lib/authored-page";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";

const content = {
  brand: "Owner studio",
  headline: "A real offer",
  sub: "Owner details",
  cta: "Visit the owner",
  features: [],
  quote: "",
};
afterEach(cleanup);

describe("action shape across style study and authored delivery", () => {
  it("shows an outlined primary action in the component sheet without filling its surface", () => {
    const tokens = normalizeTokens({ buttonStyle: "outline", radius: 23 });
    render(<ComponentSheet t={tokens} c={content} />);
    expect(screen.getByRole("button", { name: content.cta })).toHaveStyle({
      background: "transparent",
      borderRadius: "23px",
    });
  });

  it.each(["home", "pricing", "form", "article", "component sheet"] as const)(
    "keeps underlined actions square in the %s preview",
    (kind) => {
      const tokens = normalizeTokens({ buttonStyle: "underline", radius: 23 });
      if (kind === "home") render(<DesignPreview t={tokens} c={content} />);
      else if (kind === "component sheet") render(<ComponentSheet t={tokens} c={content} />);
      else render(<PageType kind={kind} t={tokens} c={content} />);
      const actions = screen.getAllByText(content.cta).filter((node) => node.style.borderBottom);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) expect(action).toHaveStyle({ borderRadius: "0" });
      const output = buildAuthoredPage(tokens, content, {
        ...DEFAULT_PAGE_SETTINGS,
        actionUrl: "https://example.test/owner",
      });
      expect(output.css).toContain("border-width: 0 0 2px; border-radius: 0");
      expect(output.html).toContain('href="https://example.test/owner"');
    },
  );
});
