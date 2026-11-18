import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Download, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BrandLogo } from "@/components/BrandArt";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/exportPack";
import { getBrowserOwnerId } from "@/lib/browser-storage";
import type { LibraryEntry } from "@/lib/library";
import {
  EMPTY_TARGET_DRAFT,
  TARGET_LIMITS,
  prepareTargetPack,
  readTargetDraft,
  readTargetLibrary,
  targetPrompts,
  targetStepIssues,
  writeTargetDraft,
  type TargetDraft,
  type TargetStep,
} from "@/lib/target";

export const Route = createFileRoute("/target")({
  head: () => ({
    meta: [
      { title: "Target — prepare a careful first trial with Focus" },
      {
        name: "description",
        content:
          "Turn a saved Vision into a scoped handoff and practical prompts for an isolated project trial.",
      },
    ],
  }),
  component: Target,
});

const STEPS = [
  "Your project",
  "One useful improvement",
  "Protect the working app",
  "Prepare the handoff",
] as const;
const PLATFORM_LABELS = {
  react: "GitHub · React or Next.js",
  lovable: "Lovable",
  wordpress: "WordPress",
  choose: "Help me choose",
};
const fieldClass =
  "mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Target() {
  const [draft, setDraft] = useState<TargetDraft>({ ...EMPTY_TARGET_DRAFT });
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [libraryIssue, setLibraryIssue] = useState<"invalid" | "unavailable" | null>(null);
  const [draftIssue, setDraftIssue] = useState<"invalid" | "unavailable" | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<TargetStep>(0);
  const [furthest, setFurthest] = useState(0);
  const [savedContent, setSavedContent] = useState("");
  const [saveError, setSaveError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [copied, setCopied] = useState("");
  const [pendingRestore, setPendingRestore] = useState<ReturnType<typeof readTargetDraft> | null>(
    null,
  );
  const savedRaw = useRef<string | null>(null);
  const damagedRaw = useRef<string | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const generation = useRef(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const content = JSON.stringify(draft);
  const unsaved = ready && content !== savedContent;
  const blocker = useBlocker({
    shouldBlockFn: () => unsaved,
    enableBeforeUnload: unsaved,
    withResolver: true,
  });
  const invalidatePendingWork = useCallback(() => {
    generation.current++;
    revision.current++;
  }, []);

  const loadLibrary = useCallback(() => {
    const result = readTargetLibrary();
    if (result.issue === null || result.entries.length > 0) setEntries(result.entries);
    setLibraryIssue(result.issue);
    generation.current++;
    setBusy(false);
    setPrepared(false);
    setStatus("");
    setIssues([]);
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadLibrary();
    const snapshot = readTargetDraft();
    const initial = snapshot.draft ?? { ...EMPTY_TARGET_DRAFT };
    setDraft(initial);
    setSavedContent(JSON.stringify(initial));
    savedRaw.current = snapshot.raw;
    damagedRaw.current = snapshot.issue === "invalid" ? snapshot.raw : null;
    setDraftIssue(snapshot.issue);
    setReady(true);
    return () => {
      mounted.current = false;
      invalidatePendingWork();
    };
  }, [loadLibrary, invalidatePendingWork]);

  const saveDraft = useCallback(() => {
    if (!ready || draftIssue) return;
    try {
      savedRaw.current = writeTargetDraft(draft, savedRaw.current);
      setSavedContent(JSON.stringify(draft));
      setSaveError("");
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Your answers could not be saved in this browser.",
      );
    }
  }, [draft, draftIssue, ready]);
  useEffect(() => {
    if (unsaved && !draftIssue) saveDraft();
  }, [unsaved, draftIssue, saveDraft]);
  useEffect(() => {
    if (ready) stepHeading.current?.focus();
  }, [step, ready]);
  useEffect(() => {
    if (issues.length) errorSummary.current?.focus();
  }, [issues]);

  const change = <K extends keyof TargetDraft>(key: K, value: TargetDraft[K]) => {
    revision.current++;
    generation.current++;
    setDraft((current) => ({ ...current, [key]: value }));
    setBusy(false);
    setPrepared(false);
    setStatus("");
    setCopyStatus("");
    setCopied("");
    setIssues([]);
  };
  const selected = entries.find((entry) => entry.id === draft.designId);
  const allIssues = targetStepIssues(draft, 3, entries);
  const prompts = selected && allIssues.length === 0 ? targetPrompts(draft, selected) : [];
  const next = () => {
    const problems = targetStepIssues(draft, step, entries);
    if (step === 0 && libraryIssue === "unavailable")
      problems.unshift("Reload your saved designs before continuing.");
    setIssues(problems);
    if (problems.length || step === 3) return;
    const nextStep = (step + 1) as TargetStep;
    setStep(nextStep);
    setFurthest((current) => Math.max(current, nextStep));
  };
  const downloadAnswers = (original = false) => {
    try {
      if (!original && readTargetDraft({ getItem: () => JSON.stringify(draft) }).issue)
        throw new Error(
          "Remove sensitive links or unreadable text before downloading these answers.",
        );
      downloadBlob(
        new Blob([original ? (damagedRaw.current ?? "") : JSON.stringify(draft, null, 2)], {
          type: "text/plain;charset=utf-8",
        }),
        original ? "target-draft-recovery.txt" : "target-answers.json",
      );
      setStatus(
        "Answers download started. Check your downloads; the saved draft has not been replaced.",
      );
    } catch (cause) {
      setStatus("");
      setIssues([
        cause instanceof Error
          ? cause.message
          : "The answers download could not be started. Your answers remain in this tab.",
      ]);
    }
  };
  const restoreDraft = (snapshot: ReturnType<typeof readTargetDraft>) => {
    revision.current++;
    generation.current++;
    const restored = snapshot.draft ?? { ...EMPTY_TARGET_DRAFT };
    setDraft(restored);
    savedRaw.current = snapshot.raw;
    setSavedContent(JSON.stringify(restored));
    damagedRaw.current = null;
    setDraftIssue(null);
    setSaveError("");
    setPendingRestore(null);
    setBusy(false);
    setPrepared(false);
    setStep(0);
    setFurthest(0);
    setIssues([]);
    setStatus("Saved answers loaded. No changes have been applied to your project.");
  };
  const reloadDraft = () => {
    const snapshot = readTargetDraft();
    if (snapshot.issue) {
      setDraftIssue(snapshot.issue);
      if (snapshot.issue === "invalid") {
        // An explicit reread acknowledges this exact damaged copy without replacing it.
        // Saving stays paused; the current in-tab answers may still prepare a trial.
        damagedRaw.current = snapshot.raw;
        savedRaw.current = snapshot.raw;
        invalidatePendingWork();
        setBusy(false);
        setPrepared(false);
        setStatus("");
      }
      return;
    }
    if (unsaved) setPendingRestore(snapshot);
    else restoreDraft(snapshot);
  };
  const copyPrompt = async (id: string, text: string) => {
    const current = revision.current;
    try {
      await navigator.clipboard.writeText(text);
      if (mounted.current && revision.current === current) {
        setCopied(id);
        setCopyStatus("Prompt copied. Paste it into your own developer tool when you are ready.");
      }
    } catch {
      if (mounted.current && revision.current === current) {
        setCopied("");
        setCopyStatus(
          "Could not copy automatically. Select the prompt text below and copy it yourself.",
        );
      }
    }
  };
  const prepare = async () => {
    const problems = targetStepIssues(draft, 3, entries);
    if (!selected || problems.length) {
      setIssues(problems);
      return;
    }
    const job = ++generation.current;
    const draftRevision = revision.current;
    const selectedSnapshot = JSON.stringify(selected);
    const draftSnapshot = { ...draft };
    setBusy(true);
    setPrepared(false);
    setStatus("");
    setIssues([]);
    try {
      const owner = getBrowserOwnerId();
      const verifySources = () => {
        if (getBrowserOwnerId() !== owner)
          throw new Error("Your account changed. Reload before preparing another handoff.");
        const currentLibrary = readTargetLibrary();
        if (currentLibrary.issue === "unavailable")
          throw new Error(
            "Your saved designs could not be rechecked. Reload designs before preparing the handoff.",
          );
        const currentEntry = currentLibrary.entries.find(
          (entry) => entry.id === draftSnapshot.designId,
        );
        if (!currentEntry || JSON.stringify(currentEntry) !== selectedSnapshot)
          throw new Error(
            "The selected saved design changed or could not be read. Reload designs and review the plan before preparing it again.",
          );
        const currentDraft = readTargetDraft();
        if (currentDraft.issue === "unavailable")
          throw new Error(
            "Your session or saved answers could not be rechecked. Keep this tab open and retry after access is restored.",
          );
        if (currentDraft.raw !== savedRaw.current)
          throw new Error(
            "Saved Target answers changed in another tab. Reload the saved answers or keep a copy of your current answers before retrying.",
          );
      };
      verifySources();
      const blob = await prepareTargetPack(draftSnapshot, selected);
      if (!mounted.current || generation.current !== job || revision.current !== draftRevision)
        return;
      verifySources();
      downloadBlob(
        blob,
        draftSnapshot.integration === "existing"
          ? "focus-target-existing-site-pack.zip"
          : "focus-target-new-project-pack.zip",
      );
      setPrepared(true);
      setStatus(
        "Download started. Check your downloads and open START-HERE.md. No changes have been applied to your project.",
      );
    } catch (cause) {
      if (mounted.current && generation.current === job) {
        setIssues([
          cause instanceof Error
            ? cause.message
            : "The handoff could not be prepared. Your answers are unchanged; please try again.",
        ]);
      }
    } finally {
      if (mounted.current && generation.current === job) setBusy(false);
    }
  };

  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-6 border-b border-border pb-8">
          <div className="max-w-2xl flex-1 basis-80">
            <p className="eyebrow">A useful change. A careful first step.</p>
            <h1 className="mt-2 font-display text-5xl">Target</h1>
            <p className="mt-4 text-lg leading-relaxed">
              Turn your saved Vision into a practical first trial.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Choose one improvement, protect what already works, and prepare the files and prompts
              your developer needs. Target prepares a handoff; you or your developer apply it in
              your own project.
            </p>
          </div>
          <BrandLogo variant="target" decorative />
        </header>

        {!ready ? (
          <p role="status" className="py-8">
            Loading your saved designs and answers…
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="font-medium">No changes applied to your app or website</p>
              <p className="text-muted-foreground">
                {draftIssue || saveError
                  ? "Answers are kept in this tab"
                  : unsaved
                    ? "Saving your answers…"
                    : savedRaw.current === null
                      ? "Answers save here as you go"
                      : "Answers saved in this browser"}
              </p>
            </div>
            {(draftIssue || saveError) && (
              <section
                className="mt-4 rounded-xl border border-destructive/40 bg-card p-4"
                aria-label="Keep your answers"
              >
                <p role="alert" className="text-sm">
                  {draftIssue === "invalid"
                    ? "Your saved Target draft contains unreadable data. That original copy has not been changed. You can prepare a trial in this tab without replacing it."
                    : draftIssue === "unavailable"
                      ? "Saved Target answers could not be read. You can continue in this tab; saving is paused so an existing draft is not overwritten."
                      : saveError}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Keep a downloaded copy of your answers before leaving if saving is unavailable.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => downloadAnswers()}>
                    Download these answers
                  </Button>
                  {damagedRaw.current !== null && (
                    <Button variant="outline" onClick={() => downloadAnswers(true)}>
                      Download original for recovery
                    </Button>
                  )}
                  {!draftIssue && (
                    <Button variant="outline" onClick={saveDraft}>
                      Retry saving
                    </Button>
                  )}
                  <Button variant="outline" onClick={reloadDraft}>
                    Reload saved answers
                  </Button>
                </div>
              </section>
            )}

            <nav aria-label="Target preparation steps" className="my-7">
              <ol className="grid gap-2 sm:grid-cols-4">
                {STEPS.map((label, index) => (
                  <li key={label}>
                    <button
                      type="button"
                      className={`w-full rounded-md border px-3 py-3 text-left text-sm ${step === index ? "border-primary bg-primary/5 font-semibold" : "border-border text-muted-foreground"} disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                      disabled={index > furthest}
                      aria-current={step === index ? "step" : undefined}
                      onClick={() => {
                        setStep(index as TargetStep);
                        setIssues([]);
                      }}
                    >
                      <span className="mr-2 tabular-nums">{index + 1}.</span>
                      {label}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <section
                className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-7"
                aria-labelledby="target-step-heading"
              >
                <p className="eyebrow">Step {step + 1} of 4</p>
                <h2
                  id="target-step-heading"
                  tabIndex={-1}
                  ref={stepHeading}
                  className="mt-2 font-display text-3xl outline-none"
                >
                  {STEPS[step]}
                </h2>
                {issues.length > 0 && (
                  <div
                    ref={errorSummary}
                    tabIndex={-1}
                    role="alert"
                    className="mt-5 rounded-md border border-destructive/40 p-4 outline-none"
                  >
                    <p className="font-medium">A little more detail is needed</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {step === 0 && (
                  <div className="mt-6 space-y-6">
                    {libraryIssue && (
                      <div className="rounded-md border border-border p-4">
                        <p role="alert" className="text-sm">
                          {libraryIssue === "invalid"
                            ? "Some saved designs could not be read. The original library is unchanged. Recovered or previously readable designs are shown and will be rechecked before preparing a handoff; the list may be incomplete."
                            : "Your saved designs could not be read. Any designs still shown are the last readable copy. Reload before preparing a handoff."}
                        </p>
                        <Button variant="outline" className="mt-3" onClick={loadLibrary}>
                          <RefreshCw />
                          Reload designs
                        </Button>
                      </div>
                    )}
                    <div>
                      <label htmlFor="target-design" className="font-medium">
                        Which saved Vision should guide this?
                      </label>
                      <select
                        id="target-design"
                        value={draft.designId}
                        className={fieldClass}
                        onChange={(event) => change("designId", event.target.value)}
                        required
                      >
                        <option value="">Choose a saved design</option>
                        {entries.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.title}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A Vision is the set of design choices you saved in Focus. Target uses that
                        design's real values.
                      </p>
                      {entries.length === 0 && !libraryIssue && (
                        <p className="mt-3 text-sm">
                          No saved designs are available yet.{" "}
                          <Link to="/" className="underline underline-offset-4">
                            Create a Vision
                          </Link>
                          , save it, then return here.
                        </p>
                      )}
                      <Link
                        to="/library"
                        className="mt-2 inline-block text-sm underline underline-offset-4"
                      >
                        Open My designs
                      </Link>
                      {!libraryIssue && (
                        <Button variant="outline" className="ml-3 mt-2" onClick={loadLibrary}>
                          <RefreshCw />
                          Reload designs
                        </Button>
                      )}
                    </div>
                    <fieldset className="space-y-3">
                      <legend className="mb-2 font-medium">What are you working on?</legend>
                      {(
                        [
                          [
                            "existing",
                            "Restyle an existing app or website",
                            "Keep the working content, features and customer data unchanged.",
                          ],
                          [
                            "new",
                            "Start a separate new project",
                            "Prepare a design specification, not a finished working app.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label
                          key={value}
                          className="flex items-start gap-3 rounded-lg border border-border p-3"
                        >
                          <input
                            type="radio"
                            name="target-integration"
                            checked={draft.integration === value}
                            value={value}
                            onChange={() => change("integration", value)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-medium">{label}</span>
                            <span className="mt-1 block text-sm text-muted-foreground">{hint}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <div>
                      <label htmlFor="target-platform" className="font-medium">
                        Where is the project built?
                      </label>
                      <select
                        id="target-platform"
                        className={fieldClass}
                        value={draft.platform}
                        onChange={(event) =>
                          change("platform", event.target.value as TargetDraft["platform"])
                        }
                      >
                        {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {draft.platform === "react"
                          ? "The first supported path is a React or Next.js project in GitHub. A developer uses the prompts in your own repository; Target is not connected to GitHub."
                          : draft.platform === "choose"
                            ? "The first prompt helps your developer identify the platform before making changes."
                            : "These are preparation prompts. Your developer must inspect the actual project and choose a compatible isolated preview before applying them."}
                      </p>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="mt-6 space-y-6">
                    <p className="text-muted-foreground">
                      A small, specific trial is easier to compare, test and undo. Describe the
                      intended result in your own words.
                    </p>
                    <div>
                      <label htmlFor="target-page" className="font-medium">
                        Which page or screen will you start with?
                      </label>
                      <Input
                        id="target-page"
                        className="mt-2"
                        value={draft.page}
                        maxLength={TARGET_LIMITS.page}
                        onChange={(event) => change("page", event.target.value)}
                        placeholder="For example: the appointment booking page"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="target-improvement" className="font-medium">
                        What should look or feel clearer?
                      </label>
                      <textarea
                        id="target-improvement"
                        className={fieldClass}
                        rows={3}
                        value={draft.improvement}
                        maxLength={TARGET_LIMITS.improvement}
                        onChange={(event) => change("improvement", event.target.value)}
                        placeholder="For example: make the available times easier to scan without changing how booking works."
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="target-tasks" className="font-medium">
                        What must keep working?
                      </label>
                      <textarea
                        id="target-tasks"
                        className={fieldClass}
                        rows={4}
                        value={draft.tasks}
                        maxLength={TARGET_LIMITS.tasks}
                        onChange={(event) => change("tasks", event.target.value)}
                        placeholder="List the important journeys, such as choosing a time, correcting an error and receiving a booking confirmation."
                        required
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Include sign-in, payments or private workflows if the page uses them. These
                        are tasks to test later, not a claim that they already passed.
                      </p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="mt-6 space-y-6">
                    <p className="text-muted-foreground">
                      Make the trial somewhere separate from the live app. If you do not know an
                      answer, ask your developer to help before continuing.
                    </p>
                    <div>
                      <label htmlFor="target-backup" className="font-medium">
                        {draft.integration === "existing"
                          ? "Where is the protected copy of today's work?"
                          : "Where will the separate new project live?"}
                      </label>
                      <textarea
                        id="target-backup"
                        className={fieldClass}
                        rows={3}
                        value={draft.backup}
                        maxLength={TARGET_LIMITS.backup}
                        onChange={(event) => change("backup", event.target.value)}
                        required
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        {draft.integration === "existing"
                          ? "A backup is a copy you can restore. Name the saved revision or duplicate and say how unfinished work will be kept. A branch is a separate line of work in your repository."
                          : "Name a new, empty folder or repository. Never unpack a new-project kit over a working project or its rules."}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="target-preview" className="font-medium">
                        Where will the isolated trial run?
                      </label>
                      <textarea
                        id="target-preview"
                        className={fieldClass}
                        rows={3}
                        value={draft.preview}
                        maxLength={TARGET_LIMITS.preview}
                        onChange={(event) => change("preview", event.target.value)}
                        placeholder="Name the separate branch or copy and the local or staging preview. Use test data and sandbox services."
                        required
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        A staging preview is a test copy. It must not send real messages, charge
                        customers or write to production data. You can describe a local preview; no
                        public URL is required.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="target-rollback" className="font-medium">
                        How will you undo only this trial?
                      </label>
                      <textarea
                        id="target-rollback"
                        className={fieldClass}
                        rows={3}
                        value={draft.rollback}
                        maxLength={TARGET_LIMITS.rollback}
                        onChange={(event) => change("rollback", event.target.value)}
                        placeholder="For example: remove only the trial stylesheet imports and restore only the styling changes from the protected revision."
                        required
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Rollback means reversing this change while keeping everyone else's later
                        work. Your developer will demonstrate it in the preview before release.
                      </p>
                    </div>
                    <p className="rounded-md bg-secondary p-3 text-sm">
                      Use names and ordinary descriptions only. Do not enter passwords, access
                      tokens, private customer records or other secrets.
                    </p>
                  </div>
                )}

                {step === 3 && (
                  <div className="mt-6 space-y-6">
                    <div>
                      <p className="font-medium">
                        {prepared
                          ? "Prepared for a trial"
                          : "Review the plan before preparing your ZIP"}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {draft.integration === "existing"
                          ? "Your ZIP contains the selected design, scoped styling values, preservation instructions and rollback guidance. It does not contain a replacement app or apply changes to your repository."
                          : "Your ZIP is a design specification and starter styling for a new, empty project. It is not a finished app; behavior, data, accessibility and deployment still need implementation and testing."}
                      </p>
                    </div>
                    <dl className="space-y-4 border-y border-border py-5 text-sm">
                      {[
                        ["Trial page", draft.page],
                        ["Visible improvement", draft.improvement],
                        ["Keep working", draft.tasks],
                        ["Protected starting point", draft.backup],
                        ["Isolated preview", draft.preview],
                        ["Selective rollback", draft.rollback],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="font-medium">{label}</dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {allIssues.length > 0 && (
                      <p className="text-sm text-destructive">
                        Some answers are missing or need correction. Go back to complete them before
                        preparing the handoff.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => void prepare()}
                        disabled={busy || allIssues.length > 0 || libraryIssue === "unavailable"}
                      >
                        <Download />
                        {busy ? "Preparing your handoff…" : "Prepare and download trial ZIP"}
                      </Button>
                      {busy && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            generation.current++;
                            setBusy(false);
                            setStatus("Preparation cancelled. No changes have been applied.");
                          }}
                        >
                          Cancel preparation
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      After downloading, open START-HERE.md. Give the prompts below to your
                      developer one at a time. Keep each result for review before moving on.
                    </p>
                    <section aria-labelledby="target-prompts-heading">
                      <h3 id="target-prompts-heading" className="font-display text-2xl">
                        Your next conversations
                      </h3>
                      <ol className="mt-4 space-y-3">
                        {prompts.map((prompt, index) => (
                          <li key={prompt.id}>
                            <details
                              className="rounded-lg border border-border p-4"
                              open={index === 0}
                            >
                              <summary className="cursor-pointer font-medium">
                                {index + 1}. {prompt.title}
                              </summary>
                              <textarea
                                aria-label={`${prompt.title} prompt`}
                                readOnly
                                value={prompt.text}
                                rows={8}
                                className={`${fieldClass} text-sm`}
                              />
                              <Button
                                variant="outline"
                                className="mt-3"
                                onClick={() => void copyPrompt(prompt.id, prompt.text)}
                              >
                                {copied === prompt.id ? <Check /> : <Copy />}
                                {copied === prompt.id ? "Copied" : "Copy prompt"}
                              </Button>
                            </details>
                          </li>
                        ))}
                      </ol>
                      {copyStatus && (
                        <p role="status" className="mt-3 text-sm">
                          {copyStatus}
                        </p>
                      )}
                    </section>
                  </div>
                )}

                {status && (
                  <p role="status" className="mt-5 rounded-md bg-secondary p-3 text-sm">
                    {status}
                  </p>
                )}
                <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-5">
                  {step > 0 ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep((step - 1) as TargetStep);
                        setIssues([]);
                      }}
                    >
                      <ArrowLeft />
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < 3 && (
                    <Button onClick={next}>
                      Continue
                      <ArrowRight />
                    </Button>
                  )}
                </div>
              </section>

              <aside
                className="space-y-5 rounded-xl border border-border p-5"
                aria-label="Your trial at a glance"
              >
                <p className="eyebrow">Your trial</p>
                <p className="font-display text-2xl break-words">
                  {selected?.title || "Choose your Vision"}
                </p>
                {selected && (
                  <div
                    className="flex overflow-hidden rounded-md border border-border"
                    aria-label="Selected design palette"
                  >
                    {[
                      selected.state.tokens.bg,
                      selected.state.tokens.surface,
                      selected.state.tokens.ink,
                      selected.state.tokens.accent,
                    ].map((color, index) => (
                      <span
                        key={index}
                        className="h-9 flex-1"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                )}
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Project</dt>
                    <dd>
                      {draft.integration === "existing"
                        ? "Existing app or website"
                        : "Separate new project"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Platform</dt>
                    <dd>{PLATFORM_LABELS[draft.platform]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{prepared ? "Prepared for a trial" : "Preparing the plan"}</dd>
                  </div>
                </dl>
                <p className="border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                  A prepared handoff is the beginning of a test. It does not verify the build,
                  approve a release or change your launch history.
                </p>
              </aside>
            </div>
          </>
        )}
      </main>
      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
        title="Leave with unsaved Target answers?"
        body="These answers have not been saved in this browser. Stay and download a copy, or leave without keeping the unsaved changes."
        confirmLabel="Leave without saving"
        onConfirm={() => {
          if (blocker.status === "blocked") blocker.proceed();
        }}
      />
      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestore(null);
        }}
        title="Load the saved answers instead?"
        body="This replaces the unsaved answers in this tab. Download them first if you want to keep both versions. The saved copy itself will not be changed."
        confirmLabel="Load saved answers"
        onConfirm={() => {
          if (pendingRestore) restoreDraft(pendingRestore);
        }}
      />
    </div>
  );
}
