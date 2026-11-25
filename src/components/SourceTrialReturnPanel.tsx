import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getBrowserOwnerId } from "@/lib/browser-storage";
import type { PreparedSourceTrial } from "@/lib/source-trial";
import {
  compareSourceTrialReturn,
  type SourceTrialReturnComparison,
} from "@/lib/source-trial-return";

export type SourceTrialReturnPanelProps = {
  prepared: PreparedSourceTrial;
  captureContext: () => () => void;
};

type Slot = 0 | 1;
type Selection = { name: string; bytes: Uint8Array | null; reading: boolean };
const emptySelections = (): [Selection, Selection] => [
  { name: "", bytes: null, reading: false },
  { name: "", bytes: null, reading: false },
];
const labels = ["Returned page file (.tsx)", "Returned style file (.module.css)"] as const;
const fileStates = {
  proposed: "Matches proposed bytes",
  original: "Matches original bytes",
  different: "Differs from both expected snapshots",
};
const conclusions = {
  proposed: {
    title: "Both selected files match the proposed changes",
    next: "Ask your coding assistant or developer to identify the isolated preview and exact revision, then show the actual build, visitor-task and selective undo results.",
  },
  original: {
    title: "Both selected files match the original bytes",
    next: "These files contain the original snapshot. This does not show that the proposal was applied or that undo was rehearsed. Ask which state the isolated project is currently in.",
  },
  partial: {
    title: "The selected files match different stages",
    next: "One file matches the proposal and one matches the original snapshot. Ask your coding assistant or developer to inspect the pair together before continuing; this does not prove how the difference happened.",
  },
  different: {
    title: "The selected files differ from this proposal",
    next: "At least one file matches neither expected snapshot. Keep these files and ask your coding assistant or developer to review the differences. Do not overwrite them to force a match.",
  },
};

async function readBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error("The returned file could not be read. Choose it again."));
    reader.onerror = () =>
      reject(new Error("The returned file could not be read. Choose it again."));
    reader.onabort = () => reject(new Error("The returned file read was cancelled."));
    reader.readAsArrayBuffer(file);
  });
}

/** An optional, ephemeral comparison of selected files, never a customer-project execution. */
export function SourceTrialReturnPanel({ prepared, captureContext }: SourceTrialReturnPanelProps) {
  const [open, setOpen] = useState(false);
  const lifetime = useRef({ prepared, epoch: 0 });
  if (lifetime.current.prepared !== prepared)
    lifetime.current = { prepared, epoch: lifetime.current.epoch + 1 };
  const epoch = lifetime.current.epoch;
  const isCurrent = () =>
    lifetime.current.prepared === prepared && lifetime.current.epoch === epoch;
  const capture = () => {
    const verify = captureContext();
    return () => {
      if (!isCurrent()) throw new Error("The proposal changed. Select the returned files again.");
      verify();
    };
  };
  return (
    <details open={open} className="rounded-lg border border-border p-4">
      <summary
        className="min-h-11 cursor-pointer py-2 font-medium"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          lifetime.current.epoch++;
          setOpen((previous) => !previous);
        }}
      >
        Check files returned by your coding assistant
      </summary>
      {open && (
        <ReturnedFiles
          key={epoch}
          prepared={prepared}
          captureContext={capture}
          isCurrent={isCurrent}
        />
      )}
    </details>
  );
}

function ReturnedFiles({
  prepared,
  captureContext,
  isCurrent,
}: SourceTrialReturnPanelProps & { isCurrent: () => boolean }) {
  const id = useId();
  const [selections, setSelections] = useState(emptySelections);
  const [comparison, setComparison] = useState<{
    value: SourceTrialReturnComparison;
    verify: () => void;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectionsNow = useRef(selections);
  const readJobs = useRef([0, 0]);
  const generation = useRef(0);
  const mounted = useRef(false);
  const binding = useRef<{ owner: string | null; verify: () => void } | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const errorHeading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const jobs = readJobs.current;
    const operation = generation;
    mounted.current = true;
    return () => {
      mounted.current = false;
      jobs[0]!++;
      jobs[1]!++;
      operation.current++;
    };
  }, []);
  useEffect(() => {
    if (comparison) resultHeading.current?.focus();
  }, [comparison]);
  useEffect(() => {
    if (error) errorHeading.current?.focus();
  }, [error]);

  function capture() {
    const owner = getBrowserOwnerId();
    binding.current ??= { owner, verify: captureContext() };
    const bound = binding.current;
    const verify = () => {
      if (!mounted.current || !isCurrent())
        throw new Error("The proposal changed. Select the returned files again.");
      if (getBrowserOwnerId() !== bound.owner)
        throw new Error("Your account changed. Close this panel and reload before checking files.");
      bound.verify();
    };
    verify();
    return verify;
  }
  function invalidate() {
    generation.current++;
    setComparison(null);
    setBusy(false);
    setError("");
    setNotice("");
  }
  function update(index: Slot, patch: Partial<Selection>) {
    const next: [Selection, Selection] = [...selectionsNow.current];
    next[index] = { ...next[index], ...patch };
    selectionsNow.current = next;
    setSelections(next);
  }
  function clear() {
    invalidate();
    readJobs.current[0]!++;
    readJobs.current[1]!++;
    selectionsNow.current = emptySelections();
    setSelections(selectionsNow.current);
  }
  function cancel() {
    invalidate();
    for (const index of [0, 1] as const) {
      readJobs.current[index]!++;
      if (selectionsNow.current[index].reading) update(index, { bytes: null, reading: false });
    }
    setNotice("File check cancelled. No project files have been changed.");
  }
  async function select(index: Slot, files: FileList | null) {
    if (!files?.length) return;
    invalidate();
    const job = ++readJobs.current[index]!;
    const selected = files[0]!;
    const expected = prepared.contract.files[index];
    const basename = expected.path.split("/").at(-1)!;
    const limit = Math.max(expected.beforeBytes, expected.afterBytes);
    update(index, { name: selected.name, bytes: null, reading: true });
    const current = () => mounted.current && isCurrent() && readJobs.current[index] === job;
    try {
      const verify = capture();
      if (files.length !== 1 || selected.name !== basename)
        throw new Error(
          `Choose exactly ${basename} for this slot, from the listed project folder.`,
        );
      if (!Number.isSafeInteger(selected.size) || selected.size < 0 || selected.size > limit)
        throw new Error(
          `This returned file is too large. The byte limit for ${basename} is ${limit}. Keep the file and ask for a review of its differences.`,
        );
      const buffer = await readBytes(selected);
      if (!current()) return;
      verify();
      if (
        !(buffer instanceof ArrayBuffer) ||
        buffer.byteLength !== selected.size ||
        buffer.byteLength > limit
      )
        throw new Error("The returned file size changed while reading. Choose the file again.");
      update(index, { bytes: new Uint8Array(buffer), reading: false });
    } catch (cause) {
      if (!current()) return;
      update(index, { bytes: null, reading: false });
      setError(cause instanceof Error ? cause.message : "The returned file could not be read.");
    }
  }
  async function compare() {
    invalidate();
    const job = generation.current;
    setBusy(true);
    const current = () => mounted.current && isCurrent() && generation.current === job;
    try {
      const verify = capture();
      const files = selectionsNow.current.map((selection, index) => {
        if (selection.bytes === null || selection.reading)
          throw new Error("Choose both returned files before checking them.");
        return { path: prepared.contract.files[index]!.path, bytes: selection.bytes };
      });
      const value = await compareSourceTrialReturn(prepared, files);
      if (!current()) return;
      verify();
      setComparison({ value, verify });
    } catch (cause) {
      if (current())
        setError(
          cause instanceof Error ? cause.message : "The returned files could not be checked.",
        );
    } finally {
      if (current()) setBusy(false);
    }
  }

  let visible = comparison;
  let contextError = "";
  if (comparison) {
    try {
      comparison.verify();
    } catch (cause) {
      visible = null;
      contextError =
        cause instanceof Error ? cause.message : "The trial context changed. Reopen this panel.";
    }
  }
  const reading = selections.some((selection) => selection.reading);
  const ready = selections.every((selection) => selection.bytes !== null && !selection.reading);
  const conclusion = visible ? conclusions[visible.value.state] : null;
  return (
    <div className="space-y-4 pt-3">
      <p className="text-sm">
        Ask your coding assistant or developer for these two complete files from the isolated
        project’s current state. Choose them in their matching slots below. Focus compares bytes
        with this proposal; it does not connect to or change the project.
      </p>
      {prepared.contract.version === 2 && prepared.contract.assets.length > 0 && (
        <p className="text-sm">
          This check covers the page and stylesheet only. Ask your developer to run the ZIP’s
          verifier on the project to check the font and license files, then confirm which fonts the
          browser renders.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Use the exact filenames shown. Your browser cannot confirm the project folder, so check the
        full paths with the sender. Selecting a file does not show that it is running on the site.
      </p>
      {([0, 1] as const).map((index) => (
        <div key={index} className="min-w-0">
          <label htmlFor={`${id}-file-${index}`} className="block text-sm font-medium">
            {labels[index]}
          </label>
          <p id={`${id}-path-${index}`} className="mt-1 break-all font-mono text-sm">
            {prepared.contract.files[index].path}
          </p>
          <input
            id={`${id}-file-${index}`}
            type="file"
            accept={index === 0 ? ".tsx" : ".css"}
            aria-describedby={`${id}-path-${index}`}
            className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
            onChange={(event) => {
              const files = event.currentTarget.files;
              void select(index, files);
              event.currentTarget.value = "";
            }}
          />
          <p className="mt-1 break-words text-xs text-muted-foreground" role="status">
            {selections[index].reading
              ? "Reading selected bytes…"
              : selections[index].bytes !== null
                ? `${selections[index].name} · ${selections[index].bytes.byteLength} bytes selected`
                : "No returned file selected"}
          </p>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={!ready || busy || !!contextError}
          onClick={() => void compare()}
        >
          {busy ? "Comparing returned bytes…" : "Check returned files"}
        </Button>
        <Button type="button" variant="outline" onClick={clear}>
          Clear returned files
        </Button>
        {(busy || reading) && (
          <Button type="button" variant="outline" onClick={cancel}>
            Cancel file check
          </Button>
        )}
      </div>
      {(error || contextError) && (
        <div
          ref={errorHeading}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/50 p-3 text-sm"
        >
          {contextError || error}
        </div>
      )}
      {visible && conclusion && (
        <section
          aria-label="Returned file comparison"
          className="space-y-3 rounded-md border border-border p-4"
        >
          <h4 ref={resultHeading} tabIndex={-1} className="font-medium">
            {conclusion.title}
          </h4>
          <ul className="space-y-2 text-sm">
            {visible.value.files.map((file) => (
              <li key={file.path}>
                <p className="break-all font-mono text-sm">{file.path}</p>
                <p>{fileStates[file.state]}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm">{conclusion.next}</p>
          <p className="text-sm text-muted-foreground">
            This comparison does not establish what was applied in the repository, a successful
            build, browser behavior, working visitor tasks, successful undo, or a release. Your
            launch history is unchanged.
          </p>
        </section>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {notice}
      </p>
      <p className="text-sm text-muted-foreground">
        Returned files stay in memory in this open panel; their contents are not displayed, run,
        uploaded or saved. Closing it clears the selections. After leaving the source trial, use the
        same original files and saved design and plan to recreate the proposal before comparing a
        return. Focus keeps no source copy for you.
      </p>
    </div>
  );
}
