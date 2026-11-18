import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowUpRight, Download, FileSearch, Upload, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BrandLogo } from "@/components/BrandArt";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/exportPack";
import {
  TELESCOPE_LIMITS,
  TELESCOPE_STATES,
  TELESCOPE_STATE_HINTS,
  compareTelescopeReceipts,
  inspectTelescopeArtifact,
  parseTelescopeReceipt,
  telescopeTestPlan,
  type TelescopeReceipt,
  type TelescopeState,
} from "@/lib/telescope";

export const Route = createFileRoute("/telescope")({
  head: () => ({
    meta: [
      { title: "Telescope — inspect a build with Focus" },
      {
        name: "description",
        content:
          "Inspect local frontend files, identify the exact build, and prepare its interaction test plan.",
      },
    ],
  }),
  component: Telescope,
});

export function Telescope() {
  const [receipt, setReceipt] = useState<TelescopeReceipt | null>(null);
  const [previous, setPrevious] = useState<TelescopeReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [readingReceipt, setReadingReceipt] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [status, setStatus] = useState("");
  const [task, setTask] = useState("");
  const [expectations, setExpectations] = useState<Partial<Record<TelescopeState, string>>>({});
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const inspectionId = useRef(0);
  const importId = useRef(0);
  const hasPlan = !!task.trim() || Object.keys(expectations).length > 0;
  const blocker = useBlocker({
    shouldBlockFn: () => hasPlan,
    enableBeforeUnload: hasPlan,
    withResolver: true,
  });

  const inspect = async (file: File) => {
    const id = ++inspectionId.current;
    setError("");
    setStatus("");
    setShowAll(false);
    setBusy(true);
    try {
      if (!file.size || file.size > TELESCOPE_LIMITS.fileBytes)
        throw new Error("Choose a nonempty built HTML or ZIP file no larger than 10 MiB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (id !== inspectionId.current) return;
      const result = await inspectTelescopeArtifact(file.name, bytes);
      if (id !== inspectionId.current) return;
      setReceipt(result);
      setStatus("Static inventory complete. Browser and interaction tests have not run.");
    } catch (cause) {
      if (id === inspectionId.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "This file could not be inspected. Try a smaller built export.",
        );
        if (receipt)
          setStatus(
            `The replacement was not accepted. Your previous inspection for ${receipt.artifact.name} is retained below.`,
          );
      }
    } finally {
      if (id === inspectionId.current) setBusy(false);
    }
  };
  const importReceipt = async (file: File) => {
    const id = ++importId.current;
    setImportError("");
    setReadingReceipt(true);
    try {
      if (file.size > TELESCOPE_LIMITS.receiptBytes)
        throw new Error("Choose a Telescope receipt smaller than 256 KiB.");
      const imported = parseTelescopeReceipt(await file.text());
      if (id === importId.current) setPrevious(imported);
    } catch (cause) {
      if (id === importId.current)
        setImportError(
          (cause instanceof Error ? cause.message : "This receipt could not be read.") +
            (previous ? " Your previous imported receipt is retained." : ""),
        );
    } finally {
      if (id === importId.current) setReadingReceipt(false);
    }
  };
  const clear = () => {
    inspectionId.current++;
    importId.current++;
    setReceipt(null);
    setPrevious(null);
    setBusy(false);
    setReadingReceipt(false);
    setError("");
    setImportError("");
    setStatus("");
    setTask("");
    setExpectations({});
    if (fileInput.current) fileInput.current.value = "";
    if (receiptInput.current) receiptInput.current.value = "";
  };
  const download = (kind: "receipt" | "plan") => {
    if (!receipt) return;
    try {
      const plan = kind === "plan";
      downloadBlob(
        new Blob(
          [
            plan
              ? telescopeTestPlan(receipt, task, expectations)
              : JSON.stringify(receipt, null, 2) + "\n",
          ],
          { type: plan ? "text/markdown;charset=utf-8" : "application/json" },
        ),
        plan ? "telescope-interaction-plan.md" : "telescope-build-receipt.json",
      );
      setStatus(`${plan ? "Test plan" : "Build receipt"} download started. Check your downloads.`);
      setError("");
    } catch {
      setError(
        "The download could not be started. Your current inspection is still available; please try again.",
      );
      setStatus("");
    }
  };
  const matching = receipt && previous ? compareTelescopeReceipts(previous, receipt) : null;
  const visibleFindings = receipt?.findings.slice(0, showAll ? undefined : 8) ?? [];

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <header className="mb-8 max-w-3xl">
          <BrandLogo variant="telescope" decorative />
          <p className="eyebrow mt-5">Advanced tools</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Telescope</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Look closer at the build you intend to deliver.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Inspect a local HTML or ZIP export, identify its exact bytes, and prepare the tasks a
            real browser must test. Your files stay in this tab. Telescope does not render your
            HTML, execute scripts, contact your site, or install changes.
          </p>
        </header>

        <section
          aria-labelledby="telescope-intake-title"
          className="rounded-2xl border border-border bg-card p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow">01 / Choose the build</p>
              <h2 id="telescope-intake-title" className="mt-2 font-display text-2xl">
                Bring the files you will actually ship.
              </h2>
              <p
                id="telescope-file-help"
                className="mt-3 text-sm leading-relaxed text-muted-foreground"
              >
                Choose built HTML or a built-site ZIP, up to 10 MiB. A single HTML page can be up to
                2 MiB. Source projects needing a server or build step are not fully represented by a
                static inventory.
              </p>
            </div>
            <FileSearch size={28} aria-hidden="true" className="text-muted-foreground" />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <input
              ref={fileInput}
              type="file"
              accept=".html,.htm,.zip,text/html,application/zip"
              className="hidden"
              aria-label="Built HTML or ZIP file"
              aria-describedby="telescope-file-help"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void inspect(file);
                event.target.value = "";
              }}
            />
            <Button className="min-h-11" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Upload size={16} />
              {busy ? "Inspecting local files…" : "Choose HTML or ZIP"}
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => (hasPlan ? setConfirmClear(true) : clear())}
            >
              <X size={16} />
              Clear this session
            </Button>
          </div>
          <details className="mt-4 text-sm text-muted-foreground">
            <summary className="min-h-8 cursor-pointer">Inspection limits and privacy</summary>
            <p className="mt-2 max-w-3xl leading-relaxed">
              ZIPs are limited to 200 entries, 8 MiB per expanded entry, 32 MiB total expanded size
              and 8 MiB inspected HTML/CSS. Actual streamed text is bounded, and processing has an
              eight-second budget. Unsupported, encrypted, ambiguous or unsafe ZIP structures are
              refused. Files are not extracted to disk, uploaded, or saved in browser storage.
              Downloaded receipts contain filenames and observations; review them before sharing.
            </p>
          </details>
        </section>
        {busy && (
          <p role="status" className="mt-4 text-sm">
            Reading only local bytes. No browser or customer-site test is running.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {status}
          </p>
        )}

        {receipt && (
          <section aria-labelledby="telescope-result-title" className="mt-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow">02 / Static observations</p>
                <h2 id="telescope-result-title" className="mt-2 font-display text-2xl">
                  This build, precisely identified.
                </h2>
              </div>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => download("receipt")}
              >
                <Download size={16} />
                Download build receipt
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="break-all font-medium">{receipt.artifact.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {receipt.artifact.bytes.toLocaleString()} bytes ·{" "}
                {receipt.artifact.kind.toUpperCase()} · static inventory only
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                SHA-256 of the exact selected file
              </p>
              <code className="mt-1 block break-all text-xs leading-relaxed">
                {receipt.artifact.sha256}
              </code>
              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(
                  [
                    ["HTML pages", receipt.inventory.html],
                    ["Stylesheets", receipt.inventory.css],
                    ["JavaScript files", receipt.inventory.javascript],
                    ["Images", receipt.inventory.images],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-xl tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 break-all text-sm text-muted-foreground">
                Likely HTML entry: {receipt.inventory.entryHtml ?? "not found"}. Hosting routes were
                not resolved.
              </p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These observations are not a visual review, security audit or release decision.
              JavaScript behavior, authenticated tasks, responsive layout and rollback remain
              untested.
            </p>
            <ul className="space-y-3">
              {visibleFindings.map((finding, index) => (
                <li
                  key={`${finding.id}-${index}`}
                  className="rounded-xl border border-border p-4 text-sm leading-relaxed"
                >
                  <p className="font-medium">
                    {finding.level === "fail"
                      ? "Needs attention"
                      : finding.level === "warn"
                        ? "Review this"
                        : "Not verified"}
                  </p>
                  <p className="mt-1 text-muted-foreground">{finding.message}</p>
                  {finding.path && (
                    <code className="mt-2 block break-all text-xs">{finding.path}</code>
                  )}
                </li>
              ))}
            </ul>
            {receipt.findings.length > 8 && (
              <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
                {showAll
                  ? "Show fewer observations"
                  : `Show all ${receipt.findings.length} observations`}
              </Button>
            )}
          </section>
        )}

        <section
          aria-labelledby="telescope-receipt-title"
          className="mt-9 rounded-2xl border border-border bg-card p-5 sm:p-7"
        >
          <p className="eyebrow">03 / Compare a previous receipt</p>
          <h2 id="telescope-receipt-title" className="mt-2 font-display text-2xl">
            Does it describe the same file?
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Import a Telescope build receipt to compare its recorded hash with your selected file. A
            matching hash identifies the same bytes; it does not authenticate the receipt's author
            or independently verify its findings.
          </p>
          <input
            ref={receiptInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Previous Telescope receipt JSON"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importReceipt(file);
              event.target.value = "";
            }}
          />
          <Button
            variant="outline"
            className="mt-4 min-h-11"
            disabled={readingReceipt}
            onClick={() => receiptInput.current?.click()}
          >
            <Upload size={16} />
            {readingReceipt ? "Reading receipt…" : "Import Telescope receipt"}
          </Button>
          {importError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {importError}
            </p>
          )}
          {previous && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-border bg-background p-4 text-sm leading-relaxed"
            >
              <p className="font-medium">
                {busy || readingReceipt
                  ? "Comparison paused while the new file is read. Previous results remain below."
                  : matching === "same-bytes"
                    ? "Same artifact bytes. Findings are still author-supplied."
                    : matching === "different-bytes"
                      ? "Different artifact bytes. The imported receipt is stale for this selected file."
                      : matching === "metadata-conflict"
                        ? "The recorded hash matches, but file size or type metadata disagrees. Treat this imported receipt as unverified."
                        : "Receipt loaded. Choose the corresponding build file to compare its bytes."}
              </p>
              <p className="mt-2 break-all text-muted-foreground">
                Recorded file: {previous.artifact.name}
              </p>
              <p className="mt-1 text-muted-foreground">
                No imported test result is counted as an independently rerun browser check.
              </p>
            </div>
          )}
        </section>

        <section
          aria-labelledby="telescope-plan-title"
          className="mt-9 rounded-2xl border border-border bg-card p-5 sm:p-7"
        >
          <p className="eyebrow">04 / Plan the real task test</p>
          <h2 id="telescope-plan-title" className="mt-2 font-display text-2xl">
            What must work for your visitor?
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Define the task and the states to exercise in an isolated preview with sandbox data.
            Every item starts as manual — not run. This workspace records no pass/fail claim and
            never approves a release.
          </p>
          <label className="mt-5 block text-sm font-medium" htmlFor="telescope-task">
            Primary visitor task
          </label>
          <textarea
            id="telescope-task"
            maxLength={1000}
            rows={2}
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="For example: find an available appointment, book it, and correct an invalid email without losing the selected time."
            className="mt-2 block w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Use sample tasks. Do not include passwords, access tokens or customer records.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {TELESCOPE_STATES.map((state) => (
              <label key={state} className="block rounded-xl border border-border p-4 text-sm">
                <span className="font-medium capitalize">{state}</span>
                <span className="ml-2 text-xs text-muted-foreground">manual — not run</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  aria-label={`${state} expected outcome`}
                  value={expectations[state] ?? TELESCOPE_STATE_HINTS[state]}
                  onChange={(event) =>
                    setExpectations({ ...expectations, [state]: event.target.value })
                  }
                  className="mt-3 block w-full rounded-md border border-input bg-background p-2.5 text-sm leading-relaxed"
                />
              </label>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-5 min-h-11"
            disabled={!receipt || !task.trim() || busy}
            onClick={() => download("plan")}
          >
            <Download size={16} />
            Download task test plan
          </Button>
          {!receipt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Inspect a build first so the plan can identify its exact file hash.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Your inputs stay in this tab and disappear when you leave, reload, or clear this
            session. Download the plan to keep them.
          </p>
        </section>
        <aside className="mt-9 border-t border-border pt-6">
          <h2 className="font-display text-xl">Continue the review</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Use Quality lab for detailed checks and browser-audit receipts, and the Blind review
            room for independent craft comparisons. Neither a static inventory nor a good score
            replaces the customer's task tests and rollback evidence.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/quality" target="_blank" rel="noopener noreferrer">
                Open Quality lab <span className="sr-only">(opens in a new tab)</span>
                <ArrowUpRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/review-room" target="_blank" rel="noopener noreferrer">
                Open Blind review room <span className="sr-only">(opens in a new tab)</span>
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
        </aside>
      </main>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear your task plan?"
        body="Your task and edited state expectations will be removed from this tab. Download your plan first if you want to keep it."
        confirmLabel="Clear this session"
        onConfirm={clear}
      />
      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
        title="Leave your task plan?"
        body="Your task and edited state expectations will be lost when you leave Telescope. Stay here to download the plan first."
        confirmLabel="Leave Telescope"
        onConfirm={() => {
          if (blocker.status === "blocked") blocker.proceed();
        }}
      />
    </div>
  );
}
