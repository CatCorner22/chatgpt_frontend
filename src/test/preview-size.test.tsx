import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewFrame } from "@/components/DesignPreview";
import { GALLERY } from "@/lib/gallery";

afterEach(() => vi.unstubAllGlobals());
describe("app specimen on a narrow screen", () => {
  it("opens a readable phone layout and allows an explicit scrollable desktop comparison", () => {
    vi.stubGlobal("innerWidth", 320);
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const g = GALLERY[0]!;
    render(<PreviewFrame t={g.direction.tokens} c={g.content} experience="app" />);
    expect(screen.getByRole("button", { name: "Phone" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
    expect(screen.getByRole("region", { name: "Desktop design preview" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("button", { name: "Desktop" })).toHaveAttribute("aria-pressed", "true");
  });
});
