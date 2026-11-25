import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { normalizeTokens } from "@/lib/design";
import {
  DEFAULT_PAGE_SETTINGS,
  readPageImage,
  savePageImage,
  type PageSettings,
} from "@/lib/page-settings";

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
describe("authored page language", () => {
  it("changes the working page and both comparison layouts while preserving the owner's words", () => {
    const onContent = vi.fn();
    const original: PageSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      actionUrl: "https://example.com/book",
    };
    const props = {
      content: { ...content, headline: "川辺のアトリエ" },
      tokens: normalizeTokens({}),
      onContent,
      onExport: vi.fn(),
      projectState: {},
    };
    const onSettings = vi.fn();
    function Workspace() {
      const [settings, setSettings] = useState(original);
      return (
        <AuthoredPagePanel
          {...props}
          settings={settings}
          onSettings={(next) => {
            onSettings(next);
            setSettings(next);
          }}
        />
      );
    }
    render(<Workspace />);
    const select = screen.getByRole("combobox", { name: "Page language" });
    expect(select).toHaveValue("en");
    fireEvent.click(screen.getByRole("button", { name: /Compare layouts with your content/ }));
    for (const language of ["ja", "en"]) {
      fireEvent.change(select, { target: { value: language } });
      const frames = [
        screen.getByTitle("Working page preview"),
        ...screen.getAllByTitle(/comparison on phone/),
      ];
      expect(frames).toHaveLength(3);
      for (const frame of frames) {
        const page = new DOMParser().parseFromString(frame.getAttribute("srcdoc")!, "text/html");
        expect(page.documentElement.lang).toBe(language);
        expect(page.querySelector("h1")?.textContent).toBe(props.content.headline);
        expect(page.querySelector(".action")?.getAttribute("href")).toBe(original.actionUrl);
      }
    }
    expect(onSettings).toHaveBeenNthCalledWith(1, { ...original, language: "ja" });
    expect(onSettings).toHaveBeenNthCalledWith(2, original);
    expect(onContent).not.toHaveBeenCalled();
  });
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

describe("image framing in the authored workspace", () => {
  const imageId = "a".repeat(64);
  const framed: PageSettings = {
    ...DEFAULT_PAGE_SETTINGS,
    imageId,
    imageAlt: "A bird on the right of the photograph",
    imageFraming: { fit: "cover", position: "right", narrowPosition: "top" },
  };
  const props = () => ({
    tokens: normalizeTokens({}),
    content,
    onSettings: vi.fn(),
    onContent: vi.fn(),
    onExport: vi.fn(),
    projectState: {},
  });
  async function imageReady() {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByText("Add your own image"));
  }
  it("updates the actual preview when framing changes and removes the default override on reset", async () => {
    const onSettings = vi.fn();
    function Workspace() {
      const [settings, setSettings] = useState(framed);
      return (
        <AuthoredPagePanel
          {...props()}
          settings={settings}
          onSettings={(next) => {
            onSettings(next);
            setSettings(next);
          }}
        />
      );
    }
    render(<Workspace />);
    await imageReady();
    const html = () => screen.getByTitle("Working page preview").getAttribute("srcdoc")!;
    expect(html()).toContain("object-position: right center");
    fireEvent.change(screen.getByLabelText("Image position"), { target: { value: "bottom-left" } });
    expect(html()).toContain("object-position: left bottom");
    fireEvent.click(screen.getByRole("radio", { name: "Show the whole image" }));
    expect(html()).toContain("object-fit: contain");
    expect(html()).not.toContain("object-position: left bottom");
    fireEvent.click(screen.getByRole("button", { name: "Reset image framing" }));
    expect(onSettings).toHaveBeenLastCalledWith({
      ...DEFAULT_PAGE_SETTINGS,
      imageId,
      imageAlt: framed.imageAlt,
    });
    expect(html()).not.toContain("object-fit: contain");
    expect(savePageImage).not.toHaveBeenCalled();
  });
  it("keeps framing unavailable until the image has a description", async () => {
    render(<AuthoredPagePanel {...props()} settings={{ ...framed, imageAlt: "" }} />);
    await waitFor(() =>
      expect(screen.queryByText("Checking and saving the image…")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Add your own image"));
    expect(screen.getByRole("radio", { name: "Fill the frame" })).toBeDisabled();
    expect(screen.getByLabelText("Image position")).toBeDisabled();
  });
  it("removes the old framing with the image but retains the description", async () => {
    const current = props();
    render(<AuthoredPagePanel {...current} settings={framed} />);
    await imageReady();
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(current.onSettings).toHaveBeenLastCalledWith({
      ...DEFAULT_PAGE_SETTINGS,
      imageAlt: framed.imageAlt,
    });
  });
  it.each([true, false])(
    "preserves framing only for identical image bytes (same ID: %s)",
    async (same) => {
      let finish!: (id: string) => void;
      vi.mocked(savePageImage).mockReturnValue(
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
      );
      const current = props();
      const { rerender } = render(<AuthoredPagePanel {...current} settings={framed} />);
      await imageReady();
      fireEvent.change(screen.getByLabelText(/PNG, JPEG, or WebP/), {
        target: { files: [new File(["bytes"], "photo.png", { type: "image/png" })] },
      });
      const revised: PageSettings = {
        ...framed,
        actionUrl: "https://example.com",
        imageFraming: { fit: "cover", position: "bottom", narrowPosition: "left" },
      };
      rerender(<AuthoredPagePanel {...current} settings={revised} />);
      const nextId = same ? imageId : "b".repeat(64);
      await act(async () => {
        finish(nextId);
      });
      const expected = { ...revised, imageId: nextId };
      if (!same) delete expected.imageFraming;
      expect(current.onSettings).toHaveBeenLastCalledWith(expected);
    },
  );
  it("offers explicit wide and narrow preview sizes without changing the design", () => {
    const current = props();
    render(<AuthoredPagePanel {...current} settings={DEFAULT_PAGE_SETTINGS} />);
    const frame = screen.getByTitle("Working page preview");
    const original = frame.getAttribute("srcdoc");
    fireEvent.click(screen.getByRole("button", { name: "1024 px" }));
    expect(frame).toHaveClass("is-wide");
    expect(screen.getByRole("region", { name: "Page preview canvas" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    fireEvent.click(screen.getByRole("button", { name: "320 px" }));
    expect(frame).toHaveClass("is-phone");
    fireEvent.click(screen.getByRole("button", { name: "Fit" }));
    expect(frame).not.toHaveClass("is-wide", "is-phone");
    expect(frame.getAttribute("srcdoc")).toBe(original);
    expect(current.onSettings).not.toHaveBeenCalled();
  });
});

describe("related reading transfer controls", () => {
  const openStory = {
    title: "A companion article",
    url: "https://museum.example/articles/two",
    placement: "after-article" as const,
    imageId: null,
    imageAlt: "",
  };
  it("keeps an unfinished link editable and re-enables delivery after the author supplies its real destination", () => {
    function Editor() {
      const [settings, onSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
      return (
        <AuthoredPagePanel
          content={content}
          tokens={normalizeTokens({})}
          settings={settings}
          onSettings={onSettings}
          onContent={vi.fn()}
          onExport={vi.fn()}
          projectState={{}}
        />
      );
    }
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Add a related story" }));
    const download = screen.getByRole("button", { name: "Download page ZIP" });
    expect(download).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Story title"), { target: { value: openStory.title } });
    fireEvent.change(screen.getByLabelText("Story website address"), {
      target: { value: "data:text/html,story" },
    });
    expect(download).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Story website address"), {
      target: { value: openStory.url },
    });
    expect(download).toBeEnabled();
    expect(screen.getByTitle("Working page preview").getAttribute("srcdoc")).toContain(
      openStory.url,
    );
  });
  it("drops an in-flight photo if its story is removed before the upload finishes", async () => {
    let complete!: (value: string) => void;
    vi.mocked(savePageImage).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const onSettings = vi.fn();
    const props = {
      content,
      tokens: normalizeTokens({}),
      onSettings,
      onContent: vi.fn(),
      onExport: vi.fn(),
      projectState: {},
    };
    const { rerender } = render(
      <AuthoredPagePanel
        {...props}
        settings={{ ...DEFAULT_PAGE_SETTINGS, relatedStory: openStory }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Choose a story image"), {
      target: { files: [new File(["test"], "story.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove related story" }));
    expect(onSettings).toHaveBeenLastCalledWith(DEFAULT_PAGE_SETTINGS);
    rerender(<AuthoredPagePanel {...props} settings={DEFAULT_PAGE_SETTINGS} />);
    await act(async () => {
      complete("b".repeat(64));
    });
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeEnabled();
  });
});
