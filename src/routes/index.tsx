import { focusLocalStorage, focusSessionStorage } from "@/lib/browser-storage";
import { EMPTY, isEmptyStudioDraft, migrate, snap, type State } from "@/lib/studio-state";
import { GardenHome } from "@/components/GardenHome";
import { parseGardenSearch } from "@/lib/garden-navigation";
import type { StratosphereGroupId } from "@/lib/stratosphere";
import { StratospherePanel, StratosphereStart } from "@/components/StratospherePanel";
import { readGardenPreferences } from "@/lib/garden-preferences";
import { archiveStudioDraft, useStudioDraft } from "@/hooks/useStudioDraft";
import { useStudioNavigationGuard } from "@/hooks/useStudioNavigationGuard";
import {
  keepStudioCheckpoint,
  readStudioRecoveries,
  restoreStudioSave,
  studioHistoryNeedsRecovery,
} from "@/lib/studio-recovery";
import { Redo2, Undo2 } from "lucide-react";
import { Journey } from "@/components/Journey";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { saveProject, STUDIO_KEY } from "@/lib/projects";
import { downloadBlob } from "@/lib/exportPack";
import { useUser } from "@/hooks/useSession";
import { useCallback, useEffect, useRef, useState } from "react";
import { isDesignStep, record, redo as redoStep, undo as undoStep } from "@/lib/undo";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HelpTip } from "@/components/Help";
import { useLeaveGuard } from "@/hooks/useUx";
import {
  accountSaveResult,
  hasBrowserOnlyImage,
  hasUnsavedWork,
  isTypingTarget,
  workHash,
} from "@/lib/ux";
import { toast } from "sonner";
import { readExamOptionDraft } from "@/lib/exam-option-draft";
import { takeLibraryOpenId } from "@/lib/library-open";
import { openLibraryDesign, readLibrarySnapshot } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { questionCount, type Integration } from "@/lib/design";
import { Brief, Directions } from "./-studio/StartDesign";
import { Exam } from "./-studio/Exam";
import { Vision } from "./-studio/Vision";
import type { StudioStageProps } from "./-studio/stage";
import { socialHead } from "./-social-head";

export const Route = createFileRoute("/")({
  validateSearch: parseGardenSearch,
  head: () =>
    socialHead({
      title: "Focus — your point of view, by design",
      description:
        "Find a design direction, make it yours, and export a precise design spec for your next build.",
      ogDescription: "Focus turns your taste, step by step, into a precise Vision for AI builders.",
      card: "summary_large_image",
    }),
  component: FocusHome,
});

function FocusHome() {
  const { view, panel, group, start } = Route.useSearch();
  return view === "studio" ? (
    <Studio workshop={panel === "stratosphere"} requestedGroup={group} gardenStart={start} />
  ) : (
    <GardenHome />
  );
}

function hasLocalOnlyDraft(state: State): boolean {
  if (!state.tokens || !state.content || !state.libraryId) return !isEmptyStudioDraft(state);
  // Generated options are intentionally omitted from library copies. Only a choice the
  // user has actually edited carries draft metadata.
  return Object.values(state.cache).some((options) =>
    options.some((option) => readExamOptionDraft(option.draft)),
  );
}

const KEY = STUDIO_KEY;

function Studio({
  workshop = false,
  requestedGroup,
  gardenStart,
}: {
  gardenStart?: Integration | undefined;
  workshop?: boolean;
  requestedGroup?: StratosphereGroupId | undefined;
}) {
  const {
    state: s,
    setState: setS,
    restoreState,
    flush,
    issue: persistenceIssue,
  } = useStudioDraft();
  const [loaded, setLoaded] = useState(false);
  const [recoveryError, setRecoveryError] = useState<{
    raw: string | null;
    message: string;
  } | null>(null);
  const [recoveries, setRecoveries] = useState<{ key: string; raw: string }[]>([]);
  const [handoffIssue, setHandoffIssue] = useState("");
  const startingSeparateDraft = useRef(false);
  const [gardenStartIssue, setGardenStartIssue] = useState("");
  const restored = useRef(false);
  const keepDraftCopy = useCallback((raw: string) => {
    const copyKey = `${KEY}:recovery:${new Date().toISOString()}:${crypto.randomUUID()}`;
    keepStudioCheckpoint(focusLocalStorage, copyKey, raw);
    setRecoveries((copies) => [{ key: copyKey, raw }, ...copies]);
  }, []);
  const restore = useCallback(() => {
    setRecoveryError(null);
    setHandoffIssue("");
    try {
      const original = focusLocalStorage.getItem(KEY);
      const result = restoreStudioSave(
        focusLocalStorage,
        KEY,
        (raw) => {
          const value = JSON.parse(raw);
          // Repair only timeline containers here. The original raw save is
          // checked separately and retained before this migrated state is saved.
          // Other entry points still require the strict state contract.
          return migrate(
            value && typeof value === "object" && !Array.isArray(value)
              ? {
                  ...value,
                  past: Array.isArray(value.past) ? value.past : [],
                  future: Array.isArray(value.future) ? value.future : [],
                }
              : value,
          );
        },
        { ...EMPTY, integration: readGardenPreferences(focusLocalStorage).value.goal },
        `${KEY}:recovery:${new Date().toISOString()}:${crypto.randomUUID()}`,
        (raw) => studioHistoryNeedsRecovery(JSON.parse(raw)),
      );
      if (result.status === "blocked") {
        setRecoveryError(result);
        return;
      }
      // Recovered originals stay available on later visits, including after new work is saved.
      const savedCopies = readStudioRecoveries(focusLocalStorage, KEY);
      setRecoveries(savedCopies);
      const prior = { ...result.state };
      if (gardenStart && isEmptyStudioDraft(prior)) prior.integration = gardenStart;
      if (prior.tokens && prior.content && !prior.libraryId) prior.libraryId = crypto.randomUUID();
      try {
        restoreState(prior, original);
      } catch {
        setRecoveryError({
          raw: focusLocalStorage.getItem(KEY),
          message:
            "This browser cannot save your work right now. Download any existing data below, free some browser storage, then try again.",
        });
        return;
      }
      // A failed archive or pending hand-off must not disable autosave for a valid current design.
      try {
        const libraryId = takeLibraryOpenId(window.history.state?.focusLibraryOpen);
        const pending = libraryId ? null : focusSessionStorage.getItem("refraction:pending-rescue");
        if (libraryId || pending) {
          let next: State;
          if (libraryId) {
            const library = readLibrarySnapshot();
            const selected = library.entries.find((entry) => entry.id === libraryId);
            if (!selected || library.needsRecovery) throw new Error("Saved design needs review.");
            next = openLibraryDesign(selected);
          } else {
            next = migrate(JSON.parse(pending!));
          }
          if (next.tokens && !next.libraryId) next.libraryId = crypto.randomUUID();
          const previousDraft = JSON.stringify(prior);
          const needsCopy = hasLocalOnlyDraft(prior) && JSON.stringify(next) !== previousDraft;
          const originalDraft = original ?? previousDraft;
          if (
            needsCopy &&
            !result.recoveryKey &&
            !savedCopies.some((copy) => copy.raw === originalDraft)
          )
            keepDraftCopy(originalDraft);
          archiveStudioDraft(prior);
          restoreState(next, previousDraft);
          if (pending) focusSessionStorage.removeItem("refraction:pending-rescue");
          if (prior.tokens || needsCopy)
            toast("Opened redesign", {
              duration: 15000,
              action: { label: "Undo", onClick: () => setS(prior) },
            });
        }
      } catch {
        setHandoffIssue(
          "The selected design could not be opened safely. Your current work is still available. Return to its source and try opening the design again.",
        );
      }
      setLoaded(true);
    } catch {
      setRecoveryError({
        raw: null,
        message:
          "This browser is not allowing access to saved designs. Allow site storage, then try again.",
      });
    }
  }, [gardenStart, restoreState, setS, keepDraftCopy]);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    restore();
  }, [restore]);
  // Every design step (answer, question change, stage) is recorded so Undo works across questions and reloads.
  const update = (p: Partial<State>) =>
    setS((o) => {
      const n = { ...o, ...p };
      if (!("past" in p) && isDesignStep(o, n)) {
        const t = record({ past: o.past, future: o.future }, snap(o));
        return { ...n, ...t };
      }
      return n;
    });
  const stepBack = useCallback(
    (dir: "undo" | "redo") =>
      setS((o) => {
        const r = (dir === "undo" ? undoStep : redoStep)(
          { past: o.past, future: o.future },
          snap(o),
        );
        if (!r) return o;
        toast(dir === "undo" ? "Undid the last step" : "Redid the step", { duration: 2500 });
        // Options contain complete token snapshots; a restored design needs fresh options.
        return { ...o, ...r.state, cache: {}, ...r.t };
      }),
    [setS],
  );
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z")
        return;
      e.preventDefault();
      stepBack(e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [stepBack]);
  const user = useUser();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const { cache: _c, ...rest } = s; // generated options are not worth storing
      const id = await saveProject(s.projectId, s.content?.brand ?? s.brief.slice(0, 60), {
        ...rest,
        cache: {},
      });
      setS((current) => accountSaveResult(current, s, id));
      toast.success(
        hasBrowserOnlyImage(s)
          ? "Design saved to your account. Images stay in this browser; the page ZIP keeps a copy."
          : "Saved to your account",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const [ask, setAsk] = useState<null | "new" | "retake">(null);
  const dirty = hasUnsavedWork(s);
  useLeaveGuard(saving);
  useStudioNavigationGuard({ flush, busy: saving });
  const reset = (k: "new" | "retake", mode = EMPTY.integration) =>
    setS((o) =>
      k === "new"
        ? { ...EMPTY, integration: mode, ...record(o, snap(o)) }
        : {
            ...o,
            past: [...o.past, snap(o)].slice(-30),
            future: [],
            stage: "exam",
            stepIndex: 0,
            picks: [],
            history: [],
            cache: {},
            recheck: [],
          },
    );
  const requestReset = (k: "new" | "retake") => {
    if (hasUnsavedWork(s)) setAsk(k);
    else reset(k);
  };
  const downloadRecovery = (raw: string, filename = "focus-saved-data-recovery.txt") =>
    downloadBlob(new Blob([raw], { type: "text/plain;charset=utf-8" }), filename);
  if (!loaded)
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-16" aria-busy={!recoveryError}>
          <h1 className="font-display text-3xl">
            {recoveryError ? "Let's protect your saved work" : "Opening your workspace…"}
          </h1>
          {recoveryError && (
            <div className="mt-6 space-y-5" role="alert">
              <p>{recoveryError.message}</p>
              <div className="flex flex-wrap gap-3">
                {recoveryError.raw !== null && (
                  <Button variant="outline" onClick={() => downloadRecovery(recoveryError.raw!)}>
                    Download original saved data
                  </Button>
                )}
                <Button onClick={restore}>Try again</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Creation will reopen when this browser can preserve your work.
              </p>
            </div>
          )}
        </main>
      </div>
    );
  if (gardenStart && s.integration !== gardenStart) {
    const nextProject =
      gardenStart === "new" ? "a new app or website" : "an existing app or website";
    const savedName = s.content?.brand || s.brief || "Untitled design";
    const startSeparately = () => {
      if (startingSeparateDraft.current) return;
      startingSeparateDraft.current = true;
      try {
        const raw = JSON.stringify(s);
        if (focusLocalStorage.getItem(KEY) !== raw) {
          startingSeparateDraft.current = false;
          setGardenStartIssue(
            "Your saved draft changed in another tab. Resume saved work to open the latest version.",
          );
          return;
        }
        keepDraftCopy(raw);
        reset("new", gardenStart);
      } catch {
        startingSeparateDraft.current = false;
        setGardenStartIssue(
          "Focus couldn’t confirm a backup of your current draft. Resume your saved work or reload to see the latest copy.",
        );
      }
    };
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main id="main-content" className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="font-display text-3xl">You have a saved draft</h1>
          <p className="mt-4 break-words">
            Your studio has “{savedName.slice(0, 120)}”. You chose {nextProject} in the Garden.
          </p>
          <p className="mt-3 text-muted-foreground">
            Keep working on this draft, or start another. Starting another keeps a backup in this
            browser and adds an Undo step.
          </p>
          {gardenStartIssue && (
            <p role="alert" className="mt-3 text-destructive">
              {gardenStartIssue}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={startSeparately}>Start a separate draft</Button>
            <Button variant="outline" asChild>
              <Link to="/" search={{ view: "studio" }} reloadDocument replace>
                Resume saved work
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      {gardenStart && <Navigate to="/" search={{ view: "studio" }} replace resetScroll={false} />}
      <AppHeader>
        {(s.stage !== "brief" ||
          (workshop && s.tokens) ||
          s.past.length > 0 ||
          s.future.length > 0) && (
          <>
            <div className="flex items-center gap-4">
              {workshop ? (
                <span className="eyebrow">Stratosphere</span>
              ) : (
                <Progress stage={s.stage} step={s.stepIndex} total={questionCount(s.quick)} />
              )}
              {s.aiCalls > 0 && (
                <HelpTip tip="Each AI step uses a small amount of credit.">
                  <span tabIndex={0} className="eyebrow">
                    {s.aiCalls} AI {s.aiCalls === 1 ? "step" : "steps"} used
                  </span>
                </HelpTip>
              )}
              {dirty && !persistenceIssue && <span className="eyebrow">Browser draft</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!s.past.length}
                  onClick={() => stepBack("undo")}
                  title="Undo the last step (Ctrl+Z)"
                >
                  <Undo2 />
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!s.future.length}
                  onClick={() => stepBack("redo")}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 />
                  Redo
                </Button>
              </>
              {user && s.content && (
                <Button variant="outline" size="sm" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : s.projectId ? "Save" : "Save to my account"}
                </Button>
              )}
              {(s.stage !== "brief" || (workshop && s.tokens)) && (
                <Button variant="ghost" size="sm" onClick={() => requestReset("new")}>
                  New design
                </Button>
              )}
            </div>
          </>
        )}
      </AppHeader>
      {(recoveries.length > 0 || persistenceIssue || handoffIssue) && (
        <aside className="mx-auto max-w-7xl space-y-4 px-6 py-5">
          {persistenceIssue && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/5 p-4"
            >
              <p>{persistenceIssue}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadRecovery(JSON.stringify(s, null, 2), "focus-current-work-recovery.json")
                  }
                >
                  Download current work
                </Button>
                <Button variant="outline" size="sm" onClick={flush}>
                  Retry saving
                </Button>
              </div>
            </div>
          )}
          {handoffIssue && (
            <p role="alert" className="rounded-xl border p-4">
              {handoffIssue}
            </p>
          )}
          {recoveries.length > 0 && (
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-medium">
                Original saved data preserved ({recoveries.length})
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">
                These earlier workspace copies are kept in this browser. You can download one for
                recovery.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {recoveries.map((copy, i) => (
                  <Button
                    key={copy.key}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadRecovery(copy.raw, `focus-saved-data-recovery-${i + 1}.txt`)
                    }
                  >
                    Download preserved data {i + 1}
                  </Button>
                ))}
              </div>
            </details>
          )}
        </aside>
      )}
      <ConfirmDialog
        open={!!ask}
        onOpenChange={(o) => !o && setAsk(null)}
        title={ask === "new" ? "Start a new design?" : "Answer the eight questions again?"}
        body={`Your ${s.picks.length} answer${s.picks.length === 1 ? "" : "s"} for ${s.content?.brand ?? "this design"} ${s.picks.length === 1 ? "hasn't" : "haven't"} been saved or exported. ${ask === "new" ? "Starting over clears them." : "Answering again clears them and starts from question 1."}`}
        confirmLabel={ask === "new" ? "Clear and start new" : "Clear and answer again"}
        onConfirm={() => {
          if (ask) reset(ask);
          setAsk(null);
        }}
        extra={user ? { label: "Save first", onClick: () => void save() } : undefined}
      />
      {workshop ? (
        s.tokens && s.content ? (
          <StratospherePanel
            state={s}
            requestedGroup={requestedGroup}
            onChange={(patch) => update({ ...patch, cache: {} })}
            onExport={() => update({ savedHash: workHash(s) })}
          />
        ) : (
          <StratosphereStart />
        )
      ) : (
        <>
          {s.stage !== "brief" && <Journey current={s.stage === "rx" ? 2 : 1} />}
          {s.stage === "brief" && <Brief s={s} update={update} />}
          {s.stage === "directions" && <Directions s={s} update={update} />}
          {s.stage === "exam" && s.tokens && s.content && <Exam s={s} update={update} />}
          {s.stage === "review" && s.tokens && s.content && <Review s={s} update={update} />}
          {s.stage === "rx" && s.tokens && s.content && (
            <Vision s={s} update={update} ask={requestReset} />
          )}
        </>
      )}
    </div>
  );
}

function Review({ s, update }: StudioStageProps) {
  return (
    <ReviewAnswers
      tokens={s.tokens!}
      content={s.content!}
      picks={s.picks}
      quick={s.quick}
      onChange={(i) => update({ stage: "exam", stepIndex: i })}
      onCreate={() => update({ stage: "rx" })}
      onAnswerRest={(total) => update({ quick: false, stage: "exam", stepIndex: total })}
    />
  );
}

function Progress({ stage, step, total }: { stage: State["stage"]; step: number; total: number }) {
  const label =
    stage === "brief"
      ? "Brief"
      : stage === "directions"
        ? "Directions"
        : stage === "exam"
          ? `Question ${step + 1} of ${total}`
          : stage === "review"
            ? "Check your answers"
            : "Vision";
  return <span className="eyebrow">{label}</span>;
}
