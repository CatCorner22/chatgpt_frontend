import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTokens } from "@/lib/design";
import { EMPTY_TARGET_DRAFT } from "@/lib/target";
import * as core from "@/lib/source-trial";
import { SourceTrialPanel, type SourceTrialPanelProps } from "@/components/SourceTrialPanel";
import * as sourcePanelModule from "@/components/SourceTrialPanel";
import { LazySourceTrialPanel } from "@/components/LazySourceTrialPanel";

const operations = vi.hoisted(() => ({
  owner: vi.fn(),
  download: vi.fn(),
  package: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/lib/browser-storage", async (original) => ({
  ...(await original<typeof import("@/lib/browser-storage")>()),
  getBrowserOwnerId: operations.owner,
}));
vi.mock("@/lib/exportPack", async (original) => ({
  ...(await original<typeof import("@/lib/exportPack")>()),
  downloadBlob: operations.download,
}));
vi.mock("@/lib/source-trial-package", async (original) => ({
  ...(await original<typeof import("@/lib/source-trial-package")>()),
  buildSourceTrialPackage: operations.package,
}));

const component = `import styles from './Booking.module.css';
export default function Booking() {
  return <main className={styles.page}><h1 className={styles.heading}>Book a class</h1><p className={styles.body}>Choose your date.</p><a className={styles.action} href="/book">Reserve a place</a></main>;
}
`;
const stylesheet = `.page { background-color: #f4f8fa; padding: 24px; }
.heading { color: #112233; }
.body { color: #334455; }
.action { background-color: #334455; color: #ffffff; }
`;
function props(): SourceTrialPanelProps {
  return {
    contextKey: "first-plan",
    design: { id: "saved-design", tokens: normalizeTokens({ radius: 12 }) },
    designTitle: "A clear class page",
    draft: {
      ...EMPTY_TARGET_DRAFT,
      designId: "saved-design",
      page: "Booking",
      improvement: "Clearer main action",
      tasks: "Book a class",
      backup: "Named baseline",
      preview: "Isolated fixture preview",
      rollback: "Selective styling undo",
    },
    captureContext: () => {
      operations.verify();
      return operations.verify;
    },
  };
}
function pick(kind: "component" | "stylesheet", file: File) {
  fireEvent.change(
    screen.getByLabelText(
      kind === "component" ? "Page file (.tsx)" : "Matching style file (.module.css)",
    ),
    { target: { files: [file] } },
  );
}
async function chooseFiles(source = component) {
  fireEvent.change(screen.getByLabelText("What runs this page?"), { target: { value: "vite" } });
  fireEvent.change(screen.getByLabelText("Page file path in the project"), {
    target: { value: "src/Booking.tsx" },
  });
  fireEvent.change(screen.getByLabelText("Style file path in the project"), {
    target: { value: "src/Booking.module.css" },
  });
  pick("component", new File([source], "Booking.tsx"));
  pick("stylesheet", new File([stylesheet], "Booking.module.css"));
  await waitFor(() => expect(screen.getAllByText(/Read in this tab/)).toHaveLength(2));
}
function inspectAndConfirm() {
  fireEvent.click(screen.getByRole("button", { name: "Check whether this page is supported" }));
  expect(screen.getByRole("heading", { name: "Source shape recognized" })).toHaveFocus();
  fireEvent.click(screen.getByRole("checkbox", { name: /These are the page parts/ }));
}
async function prepared() {
  await chooseFiles();
  inspectAndConfirm();
  fireEvent.click(screen.getByRole("button", { name: "Prepare proposed edits" }));
  await screen.findByRole("button", { name: "Download proposed code change" });
}
function deferredPackage() {
  let finish!: (blob: Blob) => void;
  operations.package.mockImplementationOnce(
    () =>
      new Promise<Blob>((resolve) => {
        finish = resolve;
      }),
  );
  return () => act(async () => finish(new Blob(["reviewed fixture package"])));
}

beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  vi.stubGlobal("crypto", webcrypto);
  localStorage.clear();
  sessionStorage.clear();
  operations.owner.mockReset().mockReturnValue("owner-a");
  operations.download.mockReset();
  operations.package.mockReset().mockResolvedValue(new Blob(["package boundary"]));
  operations.verify.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Optional source trial", () => {
  it("keeps Next.js and unknown setups on the ordinary handoff path", () => {
    render(<SourceTrialPanel {...props()} />);
    for (const runtime of ["next", "unsure"]) {
      fireEvent.change(screen.getByLabelText("What runs this page?"), {
        target: { value: runtime },
      });
      expect(screen.queryByLabelText("Page file (.tsx)")).toBeNull();
      expect(screen.getByText(/first source-change format supports React with Vite/)).toBeVisible();
    }
    expect(operations.package).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Request the right files"));
    expect(
      (
        screen.getByRole("textbox", {
          name: "Read-only file request to share",
        }) as HTMLTextAreaElement
      ).value,
    ).toContain("without changing files");
  });

  it("uses the real parser and generator, shows actual role changes, and downloads only the separate proposal", async () => {
    localStorage.setItem("focus:studio", "original draft");
    sessionStorage.setItem("owner-work", "keep");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send");
    render(<SourceTrialPanel {...props()} />);
    await chooseFiles();
    fireEvent.click(screen.getByRole("button", { name: "Check whether this page is supported" }));
    expect(screen.getByText("Book a class")).toBeVisible();
    expect(screen.getByText("Reserve a place")).toBeVisible();
    expect(screen.getByRole("button", { name: "Prepare proposed edits" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /These are the page parts/ }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare proposed edits" }));
    await screen.findByRole("button", { name: "Download proposed code change" });
    const changes = screen.getByRole("region", { name: "Declared style changes" });
    expect(within(changes).getByText("#112233")).toBeVisible();
    expect(
      within(changes).getAllByText("Not resolved from these declarations").length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Review exact forward and undo patches"));
    expect(
      (screen.getByRole("textbox", { name: "Forward patch" }) as HTMLTextAreaElement).value,
    ).toContain("focusTrial_");
    expect(
      (screen.getByRole("textbox", { name: "Undo patch" }) as HTMLTextAreaElement).value,
    ).toContain("src/Booking.tsx");
    expect(document.querySelector("main")).toBeNull();
    expect(operations.download).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download proposed code change" }));
    await waitFor(() =>
      expect(operations.download).toHaveBeenCalledWith(
        expect.any(Blob),
        "focus-source-trial-proposal.zip",
      ),
    );
    expect(operations.package.mock.calls[0]![0].inspection.roles.action.label).toBe(
      "Reserve a place",
    );
    expect(screen.getByText(/Download started.*coding assistant/)).toBeVisible();
    expect(
      (
        screen.getByRole("textbox", {
          name: "Message to include with the proposal",
        }) as HTMLTextAreaElement
      ).value,
    ).toContain("AGENT-HANDOFF.md");
    expect(writes).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(localStorage.getItem("focus:studio")).toBe("original draft");
    expect(sessionStorage.getItem("owner-work")).toBe("keep");
  });

  it("retains a file when its picker is cancelled and refuses unsupported source without executing it", async () => {
    render(<SourceTrialPanel {...props()} />);
    await chooseFiles(
      component.replace("className={styles.heading}", 'className={"dynamic-" + "heading"}'),
    );
    fireEvent.change(screen.getByLabelText("Page file (.tsx)"), { target: { files: [] } });
    expect(screen.getByText(/Booking.tsx.*Read in this tab/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Check whether this page is supported" }));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(/direct CSS module class/);
    expect(screen.getByRole("link", { name: "Use the design handoff prompts" })).toHaveAttribute(
      "href",
      "#target-prompts-heading",
    );
    expect(screen.queryByRole("button", { name: "Prepare proposed edits" })).toBeNull();
  });

  it("checks file size before reading and rejects invalid UTF-8 without retaining source", async () => {
    render(<SourceTrialPanel {...props()} />);
    fireEvent.change(screen.getByLabelText("What runs this page?"), { target: { value: "vite" } });
    const large = new File(["x"], "Huge.tsx");
    const read = vi.fn();
    Object.defineProperty(large, "size", { value: core.SOURCE_TRIAL_LIMITS.componentBytes + 1 });
    Object.defineProperty(large, "arrayBuffer", { value: read });
    pick("component", large);
    expect(screen.getByRole("alert")).toHaveTextContent(/128 KiB/);
    expect(read).not.toHaveBeenCalled();
    pick("component", new File([new Uint8Array([0xc3, 0x28])], "Bad.tsx"));
    expect(await screen.findByText(/Choose a UTF-8 source file/)).toBeVisible();
    expect(screen.queryByText(/Read in this tab/)).toBeNull();
  });

  it("ignores an older file read after a replacement was chosen", async () => {
    render(<SourceTrialPanel {...props()} />);
    fireEvent.change(screen.getByLabelText("What runs this page?"), { target: { value: "vite" } });
    const old = new File([component], "Old.tsx");
    let finish!: (value: ArrayBuffer) => void;
    Object.defineProperty(old, "arrayBuffer", {
      value: () =>
        new Promise<ArrayBuffer>((resolve) => {
          finish = resolve;
        }),
    });
    pick("component", old);
    pick("component", new File([component], "Current.tsx"));
    await screen.findByText(/Current.tsx.*Read in this tab/);
    await act(async () => finish(new TextEncoder().encode(component).buffer));
    expect(screen.queryByText(/Old.tsx/)).toBeNull();
    expect(screen.getByText(/Current.tsx.*Read in this tab/)).toBeVisible();
  });

  it("refuses file bytes if the owner locks before the read completes", async () => {
    render(<SourceTrialPanel {...props()} />);
    fireEvent.change(screen.getByLabelText("What runs this page?"), { target: { value: "vite" } });
    let finish!: (value: ArrayBuffer) => void;
    const pending = new File([component], "Booking.tsx");
    Object.defineProperty(pending, "arrayBuffer", {
      value: () =>
        new Promise<ArrayBuffer>((resolve) => {
          finish = resolve;
        }),
    });
    pick("component", pending);
    operations.owner.mockImplementation(() => {
      throw new Error("Session locked during source read");
    });
    await act(async () => finish(new TextEncoder().encode(component).buffer));
    expect(screen.getByRole("alert")).toHaveTextContent("Session locked during source read");
    expect(screen.queryByText(/Read in this tab/)).toBeNull();
  });

  it("checks actual bytes after reading instead of trusting the declared file size", async () => {
    render(<SourceTrialPanel {...props()} />);
    fireEvent.change(screen.getByLabelText("What runs this page?"), { target: { value: "vite" } });
    const inconsistent = new File(["x"], "Booking.tsx");
    Object.defineProperty(inconsistent, "arrayBuffer", {
      value: async () => new TextEncoder().encode(component).buffer,
    });
    pick("component", inconsistent);
    expect(await screen.findByRole("alert")).toHaveTextContent("file size changed while reading");
    expect(screen.queryByText(/Read in this tab/)).toBeNull();
  });

  it.each(["path", "lock", "cancel"] as const)(
    "discards real generation when %s changes during hashing",
    async (change) => {
      render(<SourceTrialPanel {...props()} />);
      await chooseFiles();
      inspectAndConfirm();
      const generate = vi.spyOn(core, "prepareSourceTrial");
      const digest = webcrypto.subtle.digest.bind(webcrypto.subtle);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const hashing = vi
        .spyOn(webcrypto.subtle, "digest")
        .mockImplementationOnce(async (...args) => {
          await gate;
          return digest(...args);
        });
      fireEvent.click(screen.getByRole("button", { name: "Prepare proposed edits" }));
      await waitFor(() => expect(hashing).toHaveBeenCalled());
      if (change === "path")
        fireEvent.change(screen.getByLabelText("Page file path in the project"), {
          target: { value: "src/Changed.tsx" },
        });
      else if (change === "lock")
        operations.owner.mockImplementation(() => {
          throw new Error("Session locked during hash");
        });
      else fireEvent.click(screen.getByRole("button", { name: "Cancel source preparation" }));
      await act(async () => {
        release();
        await generate.mock.results[0]!.value;
      });
      expect(screen.queryByRole("button", { name: "Download proposed code change" })).toBeNull();
      expect(operations.download).not.toHaveBeenCalled();
      if (change === "lock")
        expect(screen.getByRole("alert")).toHaveTextContent("Session locked during hash");
    },
  );

  it("contains a lazy panel failure and retries without replacing the surrounding draft", async () => {
    const failure = new Error("Source tools unavailable");
    const unavailable = vi.spyOn(sourcePanelModule, "SourceTrialPanel").mockImplementation(() => {
      throw failure;
    });
    const onCaughtError = vi.fn();
    render(
      <>
        <label>
          Owner draft
          <input defaultValue="Keep these answers" />
        </label>
        <LazySourceTrialPanel {...props()} />
      </>,
      { onCaughtError },
    );
    const draftInput = screen.getByRole("textbox", { name: "Owner draft" });
    fireEvent.change(draftInput, { target: { value: "Current answers" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "optional source-change tools couldn’t load",
    );
    expect(onCaughtError).toHaveBeenCalledWith(failure, expect.anything());
    unavailable.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Try loading source tools again" }));
    expect(await screen.findByLabelText("What runs this page?")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Owner draft" })).toBe(draftInput);
    expect(draftInput).toHaveValue("Current answers");
  });

  it.each(["path", "confirmation", "cancel", "context", "unmount"] as const)(
    "discards a pending proposal download after %s changes",
    async (change) => {
      const initial = props();
      const view = render(<SourceTrialPanel {...initial} />);
      await prepared();
      const finish = deferredPackage();
      fireEvent.click(screen.getByRole("button", { name: "Download proposed code change" }));
      await waitFor(() => expect(operations.package).toHaveBeenCalledOnce());
      if (change === "path")
        fireEvent.change(screen.getByLabelText("Page file path in the project"), {
          target: { value: "src/Other.tsx" },
        });
      else if (change === "confirmation")
        fireEvent.click(screen.getByRole("checkbox", { name: /These are the page parts/ }));
      else if (change === "cancel")
        fireEvent.click(screen.getByRole("button", { name: "Cancel source preparation" }));
      else if (change === "context")
        view.rerender(<SourceTrialPanel {...initial} contextKey="new-plan" />);
      else view.unmount();
      await finish();
      expect(operations.download).not.toHaveBeenCalled();
    },
  );

  it.each(["owner", "lock", "saved-context"] as const)(
    "rejects a pending delivery after %s changes",
    async (change) => {
      render(<SourceTrialPanel {...props()} />);
      await prepared();
      const finish = deferredPackage();
      fireEvent.click(screen.getByRole("button", { name: "Download proposed code change" }));
      await waitFor(() => expect(operations.package).toHaveBeenCalledOnce());
      if (change === "owner") operations.owner.mockReturnValue("owner-b");
      else if (change === "lock")
        operations.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      else
        operations.verify.mockImplementation(() => {
          throw new Error("The saved design changed");
        });
      await finish();
      expect(operations.download).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Download proposed code change" })).toBeNull();
    },
  );

  it("clears an earlier successful download message when a retry fails", async () => {
    render(<SourceTrialPanel {...props()} />);
    await prepared();
    fireEvent.click(screen.getByRole("button", { name: "Download proposed code change" }));
    await screen.findByText(/Download started/);
    operations.download.mockImplementation(() => {
      throw new Error("Browser blocked download");
    });
    fireEvent.click(screen.getByRole("button", { name: "Download proposed code change" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Browser blocked download");
    expect(screen.queryByText(/Download started/)).toBeNull();
  });
});
