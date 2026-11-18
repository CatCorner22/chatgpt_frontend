import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { normalizeTokens } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";

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
  calls.owner.mockReturnValue("owner-one");
  calls.generate.mockResolvedValue(new Blob(["zip"]));
  calls.saveImage.mockResolvedValue("a".repeat(64));
  calls.validateImage.mockResolvedValue("data:image/png;base64,iVBORw0KGgo=");
});
afterEach(cleanup);

describe("authored page delivery lifetime", () => {
  it("exports the current source and valid decision record under a fixed filename", async () => {
    const current = props();
    const record = JSON.stringify({ version: 1, nodes: [{ id: "palette", value: "sea" }] });
    render(<AuthoredPagePanel {...current} decisionRecord={record} />);
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
    expect(calls.files[0]?.["focus-decision-map.json"]).toBe(record);
    expect(calls.files[0]?.["README.txt"]).toMatch(/Keep it private with focus-project.json/);
    expect(JSON.parse(calls.files[0]!["focus-project.json"]!).studio).toEqual(current.projectState);
    expect(current.onExport).toHaveBeenCalledOnce();
    expect(calls.success).toHaveBeenCalledWith(expect.stringMatching(/download started/i));
  });

  it("keeps the existing ZIP contract when no decision record is supplied", async () => {
    const current = props();
    render(<AuthoredPagePanel {...current} />);
    startZip();
    await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
    expect(Object.keys(calls.files[0]!)).not.toContain("focus-decision-map.json");
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
