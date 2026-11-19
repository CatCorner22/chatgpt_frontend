import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTokens } from "@/lib/design";
import { LIBRARY_KEY, type LibraryEntry } from "@/lib/library";
import { EMPTY_TARGET_DRAFT, TARGET_DRAFT_KEY, type TargetDraft } from "@/lib/target";

const operations = vi.hoisted(() => ({
  prepare: vi.fn(),
  download: vi.fn(),
  blocker: vi.fn(),
  owner: vi.fn(),
  sourcePackage: vi.fn(),
}));
vi.mock("@/lib/target", async (original) => ({
  ...(await original<typeof import("@/lib/target")>()),
  prepareTargetPack: operations.prepare,
}));
vi.mock("@/lib/exportPack", async (original) => ({
  ...(await original<typeof import("@/lib/exportPack")>()),
  downloadBlob: operations.download,
}));
vi.mock("@/lib/browser-storage", async (original) => ({
  ...(await original<typeof import("@/lib/browser-storage")>()),
  getBrowserOwnerId: operations.owner,
}));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Focus navigation</header> }));
vi.mock("@/lib/source-trial-package", async (original) => ({
  ...(await original<typeof import("@/lib/source-trial-package")>()),
  buildSourceTrialPackage: operations.sourcePackage,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useBlocker: operations.blocker,
  Link: ({
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; search?: Record<string, string> }) => (
    <a
      href={to + (search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "")}
      {...props}
    />
  ),
}));
import { Target } from "@/routes/target";

const entry: LibraryEntry = {
  id: "target-design",
  title: "Quiet booking",
  collection: "",
  favorite: false,
  created: "2026-11-18T00:00:00Z",
  updated: "2026-11-18T00:00:00Z",
  state: {
    libraryId: "target-design",
    tokens: normalizeTokens({ radius: 16 }),
    content: {
      brand: "Booking",
      headline: "Keep original words",
      sub: "",
      cta: "Book",
      quote: "",
      features: [],
    },
  },
};
const complete: TargetDraft = {
  ...EMPTY_TARGET_DRAFT,
  designId: entry.id,
  page: "Appointment page",
  improvement: "Make times easier to scan",
  tasks: "Book a time and correct an invalid email",
  backup: "Saved revision and separate copy of unfinished work",
  preview: "Local isolated branch using fake bookings and sandbox email",
  rollback: "Selectively restore styling and rerun booking",
};
function seed(draft: TargetDraft = complete) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, entries: [entry] }));
  localStorage.setItem(TARGET_DRAFT_KEY, JSON.stringify(draft));
}
async function openReview() {
  render(<Target />);
  await screen.findByLabelText("Which saved Vision should guide this?");
  for (let index = 0; index < 3; index++)
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("heading", { name: "Prepare the handoff" })).toHaveFocus();
}
function deferredPack() {
  let finish!: (value: Blob) => void;
  operations.prepare.mockImplementation(
    () =>
      new Promise<Blob>((resolve) => {
        finish = resolve;
      }),
  );
  return () =>
    act(async () => {
      finish(new Blob(["validated ZIP"]));
    });
}
beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  vi.stubGlobal("crypto", webcrypto);
  localStorage.clear();
  operations.prepare.mockReset().mockResolvedValue(new Blob(["validated ZIP"]));
  operations.download.mockReset();
  operations.blocker.mockReset().mockReturnValue({ status: "idle" });
  operations.owner.mockReset().mockReturnValue(null);
  operations.sourcePackage.mockReset().mockResolvedValue(new Blob(["source trial package"]));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Target guided preparation", () => {
  it("keeps the source tools closed until requested and clears them on step exit without losing the plan", async () => {
    seed();
    await openReview();
    expect(screen.queryByLabelText("What runs this page?")).toBeNull();
    fireEvent.click(screen.getByText("Include a proposed code change · optional"));
    expect(screen.getByText("Loading optional source-change tools…")).toBeInTheDocument();
    // The first dynamic import includes Vite's cold module transform. Keep the
    // wait bounded without treating its one-second default as a product deadline.
    expect(
      await screen.findByLabelText("What runs this page?", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("What runs this page?"), { target: { value: "vite" } });
    fireEvent.change(screen.getByLabelText("Page file path in the project"), {
      target: { value: "src/Booking.tsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByLabelText("What runs this page?")).toBeNull();
    expect(screen.getByLabelText("Where will the isolated trial run?")).toHaveValue(
      complete.preview,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByLabelText("What runs this page?")).toBeNull();
    fireEvent.click(screen.getByText("Include a proposed code change · optional"));
    expect(await screen.findByLabelText("What runs this page?")).toHaveValue("");
    expect(JSON.parse(localStorage.getItem(TARGET_DRAFT_KEY)!)).toEqual(complete);
    expect(operations.sourcePackage).not.toHaveBeenCalled();
  });

  it.each([
    { integration: "new", platform: "react" },
    { integration: "existing", platform: "lovable" },
  ] as const)(
    "keeps the $integration/$platform handoff free of source requirements",
    async (scope) => {
      seed({ ...complete, ...scope });
      await openReview();
      expect(screen.queryByText("Include a proposed code change · optional")).toBeNull();
      expect(screen.getByRole("button", { name: "Prepare and download trial ZIP" })).toBeEnabled();
    },
  );

  it.each(["design", "draft", "owner"] as const)(
    "rechecks the parent %s before delivering a source proposal",
    async (change) => {
      seed();
      await openReview();
      fireEvent.click(screen.getByText("Include a proposed code change · optional"));
      fireEvent.change(await screen.findByLabelText("What runs this page?"), {
        target: { value: "vite" },
      });
      fireEvent.change(screen.getByLabelText("Page file path in the project"), {
        target: { value: "src/Booking.tsx" },
      });
      fireEvent.change(screen.getByLabelText("Style file path in the project"), {
        target: { value: "src/Booking.module.css" },
      });
      const component = `import styles from './Booking.module.css'; export default function Booking(){return <main className={styles.page}><h1 className={styles.heading}>Book</h1><p className={styles.body}>Choose a date.</p><a className={styles.action} href="/book">Continue</a></main>;}`;
      const css = `.page{background-color:#f4f8fa}.heading{color:#112233}.body{color:#334455}.action{background-color:#334455;color:#ffffff}`;
      fireEvent.change(screen.getByLabelText("Page file (.tsx)"), {
        target: { files: [new File([component], "Booking.tsx")] },
      });
      fireEvent.change(screen.getByLabelText("Matching style file (.module.css)"), {
        target: { files: [new File([css], "Booking.module.css")] },
      });
      await waitFor(() => expect(screen.getAllByText(/Read in this tab/)).toHaveLength(2));
      fireEvent.click(screen.getByRole("button", { name: "Check whether this page is supported" }));
      fireEvent.click(screen.getByRole("checkbox", { name: /These are the page parts/ }));
      fireEvent.click(screen.getByRole("button", { name: "Prepare proposed edits" }));
      await screen.findByRole("button", { name: "Download proposed code change" });
      let finish!: (blob: Blob) => void;
      operations.sourcePackage.mockImplementationOnce(
        () =>
          new Promise<Blob>((resolve) => {
            finish = resolve;
          }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Download proposed code change" }));
      await waitFor(() => expect(operations.sourcePackage).toHaveBeenCalledOnce());
      if (change === "design")
        localStorage.setItem(
          LIBRARY_KEY,
          JSON.stringify({ version: 1, entries: [{ ...entry, title: "Changed elsewhere" }] }),
        );
      else if (change === "draft")
        localStorage.setItem(
          TARGET_DRAFT_KEY,
          JSON.stringify({ ...complete, page: "Changed elsewhere" }),
        );
      else
        operations.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      await act(async () => finish(new Blob(["source proposal"])));
      expect(operations.download).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeVisible();
      expect(screen.queryByText("Prepared for a trial")).toBeNull();
    },
  );

  it("uses the saved design, keeps answers when moving backward, and blocks missing task details", async () => {
    seed({ ...EMPTY_TARGET_DRAFT, designId: entry.id });
    render(<Target />);
    expect(
      await screen.findByRole("radio", { name: /Restyle an existing app or website/ }),
    ).toBeChecked();
    expect(screen.getByLabelText("Where is the project built?")).toHaveValue("react");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Which page or screen will you start with?"), {
      target: { value: "Booking page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/visitor tasks/);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Which page or screen will you start with?")).toHaveValue(
      "Booking page",
    );
    expect(JSON.parse(localStorage.getItem(TARGET_DRAFT_KEY)!).page).toBe("Booking page");
    expect(operations.prepare).not.toHaveBeenCalled();
  });

  it("downloads only after the validated preparation resolves and labels the attempt honestly", async () => {
    seed();
    const finish = deferredPack();
    await openReview();
    expect(screen.queryByText("Prepared for a trial")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prepare and download trial ZIP" }));
    await waitFor(() =>
      expect(operations.prepare).toHaveBeenCalledWith(
        complete,
        expect.objectContaining({
          id: entry.id,
          state: expect.objectContaining({ tokens: entry.state.tokens }),
        }),
      ),
    );
    expect(operations.download).not.toHaveBeenCalled();
    await finish();
    expect(operations.download).toHaveBeenCalledWith(
      expect.any(Blob),
      "focus-target-existing-site-pack.zip",
    );
    expect(screen.getByText(/Download started.*Check your downloads/)).toBeInTheDocument();
    expect(screen.getAllByText("Prepared for a trial").length).toBeGreaterThan(0);
    expect(screen.getByText("No changes applied to your app or website")).toBeInTheDocument();
  });

  it("does not report preparation success when validation or browser download fails", async () => {
    seed();
    operations.prepare.mockRejectedValueOnce(new Error("Contrast check failed"));
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Prepare and download trial ZIP" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Contrast check failed");
    expect(operations.download).not.toHaveBeenCalled();
    operations.download.mockImplementation(() => {
      throw new Error("Browser blocked download");
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare and download trial ZIP" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Browser blocked download"),
    );
    expect(screen.queryByText("Prepared for a trial")).not.toBeInTheDocument();
  });

  it.each(["edit", "cancel", "unmount"] as const)(
    "discards a pending ZIP after %s",
    async (action) => {
      seed();
      const finish = deferredPack();
      await openReview();
      fireEvent.click(screen.getByRole("button", { name: "Prepare and download trial ZIP" }));
      await waitFor(() => expect(operations.prepare).toHaveBeenCalledOnce());
      if (action === "edit") {
        fireEvent.click(screen.getByRole("button", { name: "Back" }));
        fireEvent.change(screen.getByLabelText("Where will the isolated trial run?"), {
          target: { value: "A different isolated preview" },
        });
      } else if (action === "cancel")
        fireEvent.click(screen.getByRole("button", { name: "Cancel preparation" }));
      else cleanup();
      await finish();
      expect(operations.download).not.toHaveBeenCalled();
    },
  );

  it.each(["design", "draft", "owner"] as const)(
    "refuses a pending ZIP if its %s changes before delivery",
    async (kind) => {
      seed();
      const finish = deferredPack();
      await openReview();
      fireEvent.click(screen.getByRole("button", { name: "Prepare and download trial ZIP" }));
      await waitFor(() => expect(operations.prepare).toHaveBeenCalledOnce());
      if (kind === "design")
        localStorage.setItem(
          LIBRARY_KEY,
          JSON.stringify({
            version: 1,
            entries: [
              { ...entry, state: { ...entry.state, tokens: normalizeTokens({ radius: 4 }) } },
            ],
          }),
        );
      if (kind === "draft")
        localStorage.setItem(
          TARGET_DRAFT_KEY,
          JSON.stringify({ ...complete, page: "Another tab's work" }),
        );
      if (kind === "owner")
        operations.owner.mockImplementation(() => {
          throw new Error("Your session needs verification");
        });
      await finish();
      expect(operations.download).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    },
  );

  it("keeps damaged storage untouched, offers recovery, and guards unsaved in-tab answers", async () => {
    seed();
    const damaged = "{saved-but-unreadable-target";
    localStorage.setItem(TARGET_DRAFT_KEY, damaged);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<Target />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "original copy has not been changed",
    );
    fireEvent.change(screen.getByLabelText("Which saved Vision should guide this?"), {
      target: { value: entry.id },
    });
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(damaged);
    const guard = operations.blocker.mock.calls.at(-1)![0] as {
      shouldBlockFn: () => boolean;
      enableBeforeUnload: boolean;
    };
    expect(guard.shouldBlockFn()).toBe(true);
    expect(guard.enableBeforeUnload).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Download original for recovery" }));
    expect(operations.download).toHaveBeenCalledWith(expect.any(Blob), "target-draft-recovery.txt");
  });

  it("preserves partial library damage and still offers creation help when no designs are available", async () => {
    const raw = JSON.stringify({ version: 1, entries: [entry, { id: "bad", state: null }] });
    localStorage.setItem(LIBRARY_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const { unmount } = render(<Target />);
    expect(await screen.findByRole("alert")).toHaveTextContent("original library is unchanged");
    expect(screen.getByRole("option", { name: entry.title })).toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(raw);
    unmount();
    localStorage.removeItem(LIBRARY_KEY);
    render(<Target />);
    expect(await screen.findByRole("link", { name: "Create a Vision" })).toHaveAttribute(
      "href",
      "/?view=studio",
    );
    expect(screen.getByRole("link", { name: "Open My designs" })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("keeps the last readable design visible when a subsequent library read is corrupt", async () => {
    seed();
    render(<Target />);
    await screen.findByRole("option", { name: entry.title });
    localStorage.setItem(LIBRARY_KEY, "{new-library-damage");
    fireEvent.click(screen.getByRole("button", { name: "Reload designs" }));
    expect(screen.getByRole("alert")).toHaveTextContent("original library is unchanged");
    expect(screen.getByRole("option", { name: entry.title })).toBeInTheDocument();
    for (let index = 0; index < 3; index++)
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare and download trial ZIP" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "selected saved design changed or could not be read",
    );
    expect(operations.prepare).not.toHaveBeenCalled();
    expect(operations.download).not.toHaveBeenCalled();
  });

  it("detects another tab's draft, keeps current answers and asks before loading the other copy", async () => {
    seed();
    render(<Target />);
    await screen.findByLabelText("Where is the project built?");
    const other = JSON.stringify({ ...complete, page: "Other tab page" });
    localStorage.setItem(TARGET_DRAFT_KEY, other);
    fireEvent.change(screen.getByLabelText("Where is the project built?"), {
      target: { value: "lovable" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("changed in another tab");
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(other);
    fireEvent.click(screen.getByRole("button", { name: "Reload saved answers" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("replaces the unsaved answers");
    fireEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(screen.getByLabelText("Where is the project built?")).toHaveValue("lovable");
    fireEvent.click(screen.getByRole("button", { name: "Reload saved answers" }));
    fireEvent.click(screen.getByRole("button", { name: "Load saved answers" }));
    expect(screen.getByLabelText("Where is the project built?")).toHaveValue("react");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Which page or screen will you start with?")).toHaveValue(
      "Other tab page",
    );
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(other);
  });

  it("reports failed autosaves without losing the current answers or reporting them saved", async () => {
    seed();
    const original = localStorage.getItem(TARGET_DRAFT_KEY);
    render(<Target />);
    await screen.findByLabelText("Where is the project built?");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota full");
    });
    fireEvent.change(screen.getByLabelText("Where is the project built?"), {
      target: { value: "lovable" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed as saved");
    expect(screen.getByLabelText("Where is the project built?")).toHaveValue("lovable");
    expect(screen.queryByText("Answers saved in this browser")).not.toBeInTheDocument();
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(original);
    const guard = operations.blocker.mock.calls.at(-1)![0] as { shouldBlockFn: () => boolean };
    expect(guard.shouldBlockFn()).toBe(true);
  });

  it("offers manual copy when the clipboard is unavailable without claiming preparation", async () => {
    seed();
    const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard blocked")) },
    });
    try {
      await openReview();
      fireEvent.click(screen.getAllByRole("button", { name: "Copy prompt" })[0]!);
      expect(await screen.findByText(/Could not copy automatically/)).toBeInTheDocument();
      expect(
        (screen.getByLabelText("Inspect and agree the trial prompt") as HTMLTextAreaElement).value,
      ).toContain("Inspect the repository");
      expect(screen.queryByText("Prepared for a trial")).not.toBeInTheDocument();
      expect(operations.prepare).not.toHaveBeenCalled();
    } finally {
      if (previous) Object.defineProperty(navigator, "clipboard", previous);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("offers the latest unreadable saved copy for recovery after a failed reload", async () => {
    seed();
    render(<Target />);
    await screen.findByLabelText("Where is the project built?");
    const damaged = "{newest-unreadable-draft";
    localStorage.setItem(TARGET_DRAFT_KEY, damaged);
    fireEvent.change(screen.getByLabelText("Where is the project built?"), {
      target: { value: "lovable" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Reload saved answers" }));
    fireEvent.click(screen.getByRole("button", { name: "Download original for recovery" }));
    const blob = operations.download.mock.calls.at(-1)![0] as Blob;
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(text).toBe(damaged);
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(damaged);
  });

  it("can prepare in-tab answers after explicitly rereading a damaged saved copy without replacing it", async () => {
    seed();
    render(<Target />);
    await screen.findByLabelText("Where is the project built?");
    const damaged = "{other-tab-interrupted-save";
    localStorage.setItem(TARGET_DRAFT_KEY, damaged);
    fireEvent.change(screen.getByLabelText("Where is the project built?"), {
      target: { value: "lovable" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Reload saved answers" }));
    for (let index = 0; index < 3; index++)
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare and download trial ZIP" }));
    await waitFor(() =>
      expect(operations.download).toHaveBeenCalledWith(
        expect.any(Blob),
        "focus-target-existing-site-pack.zip",
      ),
    );
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(damaged);
  });
});
