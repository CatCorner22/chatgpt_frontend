import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { normalizeTokens } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";
import { webcrypto } from "node:crypto";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/quality">{children}</a>,
}));
const id = "a".repeat(64);
const content = {
  brand: "Studio",
  headline: "A careful page",
  sub: "Owner words.",
  cta: "Contact",
  features: [],
  quote: "",
};
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
});
describe("persisted image recovery before handoff", () => {
  it.each([null, "data:image/png;base64,AAAA", "data:image/png;base64,iVBORw0KGgo="])(
    "does not offer a complete handoff for unreadable stored data %s",
    async (raw) => {
      if (raw !== null) localStorage.setItem(`focus:page-image:${id}`, raw);
      render(
        <AuthoredPagePanel
          tokens={normalizeTokens({})}
          content={content}
          settings={{ ...DEFAULT_PAGE_SETTINGS, imageId: id, imageAlt: "Owner image" }}
          onSettings={vi.fn()}
          onContent={vi.fn()}
          onExport={vi.fn()}
          projectState={{}}
        />,
      );
      await screen.findByText(/Your chosen image is missing or unreadable/);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeDisabled(),
      );
      expect(screen.getByRole("button", { name: "Download working HTML" })).toBeDisabled();
      expect(localStorage.getItem(`focus:page-image:${id}`)).toBe(raw);
    },
  );
});
