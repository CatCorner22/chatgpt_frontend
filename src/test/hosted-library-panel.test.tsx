import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HostedLibraryPanel } from "@/components/HostedLibraryPanel";
import { useHostedSession } from "@/components/HostedBoundary";
import { readLibrarySnapshot, type LibraryEntry } from "@/lib/library";
import { createLibraryBackup, restoreLibraryBackup } from "@/lib/transfer";
import { HostedClientError, readOnlineLibrary, saveOnlineLibrary } from "@/lib/hosted-client";
import { deferred } from "./deferred";

vi.mock("@/components/HostedBoundary", () => ({ useHostedSession: vi.fn() }));
vi.mock("@/lib/browser-storage", () => ({ focusLocalStorage: window.localStorage }));
vi.mock("@/lib/library", () => ({ readLibrarySnapshot: vi.fn() }));
vi.mock("@/lib/transfer", () => ({ createLibraryBackup: vi.fn(), restoreLibraryBackup: vi.fn() }));
vi.mock("@/lib/hosted-client", async (original) => ({
  ...(await original<typeof import("@/lib/hosted-client")>()),
  readOnlineLibrary: vi.fn(),
  saveOnlineLibrary: vi.fn(),
}));

const savePendingEdits = vi.fn<() => boolean>();
const entry: LibraryEntry = {
  id: "design-a",
  title: "A",
  collection: "",
  favorite: false,
  created: "now",
  updated: "now",
  state: {} as LibraryEntry["state"],
};
const backup = JSON.stringify({ version: 1, entries: [entry], assets: { version: 1, images: {} } });
const remote = { raw: backup, etag: '"revision-1"' };
const snapshot = { entries: [entry], raw: "local-copy", needsRecovery: false, rejected: 0 };
const restored = {
  entries: [entry],
  added: 1,
  duplicates: 0,
  conflicts: 0,
  imageCount: 1,
  imagesAdded: 1,
  journeysAdded: 0,
  legacy: false,
  designCount: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  savePendingEdits.mockReturnValue(true);
  window.localStorage.clear();
  vi.mocked(useHostedSession).mockReturnValue({
    user: { id: "owner-a", email: "a@example.test" },
    storageAvailable: true,
    mode: "hosted",
  });
  vi.mocked(readOnlineLibrary).mockResolvedValue(null);
  vi.mocked(readLibrarySnapshot).mockReturnValue(snapshot);
  vi.mocked(createLibraryBackup).mockResolvedValue(backup);
  vi.mocked(saveOnlineLibrary).mockResolvedValue('"revision-2"');
  vi.mocked(restoreLibraryBackup).mockResolvedValue(restored);
});

describe("explicit online library handoff", () => {
  it("does not fetch or display a hosted library in the portable app", () => {
    vi.mocked(useHostedSession).mockReturnValue(null);
    const { container } = render(
      <HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(readOnlineLibrary).not.toHaveBeenCalled();
  });
  it("reads an existing online revision without importing or overwriting browser work", async () => {
    vi.mocked(readOnlineLibrary).mockResolvedValue(remote);
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    expect(await screen.findByText(/An online copy is available/)).toBeInTheDocument();
    expect(restoreLibraryBackup).not.toHaveBeenCalled();
    expect(saveOnlineLibrary).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save library online" })).toBeDisabled();
  });
  it("detects a Garden brief edited in another tab while the online save is in flight", async () => {
    const { gardenJourneyKey } = await import("@/lib/garden-journey");
    const pending = deferred<string>();
    vi.mocked(saveOnlineLibrary).mockReturnValue(pending.promise);
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByText(/no online library yet/);
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    await waitFor(() => expect(saveOnlineLibrary).toHaveBeenCalledOnce());
    window.localStorage.setItem(gardenJourneyKey(entry.id), "edited while saving");
    await act(async () => pending.resolve('"revision-2"'));
    expect(await screen.findByRole("status")).toHaveTextContent(/changed during the save/);
  });
  it("saves the validated image-complete backup with the checked creation precondition", async () => {
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByText(/no online library yet/);
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Saved 1 design online with their images, Garden briefs, and saved history",
    );
    expect(createLibraryBackup).toHaveBeenCalledWith([entry], expect.any(Object));
    expect(saveOnlineLibrary).toHaveBeenCalledWith(
      "owner-a",
      backup,
      null,
      expect.any(AbortSignal),
    );
    expect(
      screen.getByText(/unfinished studio draft and other browser settings/),
    ).toBeInTheDocument();
  });
  it("requires a safe restore before updating an existing online copy", async () => {
    vi.mocked(readOnlineLibrary).mockResolvedValue(remote);
    const refresh = vi.fn();
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={refresh} />);
    await screen.findByText(/An online copy is available/);
    fireEvent.click(screen.getByRole("button", { name: "Restore online library" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(restoreLibraryBackup).toHaveBeenCalledWith(backup, expect.any(Object));
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    await waitFor(() =>
      expect(saveOnlineLibrary).toHaveBeenCalledWith(
        "owner-a",
        backup,
        remote.etag,
        expect.any(AbortSignal),
      ),
    );
  });
  it("keeps a revision conflict visible and never retries or enables an unchecked overwrite", async () => {
    vi.mocked(saveOnlineLibrary).mockRejectedValue(
      new HostedClientError("Online copy changed; restore it first.", "conflict", 409),
    );
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByText(/no online library yet/);
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Online copy changed");
    expect(saveOnlineLibrary).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save library online" })).toBeDisabled();
    vi.mocked(readOnlineLibrary).mockResolvedValue(remote);
    fireEvent.click(screen.getByRole("button", { name: "Check online library" }));
    await screen.findByText(/An online copy is available/);
    expect(screen.getByRole("button", { name: "Save library online" })).toBeDisabled();
    expect(restoreLibraryBackup).not.toHaveBeenCalled();
  });
  it("retains the local recovery error and does not upload an incomplete library", async () => {
    vi.mocked(createLibraryBackup).mockRejectedValue(
      new Error("A saved design has a missing image."),
    );
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByText(/no online library yet/);
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("missing image");
    expect(saveOnlineLibrary).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("does not publish an empty browser library over any online copy", async () => {
    vi.mocked(readLibrarySnapshot).mockReturnValue({ ...snapshot, entries: [] });
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByText(/no online library yet/);
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no saved designs");
    expect(createLibraryBackup).not.toHaveBeenCalled();
    expect(saveOnlineLibrary).not.toHaveBeenCalled();
  });
  it("keeps an online restore pending until the local name or collection can be saved", async () => {
    vi.mocked(readOnlineLibrary).mockResolvedValue(remote);
    savePendingEdits.mockReturnValueOnce(false);
    const refresh = vi.fn();
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={refresh} />);
    await screen.findByText(/An online copy is available/);
    const restore = screen.getByRole("button", { name: "Restore online library" });
    fireEvent.click(restore);
    expect(restoreLibraryBackup).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save library online" })).toBeDisabled();
    fireEvent.click(restore);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
  it("does not mark a rejected restore as reviewed or refresh the browser library", async () => {
    vi.mocked(readOnlineLibrary).mockResolvedValue(remote);
    vi.mocked(restoreLibraryBackup).mockRejectedValue(new Error("An image could not be decoded."));
    const refresh = vi.fn();
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={refresh} />);
    await screen.findByText(/An online copy is available/);
    fireEvent.click(screen.getByRole("button", { name: "Restore online library" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be decoded");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save library online" })).toBeDisabled();
  });
  it("blocks further operations after an account-change response", async () => {
    vi.mocked(readOnlineLibrary).mockRejectedValue(
      new HostedClientError("Account changed. Reload.", "account_changed", 409),
    );
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Check online library" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Reload and verify your account" })).toHaveAttribute(
      "href",
      "/auth",
    );
  });
  it("allows a new check after the same account recovers from a temporary verification pause", async () => {
    vi.mocked(readOnlineLibrary).mockRejectedValueOnce(
      new HostedClientError("Retry account verification.", "session_unverified", 409),
    );
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Check online library" })).toBeEnabled();
    expect(
      screen.queryByRole("link", { name: "Reload and verify your account" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check online library" }));
    await screen.findByText(/no online library yet/);
    expect(screen.getByRole("button", { name: "Save library online" })).toBeEnabled();
  });
  it("does not start an upload after the panel unmounts during backup preparation", async () => {
    const pending = deferred<string>();
    vi.mocked(createLibraryBackup).mockReturnValue(pending.promise);
    const view = render(
      <HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />,
    );
    await screen.findByText(/no online library yet/);
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    await waitFor(() => expect(createLibraryBackup).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => pending.resolve(backup));
    expect(saveOnlineLibrary).not.toHaveBeenCalled();
  });
  it("acknowledges only the submitted snapshot when the local library changes during save", async () => {
    const pending = deferred<string>();
    vi.mocked(saveOnlineLibrary).mockReturnValue(pending.promise);
    render(<HostedLibraryPanel savePendingEdits={savePendingEdits} onRestored={vi.fn()} />);
    await screen.findByText(/no online library yet/);
    fireEvent.click(screen.getByRole("button", { name: "Save library online" }));
    await waitFor(() => expect(saveOnlineLibrary).toHaveBeenCalledOnce());
    vi.mocked(readLibrarySnapshot).mockReturnValue({ ...snapshot, raw: "later-work" });
    await act(async () => pending.resolve('"revision-2"'));
    expect(await screen.findByRole("status")).toHaveTextContent("library changed during the save");
  });
});
