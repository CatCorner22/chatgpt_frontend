import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { normalizeTokens } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS, readPageImage, savePageImage } from "@/lib/page-settings";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/quality">{children}</a>,
}));
vi.mock("@/lib/page-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/page-settings")>()),
  savePageImage: vi.fn(),
  readPageImage: vi.fn(),
}));
// These tests exercise editor/upload lifetime. Stored-byte validation has its
// own corruption regressions and real-browser decoding checks.
vi.mock("@/lib/page-image-asset", () => ({
  validatePageImageAsset: vi.fn(async () => "data:image/png;base64,iVBORw0KGgo="),
}));
const content = {
  brand: "Studio",
  headline: "A careful page",
  sub: "Actual project words.",
  cta: "Contact",
  features: [],
  quote: "",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readPageImage).mockReturnValue(null);
});
describe("image upload lifetime", () => {
  it.each(["Showcase", "Journal"])(
    "lets an owner select the %s composition without replacing their words",
    (title) => {
      const onSettings = vi.fn(),
        onContent = vi.fn();
      render(
        <AuthoredPagePanel
          tokens={normalizeTokens({})}
          content={content}
          settings={DEFAULT_PAGE_SETTINGS}
          onSettings={onSettings}
          onContent={onContent}
          onExport={vi.fn()}
          projectState={{}}
        />,
      );
      fireEvent.click(screen.getByRole("radio", { name: new RegExp("^" + title) }));
      expect(onSettings).toHaveBeenCalledWith({
        ...DEFAULT_PAGE_SETTINGS,
        composition: title.toLowerCase(),
      });
      expect(onContent).not.toHaveBeenCalled();
    },
  );
  it("focuses the first field when the owner opens the words editor", () => {
    render(
      <AuthoredPagePanel
        tokens={normalizeTokens({})}
        content={content}
        settings={DEFAULT_PAGE_SETTINGS}
        onSettings={vi.fn()}
        onContent={vi.fn()}
        onExport={vi.fn()}
        projectState={{}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit the page’s words" }));
    expect(screen.getByLabelText("Business or project name")).toHaveFocus();
  });
  it("explains why an uploaded image without a description is absent from the page", async () => {
    vi.mocked(readPageImage).mockReturnValue(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=",
    );
    render(
      <AuthoredPagePanel
        tokens={normalizeTokens({})}
        content={content}
        settings={{ ...DEFAULT_PAGE_SETTINGS, imageId: "a".repeat(64) }}
        onSettings={vi.fn()}
        onContent={vi.fn()}
        onExport={vi.fn()}
        projectState={{}}
      />,
    );
    expect(
      await screen.findByText(
        "Add an image description to include it in the preview and download.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Describe the image")).toHaveAttribute("aria-required", "true");
    await waitFor(() =>
      expect(screen.queryByText("Checking and saving the image…")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download working HTML" })).toBeDisabled();
  });
  it("never attaches a pending image to a different design after the editor unmounts", async () => {
    let finish!: (id: string) => void;
    vi.mocked(savePageImage).mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const onSettings = vi.fn();
    const { unmount } = render(
      <AuthoredPagePanel
        tokens={normalizeTokens({})}
        content={content}
        settings={DEFAULT_PAGE_SETTINGS}
        onSettings={onSettings}
        onContent={vi.fn()}
        onExport={vi.fn()}
        projectState={{}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/PNG, JPEG, or WebP/), {
      target: { files: [new File(["bytes"], "photo.png", { type: "image/png" })] },
    });
    expect(savePageImage).toHaveBeenCalledOnce();
    unmount();
    await act(async () => {
      finish("a".repeat(64));
    });
    expect(onSettings).not.toHaveBeenCalled();
  });
  it("preserves edits made while the image was being saved", async () => {
    let finish!: (id: string) => void;
    vi.mocked(savePageImage).mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const onSettings = vi.fn();
    const props = {
      tokens: normalizeTokens({}),
      content,
      onSettings,
      onContent: vi.fn(),
      onExport: vi.fn(),
      projectState: {},
    };
    const { rerender } = render(<AuthoredPagePanel {...props} settings={DEFAULT_PAGE_SETTINGS} />);
    fireEvent.change(screen.getByLabelText(/PNG, JPEG, or WebP/), {
      target: { files: [new File(["bytes"], "photo.png", { type: "image/png" })] },
    });
    const revised = {
      ...DEFAULT_PAGE_SETTINGS,
      composition: "editorial" as const,
      actionUrl: "https://example.com/contact",
    };
    rerender(<AuthoredPagePanel {...props} settings={revised} />);
    await act(async () => {
      finish("a".repeat(64));
    });
    expect(onSettings).toHaveBeenCalledWith({ ...revised, imageId: "a".repeat(64) });
  });
});
