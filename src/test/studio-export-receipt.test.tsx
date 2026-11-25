import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ComponentProps, ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTokens, type Content } from "@/lib/design";
import { EMPTY, type State } from "@/lib/studio-state";
import { workHash } from "@/lib/ux";
import { deferred } from "./deferred";

const calls = vi.hoisted(() => ({
  search: { view: "studio" } as { view: "studio"; panel?: "stratosphere" },
  pack: vi.fn(),
  download: vi.fn(),
  owner: vi.fn(),
  clipboard: vi.fn(),
  error: vi.fn(),
  pageZip: vi.fn(),
  realAuthored: false,
}));
vi.mock("jszip", () => ({
  default: class {
    file() {
      return this;
    }
    generateAsync() {
      return calls.pageZip();
    }
  },
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => calls.search }),
  useBlocker: () => undefined,
  Link: ({ to, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@tanstack/react-start", async (original) => ({
  ...(await original<typeof import("@tanstack/react-start")>()),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/exportPack", async (original) => ({
  ...(await original<typeof import("@/lib/exportPack")>()),
  buildPack: calls.pack,
  downloadBlob: calls.download,
}));
vi.mock("@/lib/browser-storage", async (original) => ({
  ...(await original<typeof import("@/lib/browser-storage")>()),
  getBrowserOwnerId: calls.owner,
}));
vi.mock("@/lib/runtime-config", async (original) => ({
  ...(await original<typeof import("@/lib/runtime-config")>()),
  hasCloudBackend: () => false,
}));
vi.mock("@/hooks/useSession", () => ({ useUser: () => null }));
vi.mock("@/lib/useDesignFonts", () => ({ useDesignFonts: () => {} }));
vi.mock("@/components/AppHeader", () => ({
  AppHeader: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
}));
vi.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@/components/Help", () => ({
  HelpTip: ({ children }: { children: ReactNode }) => <>{children}</>,
  Term: ({ children }: { children: ReactNode }) => <>{children}</>,
  WhyPopover: () => null,
}));
vi.mock("@/components/Journey", () => ({ Journey: () => null }));
vi.mock("@/components/DesignPreview", () => ({
  PreviewFrame: () => null,
  DesignPreview: () => null,
}));
vi.mock("@/components/ContentEditor", () => ({
  ContentEditor: ({ content, onChange }: { content: Content; onChange: (v: Content) => void }) => (
    <label>
      Fixture headline
      <input
        value={content.headline}
        onChange={(event) => onChange({ ...content, headline: event.target.value })}
      />
    </label>
  ),
}));
vi.mock("@/components/LazyAuthoredPagePanel", async (original) => {
  const actual = await original<typeof import("@/components/LazyAuthoredPagePanel")>();
  return {
    LazyAuthoredPagePanel: (props: ComponentProps<typeof actual.LazyAuthoredPagePanel>) =>
      calls.realAuthored ? <actual.LazyAuthoredPagePanel {...props} /> : null,
  };
});
vi.mock("@/components/BeforeAfter", () => ({ BeforeAfter: () => null }));
vi.mock("@/components/SkinBar", () => ({ SkinBar: () => null }));
vi.mock("@/components/LaunchPanel", () => ({ LaunchPanel: () => null }));
vi.mock("@/components/LiveVisionPanel", () => ({ LiveVisionPanel: () => null }));
vi.mock("@/components/BadgePanel", () => ({ BadgePanel: () => null }));
vi.mock("@/components/StratospherePanel", async (original) => {
  const actual = await original<typeof import("@/components/StratospherePanel")>();
  return {
    StratospherePanel: (props: ComponentProps<typeof actual.StratospherePanel>) =>
      calls.realAuthored ? <actual.StratospherePanel {...props} /> : <p>Fixture workshop</p>,
    StratosphereStart: () => null,
  };
});
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: calls.error, success: vi.fn(), info: vi.fn() }),
}));

import { Route } from "@/routes/index";

const FocusHome = (Route as unknown as { options: { component: ComponentType } }).options.component;
const key = "refraction:v1";
const receiptName = "I’ve saved the file";
function fixture(): State {
  return {
    ...EMPTY,
    stage: "rx",
    integration: "existing",
    libraryId: "receipt-fixture",
    brief: "A quiet studio",
    tokens: normalizeTokens({ accent: "#1d4ed8", accentInk: "#ffffff" }),
    content: {
      brand: "Owner",
      headline: "Keep these words",
      sub: "Original project copy",
      cta: "Contact",
      features: [],
      quote: "",
    },
  };
}
function saved(): State {
  return JSON.parse(localStorage.getItem(key)!);
}
function mount(state = fixture()) {
  localStorage.setItem(key, JSON.stringify(state));
  const rendered = render(<FocusHome />);
  return {
    ...rendered,
    workshop: () => {
      calls.search = { view: "studio", panel: "stratosphere" };
      rendered.rerender(<FocusHome />);
    },
    studio: () => {
      calls.search = { view: "studio" };
      rendered.rerender(<FocusHome />);
    },
  };
}
async function startPack() {
  fireEvent.click(await screen.findByRole("button", { name: "Download existing-site pack" }));
  await waitFor(() => expect(calls.pack).toHaveBeenCalled());
}
async function startMarkdown() {
  fireEvent.click(await screen.findByRole("button", { name: "Download DESIGN.md" }));
}
function editHeadline(value: string) {
  fireEvent.change(screen.getByLabelText("Fixture headline"), { target: { value } });
}
function noCredit() {
  expect(saved().savedHash).toBeNull();
}

beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  localStorage.clear();
  sessionStorage.clear();
  calls.search = { view: "studio" };
  calls.pack.mockReset().mockResolvedValue(new Blob(["pack"]));
  calls.download.mockReset();
  calls.owner.mockReset().mockReturnValue("owner-one");
  calls.clipboard.mockReset().mockResolvedValue(undefined);
  calls.error.mockReset();
  calls.pageZip.mockReset().mockResolvedValue(new Blob(["authored page zip"]));
  calls.realAuthored = false;
  vi.stubGlobal("navigator", { clipboard: { writeText: calls.clipboard } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Studio download receipts", () => {
  it("keeps a canceled native anchor download uncredited until the owner confirms receipt", async () => {
    const actual = await vi.importActual<typeof import("@/lib/exportPack")>("@/lib/exportPack");
    calls.download.mockImplementation(actual.downloadBlob);
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = vi.fn(() => "blob:receipt-fixture");
        static override revokeObjectURL = vi.fn();
      },
    );
    const canceled: string[] = [];
    const cancelDownload = (event: MouseEvent) => {
      if (event.target instanceof HTMLAnchorElement && event.target.download) {
        event.preventDefault();
        canceled.push(event.target.download);
      }
    };
    document.addEventListener("click", cancelDownload);
    try {
      mount();
      const download = await screen.findByRole("button", { name: "Download DESIGN.md" });
      vi.useFakeTimers();
      fireEvent.click(download);
      expect(canceled).toEqual(["DESIGN.md"]);
      noCredit();
      expect(screen.getByText(/Focus cannot confirm/i)).toBeVisible();
      expect(screen.getByRole("button", { name: receiptName })).toBeVisible();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      document.removeEventListener("click", cancelDownload);
    }
  });

  it.each(["markdown", "pack"] as const)(
    "requires explicit receipt confirmation for a successful %s download",
    async (kind) => {
      mount();
      if (kind === "pack") await startPack();
      else await startMarkdown();
      await waitFor(() => expect(calls.download).toHaveBeenCalledOnce());
      noCredit();
      fireEvent.click(screen.getByRole("button", { name: receiptName }));
      await waitFor(() => expect(saved().savedHash).toBe(workHash(saved())));
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    },
  );

  it("catches direct download errors without credit or an unhandled browser error", async () => {
    calls.download.mockImplementation(() => {
      throw new Error("Browser refused download");
    });
    const escaped: string[] = [];
    const catchError = (event: ErrorEvent) => {
      event.preventDefault();
      escaped.push(event.message);
    };
    window.addEventListener("error", catchError);
    try {
      mount();
      await startMarkdown();
      expect(calls.error).toHaveBeenCalledOnce();
      expect(escaped).toEqual([]);
      noCredit();
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    } finally {
      window.removeEventListener("error", catchError);
    }
  });

  it.each(["edit", "edit and return", "tool and return"] as const)(
    "discards a pending ZIP after %s without reviving the abandoned request",
    async (change) => {
      const job = deferred<Blob>();
      calls.pack.mockReturnValueOnce(job.promise);
      mount();
      await startPack();
      if (change === "tool and return") {
        const tool = screen.getByRole("combobox");
        fireEvent.change(tool, { target: { value: "Cursor" } });
        fireEvent.change(tool, { target: { value: "Lovable" } });
      } else {
        editHeadline("Later words");
        if (change === "edit and return") editHeadline("Keep these words");
      }
      await act(async () => job.resolve(new Blob(["stale pack"])));
      expect(calls.download).not.toHaveBeenCalled();
      noCredit();
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Download existing-site pack" })).toBeEnabled();
    },
  );

  it("abandons a ZIP when Rx unmounts and does not revive it after returning", async () => {
    const job = deferred<Blob>();
    calls.pack.mockReturnValueOnce(job.promise);
    const app = mount();
    await startPack();
    app.workshop();
    expect(await screen.findByText("Fixture workshop")).toBeVisible();
    app.studio();
    await screen.findByRole("button", { name: "Download existing-site pack" });
    await act(async () => job.resolve(new Blob(["abandoned pack"])));
    expect(calls.download).not.toHaveBeenCalled();
    noCredit();
    expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
  });

  it.each(["locked", "changed"] as const)(
    "abandons a pending ZIP when its owner is %s",
    async (ownerState) => {
      const job = deferred<Blob>();
      calls.pack.mockReturnValueOnce(job.promise);
      mount();
      await startPack();
      if (ownerState === "locked")
        calls.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      else calls.owner.mockReturnValue("owner-two");
      await act(async () => job.resolve(new Blob(["old owner's pack"])));
      expect(calls.download).not.toHaveBeenCalled();
      noCredit();
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    },
  );

  it("does not let an older pending ZIP replace a newer markdown receipt", async () => {
    const job = deferred<Blob>();
    calls.pack.mockReturnValueOnce(job.promise);
    mount();
    await startPack();
    await startMarkdown();
    await act(async () => job.resolve(new Blob(["superseded pack"])));
    expect(calls.download).toHaveBeenCalledOnce();
    expect(calls.download).toHaveBeenCalledWith(expect.any(Blob), "DESIGN.md");
    noCredit();
    fireEvent.click(screen.getByRole("button", { name: receiptName }));
    await waitFor(() => expect(saved().savedHash).toBe(workHash(saved())));
  });

  it("invalidates a ready receipt when the design changes and returns to its earlier values", async () => {
    mount();
    await startMarkdown();
    expect(screen.getByRole("button", { name: receiptName })).toBeVisible();
    editHeadline("Temporary edit");
    editHeadline("Keep these words");
    expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    noCredit();
  });

  it.each(["locked", "changed"] as const)(
    "rechecks a %s owner at receipt confirmation",
    async (ownerState) => {
      mount();
      await startMarkdown();
      const confirmation = screen.getByRole("button", { name: receiptName });
      if (ownerState === "locked")
        calls.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      else calls.owner.mockReturnValue("owner-two");
      fireEvent.click(confirmation);
      noCredit();
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    },
  );

  it("keeps a customized authored page unsaved after a specification-only receipt", async () => {
    const initial = fixture();
    mount({
      ...initial,
      integration: "new",
      purpose: { ...initial.purpose, experience: "website" },
      page: { ...initial.page, actionUrl: "https://example.com/book" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /Design specification & handoff tools/ }),
    );
    await startMarkdown();
    fireEvent.click(screen.getByRole("button", { name: receiptName }));
    noCredit();
  });
});

describe("Studio clipboard evidence", () => {
  it.each(["Copy Vision", "Copy message and Vision"])(
    "credits an actual successful %s operation without a receipt prompt",
    async (name) => {
      mount();
      await screen.findByRole("button", { name: "Copy Vision" });
      if (name === "Copy message and Vision")
        fireEvent.click(screen.getByText("What to say to Lovable, step by step"));
      fireEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(saved().savedHash).toBe(workHash(saved())));
      expect(calls.clipboard).toHaveBeenCalledOnce();
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    },
  );

  it("does not credit a failed clipboard operation", async () => {
    calls.clipboard.mockRejectedValue(new Error("Clipboard denied"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Copy Vision" }));
    await waitFor(() => expect(calls.error).toHaveBeenCalledOnce());
    noCredit();
    expect(screen.queryByText("Copied ✓")).not.toBeInTheDocument();
  });

  it("does not credit a successful design-values-only copy", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Copy design values only" }));
    await screen.findByText("Copied ✓");
    noCredit();
  });

  it.each(["edit and return", "owner change", "owner lock", "unmount and return", "new download"])(
    "ignores a delayed successful clipboard write after %s",
    async (change) => {
      const job = deferred<void>();
      calls.clipboard.mockReturnValueOnce(job.promise);
      const app = mount();
      fireEvent.click(await screen.findByRole("button", { name: "Copy Vision" }));
      expect(calls.clipboard).toHaveBeenCalledOnce();
      if (change === "edit and return") {
        editHeadline("Temporary edit");
        editHeadline("Keep these words");
      } else if (change === "owner change") calls.owner.mockReturnValue("owner-two");
      else if (change === "owner lock")
        calls.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      else if (change === "unmount and return") {
        app.workshop();
        app.studio();
      } else await startMarkdown();
      await act(async () => job.resolve());
      noCredit();
      if (change === "new download")
        expect(screen.getByRole("button", { name: receiptName })).toBeVisible();
      else expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    },
  );
});

describe("authored receipts through Studio and Stratosphere", () => {
  it.each(["Studio", "Stratosphere"])(
    "credits the exact page ZIP only after receipt confirmation in %s",
    async (surface) => {
      calls.realAuthored = true;
      if (surface === "Stratosphere") calls.search = { view: "studio", panel: "stratosphere" };
      const initial = fixture();
      mount({
        ...initial,
        integration: "new",
        purpose: { ...initial.purpose, experience: "website" },
        page: { ...initial.page, actionUrl: "https://example.com/book" },
      });
      // Await real lazy-panel readiness, including a cold module transform.
      const zip = await screen.findByRole(
        "button",
        { name: "Download page ZIP" },
        { timeout: 5000 },
      );
      fireEvent.click(screen.getByRole("button", { name: "Download working HTML" }));
      expect(calls.download).toHaveBeenCalledWith(expect.any(Blob), "index.html");
      noCredit();
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
      fireEvent.click(zip);
      const confirm = await screen.findByRole("button", { name: receiptName });
      expect(calls.download).toHaveBeenCalledWith(expect.any(Blob), "focus-working-page.zip");
      noCredit();
      fireEvent.click(confirm);
      await waitFor(() => expect(saved().savedHash).toBe(workHash(saved())));
      expect(screen.queryByRole("button", { name: receiptName })).not.toBeInTheDocument();
    },
  );
});
