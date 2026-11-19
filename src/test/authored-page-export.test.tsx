import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { normalizeTokens } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/page-settings";

const calls = vi.hoisted(() => ({
  generate: vi.fn(),
  files: [] as Record<string, string>[],
  download: vi.fn(),
  owner: vi.fn(),
  saveImage: vi.fn(),
  validateImage: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("jszip", () => ({
  default: class {
    entries: Record<string, string> = {};
    constructor() {
      calls.files.push(this.entries);
    }
    file(name: string, body: string) {
      this.entries[name] = body;
      return this;
    }
    generateAsync() {
      return calls.generate();
    }
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/quality">{children}</a>,
}));
vi.mock("@/lib/exportPack", () => ({ downloadBlob: calls.download }));
vi.mock("@/lib/browser-storage", () => ({ getBrowserOwnerId: calls.owner }));
vi.mock("@/lib/page-settings", async (original) => ({
  ...(await original<typeof import("@/lib/page-settings")>()),
  savePageImage: calls.saveImage,
  readPageImage: () => "data:image/png;base64,iVBORw0KGgo=",
}));
vi.mock("@/lib/page-image-asset", () => ({ validatePageImageAsset: calls.validateImage }));
vi.mock("sonner", () => ({ toast: { success: calls.success, error: calls.error } }));

const content = {
  brand: "Studio",
  headline: "Your own page",
  sub: "Project words",
  cta: "Contact",
  features: [],
  quote: "",
};
const props = () => ({
  tokens: normalizeTokens({}),
  content,
  settings: { ...DEFAULT_PAGE_SETTINGS },
  projectState: { libraryId: "design-one", integration: "new" },
  onSettings: vi.fn(),
  onContent: vi.fn(),
  onExport: vi.fn(),
});
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function startZip() {
  fireEvent.click(screen.getByRole("button", { name: "Download page ZIP" }));
}
function startImage() {
  fireEvent.change(screen.getByLabelText(/PNG, JPEG, or WebP/), {
    target: { files: [new File(["bytes"], "photo.png", { type: "image/png" })] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.files.length = 0;
  calls.download.mockReset();
  calls.owner.mockReturnValue("owner-one");
  calls.generate.mockResolvedValue(new Blob(["zip"]));
  calls.saveImage.mockResolvedValue("a".repeat(64));
  calls.validateImage.mockResolvedValue("data:image/png;base64,iVBORw0KGgo=");
});
afterEach(cleanup);

describe("authored page delivery lifetime", () => {
  it("requires acknowledgment even when the actual anchor click is canceled normally", async () => {
    const actual = await vi.importActual<typeof import("@/lib/exportPack")>("@/lib/exportPack");
    const create = vi.fn(() => "blob:receipt-test");
    Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    calls.download.mockImplementation(actual.downloadBlob);
    const canceled = vi.fn((event: MouseEvent) => {
      if (event.target instanceof HTMLAnchorElement && event.target.download)
        event.preventDefault();
    });
    document.addEventListener("click", canceled, true);
    try {
      const current = props();
      render(<AuthoredPagePanel {...current} />);
      startZip();
      await screen.findByRole("button", { name: "I’ve saved the file" });
      const clicks = canceled.mock.calls
        .map(([event]) => event)
        .filter((event) => event.target instanceof HTMLAnchorElement);
      expect(clicks).toHaveLength(1);
      expect(clicks[0]!.defaultPrevented).toBe(true);
      expect(current.onExport).not.toHaveBeenCalled();
      expect(screen.getByText(/Focus cannot confirm/)).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "I’ve saved the file" }));
      expect(current.onExport).toHaveBeenCalledOnce();
    } finally {
      document.removeEventListener("click", canceled, true);
    }
  });

  it("never grants project credit for a working HTML download", () => {
    const current = props();
    render(<AuthoredPagePanel {...current} />);
    fireEvent.click(screen.getByRole("button", { name: "Download working HTML" }));
    expect(calls.download).toHaveBeenCalledOnce();
    const acknowledgment = screen.queryByRole("button", { name: "I’ve saved the file" });
    if (acknowledgment) fireEvent.click(acknowledgment);
    expect(current.onExport).not.toHaveBeenCalled();
  });

  it.each(["pending", "ready"])(
    "abandons a %s ZIP after a design edit is undone",
    async (stage) => {
      const job = pending<Blob>();
      if (stage === "pending") calls.generate.mockReturnValueOnce(job.promise);
      const current = props();
      const mounted = render(<AuthoredPagePanel {...current} />);
      startZip();
      if (stage === "ready") await screen.findByRole("button", { name: "I’ve saved the file" });
      mounted.rerender(
        <AuthoredPagePanel {...current} content={{ ...content, headline: "Changed" }} />,
      );
      mounted.rerender(<AuthoredPagePanel {...current} />);
      if (stage === "pending") await act(async () => job.resolve(new Blob(["old zip"])));
      expect(calls.download).toHaveBeenCalledTimes(stage === "ready" ? 1 : 0);
      expect(screen.queryByRole("button", { name: "I’ve saved the file" })).toBeNull();
      expect(current.onExport).not.toHaveBeenCalled();
    },
  );

  it.each(["locked", "changed"])("rejects acknowledgment after the owner is %s", async (state) => {
    const current = props();
    render(<AuthoredPagePanel {...current} />);
    startZip();
    await screen.findByRole("button", { name: "I’ve saved the file" });
    if (state === "locked")
      calls.owner.mockImplementation(() => {
        throw new Error("Session needs verification");
      });
    else calls.owner.mockReturnValue("owner-two");
    fireEvent.click(screen.getByRole("button", { name: "I’ve saved the file" }));
    expect(current.onExport).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "I’ve saved the file" })).toBeNull();
  });

  it("replaces an earlier receipt when a newer ZIP starts and does not revive it after failure", async () => {
    const current = props();
    render(<AuthoredPagePanel {...current} />);
    startZip();
    await screen.findByRole("button", { name: "I’ve saved the file" });
    const job = pending<Blob>();
    calls.generate.mockReturnValueOnce(job.promise);
    startZip();
    expect(screen.queryByRole("button", { name: "I’ve saved the file" })).toBeNull();
    calls.download.mockImplementationOnce(() => {
      throw new Error("Browser refused");
    });
    await act(async () => job.resolve(new Blob(["next zip"])));
    expect(screen.queryByRole("button", { name: "I’ve saved the file" })).toBeNull();
    expect(current.onExport).not.toHaveBeenCalled();
  });

  it("exports the current source and valid decision record under a fixed filename", async () => {
    const current = props();
    const record = JSON.stringify({ version: 1, nodes: [{ id: "palette", value: "sea" }] });
    render(<AuthoredPagePanel {...current} decisionRecord={record} />);
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
    expect(calls.files[0]?.["focus-decision-map.json"]).toBe(record);
    expect(calls.files[0]?.["README.txt"]).toMatch(/Keep it private with focus-project.json/);
    expect(JSON.parse(calls.files[0]!["focus-project.json"]!).studio).toEqual(current.projectState);
    expect(current.onExport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I’ve saved the file" }));
    expect(current.onExport).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "I’ve saved the file" })).toBeNull();
  });

  it("keeps the existing ZIP contract when no decision record is supplied", async () => {
    const current = props();
    render(<AuthoredPagePanel {...current} />);
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
    expect(Object.keys(calls.files[0]!)).not.toContain("focus-decision-map.json");
    expect(current.onExport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I’ve saved the file" }));
    expect(current.onExport).toHaveBeenCalledOnce();
  });

  it("includes a decision record exactly at the byte limit without truncation", async () => {
    const record = JSON.stringify("a".repeat(199_998));
    expect(new Blob([record]).size).toBe(200_000);
    render(<AuthoredPagePanel {...props()} decisionRecord={record} />);
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
    expect(calls.files[0]?.["focus-decision-map.json"]).toBe(record);
  });

  it.each([
    ["malformed", "{"],
    ["oversized in UTF-8 bytes", JSON.stringify({ note: "é".repeat(110_000) })],
  ])(
    "rejects a %s decision record without delivering or acknowledging an export",
    async (_name, record) => {
      const current = props();
      render(<AuthoredPagePanel {...current} decisionRecord={record} />);
      startZip();
      await waitFor(() => expect(calls.error).toHaveBeenCalledOnce());
      expect(calls.generate).not.toHaveBeenCalled();
      expect(calls.download).not.toHaveBeenCalled();
      expect(current.onExport).not.toHaveBeenCalled();
    },
  );

  it("discards a ZIP that finishes after the panel unmounts", async () => {
    const job = pending<Blob>();
    calls.generate.mockReturnValue(job.promise);
    const current = props();
    const mounted = render(<AuthoredPagePanel {...current} />);
    startZip();
    mounted.unmount();
    await act(async () => job.resolve(new Blob(["late zip"])));
    expect(calls.download).not.toHaveBeenCalled();
    expect(current.onExport).not.toHaveBeenCalled();
    expect(calls.success).not.toHaveBeenCalled();
  });

  it.each(["tokens", "content", "settings", "projectState", "decisionRecord"])(
    "discards a pending ZIP after %s changes and permits a fresh retry",
    async (field) => {
      const job = pending<Blob>();
      calls.generate.mockReturnValueOnce(job.promise);
      const current = { ...props(), decisionRecord: '{"version":1}' };
      const mounted = render(<AuthoredPagePanel {...current} />);
      startZip();
      const next = {
        ...current,
        ...(field === "tokens"
          ? { tokens: normalizeTokens({ ...current.tokens, radius: 22 }) }
          : {}),
        ...(field === "content" ? { content: { ...content, headline: "Later words" } } : {}),
        ...(field === "settings"
          ? { settings: { ...current.settings, actionUrl: "https://example.com/book" } }
          : {}),
        ...(field === "projectState"
          ? { projectState: { ...current.projectState, libraryId: "design-two" } }
          : {}),
        ...(field === "decisionRecord" ? { decisionRecord: '{"version":2}' } : {}),
      };
      mounted.rerender(<AuthoredPagePanel {...next} />);
      await act(async () => job.resolve(new Blob(["outdated zip"])));
      expect(calls.download).not.toHaveBeenCalled();
      expect(current.onExport).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeEnabled();
      startZip();
      await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
      expect(current.onExport).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "I’ve saved the file" }));
      expect(current.onExport).toHaveBeenCalledOnce();
    },
  );

  it.each(["locked", "changed"])(
    "does not deliver a pending ZIP after the owner session is %s",
    async (state) => {
      const job = pending<Blob>();
      calls.generate.mockReturnValue(job.promise);
      const current = props();
      render(<AuthoredPagePanel {...current} />);
      startZip();
      if (state === "locked")
        calls.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      else calls.owner.mockReturnValue("owner-two");
      await act(async () => job.resolve(new Blob(["old owner's zip"])));
      expect(calls.download).not.toHaveBeenCalled();
      expect(current.onExport).not.toHaveBeenCalled();
      expect(calls.success).not.toHaveBeenCalled();
    },
  );

  it("refuses both delivery paths when the owner session is already locked", async () => {
    const current = props();
    render(<AuthoredPagePanel {...current} />);
    calls.owner.mockImplementation(() => {
      throw new Error("Session needs verification");
    });
    fireEvent.click(screen.getByRole("button", { name: "Download working HTML" }));
    startZip();
    await waitFor(() => expect(calls.error).toHaveBeenCalledTimes(2));
    expect(calls.generate).not.toHaveBeenCalled();
    expect(calls.download).not.toHaveBeenCalled();
    expect(current.onExport).not.toHaveBeenCalled();
  });

  it("does not acknowledge a failed browser download", async () => {
    calls.download.mockImplementationOnce(() => {
      throw new Error("Browser refused");
    });
    const current = props();
    render(<AuthoredPagePanel {...current} />);
    startZip();
    await waitFor(() => expect(calls.error).toHaveBeenCalledOnce());
    expect(current.onExport).not.toHaveBeenCalled();
    expect(calls.success).not.toHaveBeenCalled();
  });
});

describe("delayed image ownership", () => {
  it("does not restore saved image bytes after the session locks during validation", async () => {
    const validation = pending<string>();
    calls.validateImage.mockReturnValue(validation.promise);
    render(
      <AuthoredPagePanel
        {...props()}
        settings={{ ...DEFAULT_PAGE_SETTINGS, imageId: "a".repeat(64), imageAlt: "A local image" }}
      />,
    );
    await waitFor(() => expect(calls.validateImage).toHaveBeenCalledOnce());
    calls.owner.mockImplementation(() => {
      throw new Error("Session needs verification");
    });
    await act(async () => validation.resolve("data:image/png;base64,iVBORw0KGgo="));
    expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeDisabled();
    expect(screen.getByTitle("Working page preview")).not.toHaveAttribute(
      "srcdoc",
      expect.stringContaining("data:image/png;base64,iVBORw0KGgo="),
    );
    expect(calls.download).not.toHaveBeenCalled();
  });

  it.each(["locked", "changed"])(
    "does not attach image bytes validated after the owner session is %s",
    async (state) => {
      const validation = pending<string>();
      calls.validateImage.mockReturnValue(validation.promise);
      const current = props();
      render(<AuthoredPagePanel {...current} />);
      startImage();
      await waitFor(() => expect(calls.validateImage).toHaveBeenCalledOnce());
      if (state === "locked")
        calls.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      else calls.owner.mockReturnValue("owner-two");
      await act(async () => validation.resolve("data:image/png;base64,iVBORw0KGgo="));
      expect(current.onSettings).not.toHaveBeenCalled();
    },
  );

  it("does not attach an image to a replaced design even if a caller reuses the component", async () => {
    const validation = pending<string>();
    calls.validateImage.mockReturnValue(validation.promise);
    const current = props();
    const mounted = render(<AuthoredPagePanel {...current} />);
    startImage();
    await waitFor(() => expect(calls.validateImage).toHaveBeenCalledOnce());
    mounted.rerender(
      <AuthoredPagePanel
        {...current}
        projectState={{ ...current.projectState, libraryId: "design-two" }}
      />,
    );
    await act(async () => validation.resolve("data:image/png;base64,iVBORw0KGgo="));
    expect(current.onSettings).not.toHaveBeenCalled();
  });

  it("does not replace an image selection restored while an upload is pending", async () => {
    const validation = pending<string>();
    calls.validateImage.mockReturnValueOnce(validation.promise);
    const current = props();
    const mounted = render(<AuthoredPagePanel {...current} />);
    startImage();
    await waitFor(() => expect(calls.validateImage).toHaveBeenCalledOnce());
    mounted.rerender(
      <AuthoredPagePanel
        {...current}
        settings={{ ...current.settings, imageId: "b".repeat(64) }}
      />,
    );
    await act(async () => validation.resolve("data:image/png;base64,iVBORw0KGgo="));
    expect(current.onSettings).not.toHaveBeenCalled();
  });

  it("does not revive an abandoned upload when the owner returns to its original image selection", async () => {
    const validation = pending<string>();
    calls.validateImage.mockReturnValueOnce(validation.promise);
    const current = props();
    const mounted = render(<AuthoredPagePanel {...current} />);
    startImage();
    await waitFor(() => expect(calls.validateImage).toHaveBeenCalledOnce());
    mounted.rerender(
      <AuthoredPagePanel
        {...current}
        settings={{ ...current.settings, imageId: "b".repeat(64) }}
      />,
    );
    mounted.rerender(<AuthoredPagePanel {...current} />);
    await act(async () => validation.resolve("data:image/png;base64,iVBORw0KGgo="));
    expect(current.onSettings).not.toHaveBeenCalled();
  });
});

describe("compact authored workspace", () => {
  it("keeps the exact preview and downloads visible with supporting editors collapsed", () => {
    render(<AuthoredPagePanel {...props()} compact />);
    expect(screen.getByTitle("Working page preview")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    const summary = screen.getByText("Content, image and action");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Where should the main action lead?")).not.toBeVisible();
    fireEvent.click(summary);
    expect(screen.getByLabelText("Where should the main action lead?")).toBeVisible();
    expect(screen.getByText("See it. Use it. Take it with you.").closest("section")).toHaveClass(
      "authored-workspace--compact",
    );
  });
});

describe("Product descriptions in the editor and delivered source", () => {
  it("adds and removes a real disclosure as its description changes, preserving the title", async () => {
    const current = props();
    function EditableProduct() {
      const [words, setWords] = useState({
        ...content,
        features: [{ title: "Materials included", body: "" }],
      });
      return (
        <AuthoredPagePanel
          {...current}
          content={words}
          onContent={setWords}
          settings={{ ...current.settings, composition: "product" }}
        />
      );
    }
    const preview = () =>
      new DOMParser().parseFromString(
        screen.getByTitle("Working page preview").getAttribute("srcdoc")!,
        "text/html",
      );
    render(<EditableProduct />);
    expect(preview().querySelector("#feature-1 h3")?.textContent).toBe("Materials included");
    expect(preview().querySelector("#feature-1 summary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit the page’s words" }));
    fireEvent.change(screen.getByLabelText("Feature 1 description"), {
      target: { value: "Bring only your curiosity." },
    });
    expect(preview().querySelector("details#feature-1")?.hasAttribute("open")).toBe(true);
    expect(preview().querySelector("#feature-1 p")?.textContent).toBe("Bring only your curiosity.");
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledTimes(1));
    const expanded = new DOMParser().parseFromString(calls.files[0]!["index.html"]!, "text/html");
    expect(expanded.body.innerHTML).toBe(preview().body.innerHTML);

    fireEvent.change(screen.getByLabelText("Feature 1 description"), {
      target: { value: " \n\t" },
    });
    expect(preview().querySelector("#feature-1 summary")).toBeNull();
    expect(preview().querySelector("#feature-1 h3")?.textContent).toBe("Materials included");
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledTimes(2));
    const staticRow = new DOMParser().parseFromString(calls.files[1]!["index.html"]!, "text/html");
    expect(staticRow.body.innerHTML).toBe(preview().body.innerHTML);
    expect(screen.getByTitle("Working page preview").getAttribute("srcdoc")).toContain(
      `<style>${calls.files[1]!["styles.css"]}</style>`,
    );
  });
});

describe("framing export consistency", () => {
  const src = "data:image/png;base64,iVBORw0KGgo=";
  const settings: PageSettings = {
    ...DEFAULT_PAGE_SETTINGS,
    imageId: "a".repeat(64),
    imageAlt: "A bird near the right edge",
    imageFraming: { fit: "cover", position: "right", narrowPosition: "top-left" },
  };
  it("delivers the same framing CSS, original image and description shown in the current preview", async () => {
    const current = {
      ...props(),
      settings,
      projectState: { ...props().projectState, page: settings },
    };
    render(<AuthoredPagePanel {...current} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeEnabled(),
    );
    const preview = screen.getByTitle("Working page preview").getAttribute("srcdoc")!;
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
    const files = calls.files[0]!;
    expect(files["styles.css"]).toContain("object-position: right center");
    expect(files["styles.css"]).toContain("object-position: left top");
    expect(preview).toContain(files["styles.css"]);
    expect(files["index.html"]).toContain(src);
    expect(files["index.html"]).toContain(settings.imageAlt);
    const project = JSON.parse(files["focus-project.json"]!);
    expect(project.studio.page).toEqual(settings);
    expect(project.embeddedImage).toEqual({ id: settings.imageId, src, alt: settings.imageAlt });
    fireEvent.click(screen.getByRole("button", { name: "Download working HTML" }));
    const blob = calls.download.mock.calls[1]![0] as Blob;
    const delivered = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(delivered).toBe(preview);
  });
  it("discards an in-flight ZIP after only framing changes and exports the new crop on retry", async () => {
    const job = pending<Blob>();
    calls.generate.mockReturnValueOnce(job.promise);
    const current = { ...props(), settings };
    const { rerender } = render(<AuthoredPagePanel {...current} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download page ZIP" })).toBeEnabled(),
    );
    startZip();
    const next: PageSettings = {
      ...settings,
      imageFraming: { fit: "contain", position: "right", narrowPosition: "top-left" },
    };
    rerender(<AuthoredPagePanel {...current} settings={next} />);
    await act(async () => job.resolve(new Blob(["old crop"])));
    expect(calls.download).not.toHaveBeenCalled();
    expect(current.onExport).not.toHaveBeenCalled();
    expect(calls.error).toHaveBeenCalledWith(expect.stringMatching(/design changed/));
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
    expect(calls.files[1]!["styles.css"]).toContain("object-fit: contain");
    expect(current.onExport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I’ve saved the file" }));
    expect(current.onExport).toHaveBeenCalledOnce();
  });
});
