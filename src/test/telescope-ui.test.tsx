import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TelescopeReceipt } from "@/lib/telescope";

const operations = vi.hoisted(() => ({ inspect: vi.fn(), download: vi.fn(), blocker: vi.fn() }));
vi.mock("@/lib/telescope", async (original) => ({
  ...(await original<typeof import("@/lib/telescope")>()),
  inspectTelescopeArtifact: operations.inspect,
}));
vi.mock("@/lib/exportPack", () => ({ downloadBlob: operations.download }));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Focus navigation</header> }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useBlocker: operations.blocker,
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
import { Telescope } from "@/routes/telescope";

const report = (name = "build.html", hash = "a"): TelescopeReceipt => ({
  schema: "focus.telescope.build-receipt",
  version: 1,
  scope: "static-inventory-only",
  createdAt: "2026-11-18T18:00:00.000Z",
  artifact: { name, kind: "html", bytes: 15, sha256: hash.repeat(64) },
  inventory: { files: 1, html: 1, css: 0, javascript: 0, images: 0, other: 0, entryHtml: name },
  execution: {
    rendered: false,
    scriptsExecuted: false,
    networkRequests: false,
    browserTests: "not-run",
  },
  findings: [
    { id: "runtime-unverified", level: "unknown", message: "Browser tasks have not been tested." },
  ],
});
function artifact(name = "build.html") {
  const file = new File(["<h1>Hello</h1>"], name, { type: "text/html" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode("<h1>Hello</h1>").buffer,
  });
  return file;
}
function receiptFile(value: unknown) {
  const json = JSON.stringify(value),
    file = new File([json], "receipt.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => json });
  return file;
}
function select(file: File) {
  fireEvent.change(screen.getByLabelText("Built HTML or ZIP file"), { target: { files: [file] } });
}

beforeEach(() => {
  operations.inspect.mockReset();
  operations.download.mockReset();
  operations.blocker.mockReset().mockReturnValue({ status: "idle" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Telescope workbench boundaries", () => {
  it("keeps imports author-supplied and marks a changed selected artifact stale", async () => {
    operations.inspect
      .mockResolvedValueOnce(report())
      .mockResolvedValueOnce(report("changed.html", "b"));
    render(<Telescope />);
    fireEvent.change(screen.getByLabelText("Previous Telescope receipt JSON"), {
      target: { files: [receiptFile(report())] },
    });
    await screen.findByText(/Receipt loaded. Choose the corresponding build/);
    select(artifact());
    await screen.findByText(/Same artifact bytes. Findings are still author-supplied/);
    select(artifact("changed.html"));
    await screen.findByText(/Different artifact bytes. The imported receipt is stale/);
    expect(screen.queryByText(/Same artifact bytes/)).not.toBeInTheDocument();
  });

  it("ignores a delayed inspection after clear and does not write customer file data to storage", async () => {
    let finish!: (receipt: TelescopeReceipt) => void;
    operations.inspect.mockImplementation(
      () =>
        new Promise<TelescopeReceipt>((resolve) => {
          finish = resolve;
        }),
    );
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<Telescope />);
    select(artifact());
    await waitFor(() => expect(operations.inspect).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Clear this session" }));
    finish(report());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Choose HTML or ZIP" })).not.toBeDisabled(),
    );
    expect(screen.queryByText("build.html")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download build receipt" }),
    ).not.toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
  });

  it("requires an identified artifact and a visitor task before downloading the manual plan", async () => {
    operations.inspect.mockResolvedValue(report());
    render(<Telescope />);
    const plan = screen.getByRole("button", { name: "Download task test plan" });
    expect(plan).toBeDisabled();
    select(artifact());
    await screen.findByRole("button", { name: "Download build receipt" });
    expect(plan).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Primary visitor task"), {
      target: { value: "Book a slot without duplicate reservations" },
    });
    fireEvent.change(screen.getByLabelText("error expected outcome"), {
      target: { value: "Retain the selected time" },
    });
    fireEvent.click(plan);
    expect(operations.download).toHaveBeenCalledWith(
      expect.any(Blob),
      "telescope-interaction-plan.md",
    );
    expect(screen.getByText(/Test plan download started/)).toBeInTheDocument();
    expect(screen.getAllByText("manual — not run")).toHaveLength(7);
  });

  it("reports blocked downloads honestly while preserving the inspection", async () => {
    operations.inspect.mockResolvedValue(report());
    operations.download.mockImplementation(() => {
      throw new Error("download blocked");
    });
    render(<Telescope />);
    select(artifact());
    fireEvent.click(await screen.findByRole("button", { name: "Download build receipt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("download could not be started");
    expect(screen.getByText("build.html")).toBeInTheDocument();
    expect(screen.queryByText(/Build receipt download started/)).not.toBeInTheDocument();
  });

  it("retains and identifies the previous successful inspection and draft after a refused replacement", async () => {
    operations.inspect
      .mockResolvedValueOnce(report())
      .mockRejectedValueOnce(new Error("Encrypted ZIP refused"));
    render(<Telescope />);
    select(artifact());
    await screen.findByRole("button", { name: "Download build receipt" });
    fireEvent.change(screen.getByLabelText("Primary visitor task"), {
      target: { value: "Reserve a table" },
    });
    select(artifact("next.zip"));
    await screen.findByText("Encrypted ZIP refused");
    expect(screen.getByText(/previous inspection for build.html is retained/)).toBeInTheDocument();
    expect(screen.getByText("build.html")).toBeInTheDocument();
    expect(screen.queryByText("next.zip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download build receipt" })).not.toBeDisabled();
    expect(screen.getByLabelText("Primary visitor task")).toHaveValue("Reserve a table");
    expect(screen.getByRole("button", { name: "Download task test plan" })).not.toBeDisabled();
  });

  it("retains the previous imported receipt after malformed replacement JSON", async () => {
    render(<Telescope />);
    const input = screen.getByLabelText("Previous Telescope receipt JSON");
    fireEvent.change(input, { target: { files: [receiptFile(report())] } });
    await screen.findByText(/Recorded file: build.html/);
    fireEvent.change(input, { target: { files: [receiptFile({ claimed: "passed" })] } });
    await screen.findByText(/Your previous imported receipt is retained/);
    expect(screen.getByText(/Recorded file: build.html/)).toBeInTheDocument();
  });

  it("asks before clearing an authored task and preserves it when the user keeps working", () => {
    render(<Telescope />);
    fireEvent.change(screen.getByLabelText("Primary visitor task"), {
      target: { value: "Reserve a table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear this session" }));
    let dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep working" }));
    expect(screen.getByLabelText("Primary visitor task")).toHaveValue("Reserve a table");
    fireEvent.click(screen.getByRole("button", { name: "Clear this session" }));
    dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear this session" }));
    expect(screen.getByLabelText("Primary visitor task")).toHaveValue("");
  });

  it("protects authored work from route navigation and reload, and opens review tools separately", () => {
    const view = render(<Telescope />);
    expect(operations.blocker.mock.lastCall?.[0].shouldBlockFn()).toBe(false);
    fireEvent.change(screen.getByLabelText("error expected outcome"), {
      target: { value: "Keep the chosen slot" },
    });
    expect(operations.blocker.mock.lastCall?.[0].shouldBlockFn()).toBe(true);
    expect(operations.blocker.mock.lastCall?.[0].enableBeforeUnload).toBe(true);
    expect(
      screen.getByRole("link", { name: "Open Quality lab (opens in a new tab)" }),
    ).toHaveAttribute("target", "_blank");
    expect(
      screen.getByRole("link", { name: "Open Blind review room (opens in a new tab)" }),
    ).toHaveAttribute("target", "_blank");
    const proceed = vi.fn(),
      reset = vi.fn();
    operations.blocker.mockReturnValue({ status: "blocked", proceed, reset });
    view.rerender(<Telescope />);
    fireEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByLabelText("error expected outcome")).toHaveValue("Keep the chosen slot");
    fireEvent.click(screen.getByRole("button", { name: "Leave Telescope" }));
    expect(proceed).toHaveBeenCalledTimes(1);
  });
});
