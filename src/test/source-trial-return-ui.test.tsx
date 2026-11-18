import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourceTrialReturnPanel } from "@/components/SourceTrialReturnPanel";
import { normalizeTokens } from "@/lib/design";
import { prepareSourceTrial, type PreparedSourceTrial } from "@/lib/source-trial";
import * as returnCore from "@/lib/source-trial-return";

const boundary = vi.hoisted(() => ({ owner: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/browser-storage", async (original) => ({
  ...(await original<typeof import("@/lib/browser-storage")>()),
  getBrowserOwnerId: boundary.owner,
}));

const source = `import styles from './Booking.module.css';
export default function Booking() {
  return <main className={styles.page}><h1 className={styles.heading}>Book a class</h1><p className={styles.body}>Choose a date.</p><a className={styles.action} href="/book">Reserve</a></main>;
}
`;
const css = `.page { background-color: #f4f8fa; padding: 24px; }
.heading { color: #112233; }
.body { color: #334455; }
.action { background-color: #334455; color: #ffffff; }
`;
let proposal: PreparedSourceTrial;
const captureContext = () => {
  boundary.verify();
  return boundary.verify;
};
const labels = ["Returned page file (.tsx)", "Returned style file (.module.css)"] as const;
function open() {
  fireEvent.click(screen.getByText("Check files returned by your coding assistant"));
}
function pick(index: 0 | 1, file: File | null) {
  fireEvent.change(screen.getByLabelText(labels[index]), {
    target: { files: file ? [file] : [] },
  });
}
function file(index: 0 | 1, state: "before" | "after") {
  return new File(
    [proposal.files[index][state]],
    index === 0 ? "Booking.tsx" : "Booking.module.css",
  );
}
async function choose(states: ["before" | "after", "before" | "after"] = ["after", "after"]) {
  pick(0, file(0, states[0]));
  pick(1, file(1, states[1]));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Check returned files" })).toBeEnabled(),
  );
}
async function check() {
  fireEvent.click(screen.getByRole("button", { name: "Check returned files" }));
  return screen.findByRole("region", { name: "Returned file comparison" });
}
function delayedFile(name = "Booking.tsx", contents = proposal.files[0].after) {
  const bytes = new TextEncoder().encode(contents);
  let resolve!: (value: ArrayBuffer) => void;
  const read = vi.fn(
    () =>
      new Promise<ArrayBuffer>((finish) => {
        resolve = finish;
      }),
  );
  const selected = new File([contents], name);
  Object.defineProperty(selected, "arrayBuffer", { value: read });
  return { selected, read, finish: () => act(async () => resolve(bytes.buffer)) };
}
function pauseHash() {
  const comparison = vi.spyOn(returnCore, "compareSourceTrialReturn");
  const original = webcrypto.subtle.digest.bind(webcrypto.subtle);
  let release!: () => void;
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(webcrypto.subtle, "digest").mockImplementationOnce(async (...args) => {
    reached();
    await gate;
    return original(...args);
  });
  return {
    started,
    finish: () =>
      act(async () => {
        release();
        await comparison.mock.results.at(-1)!.value;
      }),
  };
}

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  boundary.owner.mockReset().mockReturnValue("owner-a");
  boundary.verify.mockReset();
  proposal = await prepareSourceTrial(
    [
      { path: "src/Booking.tsx", content: source },
      { path: "src/Booking.module.css", content: css },
    ],
    { id: "saved-design", tokens: normalizeTokens({ radius: 12 }) },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Checking returned source files", () => {
  it("starts closed and clears selected bytes and results when closed", async () => {
    render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
    expect(screen.queryByLabelText(labels[0])).toBeNull();
    open();
    expect(screen.getByRole("button", { name: "Check returned files" })).toBeDisabled();
    expect(screen.getByText("src/Booking.tsx")).toBeVisible();
    expect(screen.getByText(/browser cannot confirm.*folder/i)).toBeVisible();
    await choose();
    await check();
    open();
    expect(screen.queryByRole("region", { name: "Returned file comparison" })).toBeNull();
    open();
    expect(screen.getByRole("button", { name: "Check returned files" })).toBeDisabled();
  });

  it.each([
    [["after", "after"], "Both selected files match the proposed changes"],
    [["before", "before"], "Both selected files match the original bytes"],
    [["after", "before"], "The selected files match different stages"],
  ] as const)("reports %j as selected-file evidence only", async (states, heading) => {
    render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
    open();
    await choose([...states]);
    await check();
    await waitFor(() => expect(screen.getByRole("heading", { name: heading })).toHaveFocus());
    expect(screen.getByText(/does not establish.*build.*browser/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /launch|approve/i })).toBeNull();
  });

  it("compares invalid UTF-8 and empty files as bytes without decoding or rendering them", async () => {
    localStorage.setItem("focus:studio", "keep my work");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send");
    render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
    open();
    pick(0, new File([new Uint8Array([255, 254, 60, 115, 99, 114, 105, 112, 116])], "Booking.tsx"));
    pick(1, new File([], "Booking.module.css"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check returned files" })).toBeEnabled(),
    );
    await check();
    expect(
      screen.getByRole("heading", { name: "The selected files differ from this proposal" }),
    ).toBeVisible();
    expect(document.querySelector("main, iframe, script")).toBeNull();
    expect(storage).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(localStorage.getItem("focus:studio")).toBe("keep my work");
  });

  it("keeps the existing file after picker cancellation and invalidates a result on replacement", async () => {
    render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
    open();
    await choose();
    await check();
    pick(0, null);
    expect(screen.getByRole("region", { name: "Returned file comparison" })).toBeVisible();
    pick(0, file(0, "before"));
    expect(screen.queryByRole("region", { name: "Returned file comparison" })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check returned files" })).toBeEnabled(),
    );
    await check();
    expect(
      screen.getByRole("heading", { name: "The selected files match different stages" }),
    ).toBeVisible();
  });

  it("rejects incorrect names and oversized files before reading bytes", async () => {
    render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
    open();
    const wrongName = delayedFile("Other.tsx");
    pick(0, wrongName.selected);
    expect(await screen.findByRole("alert")).toHaveTextContent("Booking.tsx");
    expect(wrongName.read).not.toHaveBeenCalled();
    const tooLarge = delayedFile();
    Object.defineProperty(tooLarge.selected, "size", {
      value:
        Math.max(proposal.contract.files[0].beforeBytes, proposal.contract.files[0].afterBytes) + 1,
    });
    pick(0, tooLarge.selected);
    expect(await screen.findByRole("alert")).toHaveTextContent(/too large|byte limit/i);
    expect(tooLarge.read).not.toHaveBeenCalled();
  });

  it("rejects a read whose actual length differs from the selected file size", async () => {
    render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
    open();
    const selected = file(0, "after");
    Object.defineProperty(selected, "arrayBuffer", { value: async () => new ArrayBuffer(0) });
    pick(0, selected);
    expect(await screen.findByRole("alert")).toHaveTextContent(/size changed|size.*match/i);
    expect(screen.getByRole("button", { name: "Check returned files" })).toBeDisabled();
  });

  it("discards an older read after the same slot is replaced", async () => {
    render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
    open();
    const older = delayedFile();
    pick(0, older.selected);
    await choose(["before", "before"]);
    await older.finish();
    await check();
    expect(
      screen.getByRole("heading", { name: "Both selected files match the original bytes" }),
    ).toBeVisible();
  });

  it.each(["owner", "context"] as const)(
    "drops a delayed read after %s changes",
    async (change) => {
      render(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
      open();
      const pending = delayedFile();
      pick(0, pending.selected);
      pick(1, file(1, "after"));
      if (change === "owner")
        boundary.owner.mockImplementation(() => {
          throw new Error("Session locked");
        });
      else
        boundary.verify.mockImplementation(() => {
          throw new Error("The trial plan changed");
        });
      await pending.finish();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        change === "owner" ? "Session locked" : "trial plan changed",
      );
      expect(screen.getByRole("button", { name: "Check returned files" })).toBeDisabled();
      expect(screen.queryByRole("region", { name: "Returned file comparison" })).toBeNull();
    },
  );

  it.each(["owner", "context"] as const)(
    "hides an existing comparison when the %s check fails on render",
    async (change) => {
      const view = render(
        <SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />,
      );
      open();
      await choose();
      await check();
      if (change === "owner") boundary.owner.mockReturnValue("owner-b");
      else
        boundary.verify.mockImplementation(() => {
          throw new Error("The trial plan changed");
        });
      view.rerender(<SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />);
      expect(screen.queryByRole("region", { name: "Returned file comparison" })).toBeNull();
      expect(screen.getByRole("button", { name: "Check returned files" })).toBeDisabled();
      expect(screen.getByRole("alert")).toBeVisible();
    },
  );

  it.each(["clear", "cancel", "close", "proposal"] as const)(
    "discards a pending file read after %s",
    async (change) => {
      const view = render(
        <SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />,
      );
      open();
      const pending = delayedFile();
      pick(0, pending.selected);
      pick(1, file(1, "after"));
      if (change === "clear")
        fireEvent.click(screen.getByRole("button", { name: "Clear returned files" }));
      if (change === "cancel")
        fireEvent.click(screen.getByRole("button", { name: "Cancel file check" }));
      if (change === "close") open();
      if (change === "proposal")
        view.rerender(
          <SourceTrialReturnPanel
            prepared={structuredClone(proposal)}
            captureContext={captureContext}
          />,
        );
      await pending.finish();
      if (change === "close") open();
      expect(screen.getByRole("button", { name: "Check returned files" })).toBeDisabled();
      expect(screen.queryByRole("region", { name: "Returned file comparison" })).toBeNull();
    },
  );

  it.each([
    "replace",
    "clear",
    "cancel",
    "close",
    "proposal",
    "owner",
    "context",
    "unmount",
  ] as const)("does not publish a pending comparison after %s", async (change) => {
    const view = render(
      <SourceTrialReturnPanel prepared={proposal} captureContext={captureContext} />,
    );
    open();
    await choose();
    const pending = pauseHash();
    fireEvent.click(screen.getByRole("button", { name: "Check returned files" }));
    await pending.started;
    if (change === "replace") pick(0, file(0, "before"));
    if (change === "clear")
      fireEvent.click(screen.getByRole("button", { name: "Clear returned files" }));
    if (change === "cancel")
      fireEvent.click(screen.getByRole("button", { name: "Cancel file check" }));
    if (change === "close") open();
    if (change === "proposal")
      view.rerender(
        <SourceTrialReturnPanel
          prepared={structuredClone(proposal)}
          captureContext={captureContext}
        />,
      );
    if (change === "owner") boundary.owner.mockReturnValue("owner-b");
    if (change === "context")
      boundary.verify.mockImplementation(() => {
        throw new Error("The trial plan changed");
      });
    if (change === "unmount") view.unmount();
    await pending.finish();
    expect(screen.queryByRole("region", { name: "Returned file comparison" })).toBeNull();
    if (change === "close") {
      open();
      expect(screen.getByRole("button", { name: "Check returned files" })).toBeDisabled();
    }
  });
});
