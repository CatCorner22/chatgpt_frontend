import { focusLocalStorage, focusSessionStorage } from "@/lib/browser-storage";
import { DesignShareAction } from "@/components/DesignShareAction";
import { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";
import { EMPTY, migrate, snap, type State } from "@/lib/studio-state";
import { ContentEditor } from "@/components/ContentEditor";
import { StudioWelcome, StarterCollection } from "@/components/StudioWelcome";
import { IntegrationChoice } from "@/components/IntegrationChoice";
import { AI_SPENDING_ENABLED } from "@/lib/ai-policy";
import { hasCloudBackend } from "@/lib/runtime-config";
import { createLocalDirections, buildLocalOptions } from "@/lib/local-design";
import {
  readStudioRecoveries,
  restoreStudioSave,
  studioHistoryNeedsRecovery,
} from "@/lib/studio-recovery";
import { ArrowRight, Pencil, Redo2, Undo2 } from "lucide-react";
import { Journey } from "@/components/Journey";
import { BeforeAfter } from "@/components/BeforeAfter";
import { BadgePanel } from "@/components/BadgePanel";
import { LiveVisionPanel } from "@/components/LiveVisionPanel";
import { BrandLogo, CatMascot } from "@/components/BrandArt";
import { WaitLine } from "@/components/WaitLine";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { designId } from "@/lib/launch";
import { signDesignId } from "@/lib/signing.functions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { saveProject, createShare, STUDIO_KEY } from "@/lib/projects";
import { buildPack, downloadBlob, PackError, scopedTokensCss } from "@/lib/exportPack";
import { useUser } from "@/hooks/useSession";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { isDesignStep, record, redo as redoStep, undo as undoStep } from "@/lib/undo";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HelpTip, Term, WhyPopover } from "@/components/Help";
import { useCopied, useLeaveGuard, useWait } from "@/hooks/useUx";
import {
  CHECK_CARD,
  accountSaveResult,
  hasBrowserOnlyImage,
  hasUnsavedWork,
  isTypingTarget,
  workHash,
} from "@/lib/ux";
import { toast } from "sonner";
import { DesignPreview, PreviewFrame } from "@/components/DesignPreview";
import { NUDGES, applyNudges, type Nudge } from "@/lib/refine";
import { TASTE_KEY, parseTaste, rememberTaste, tasteText } from "@/lib/taste";
import { readProfile, profileText } from "@/lib/portrait";
import {
  archiveDesign,
  withVersion,
  readLibrary,
  resumeLabel,
  writeLibrary,
  type LibraryEntry,
  type LibraryState,
} from "@/lib/library";
import { NAV_PATTERNS } from "@/lib/nav";
import { ComponentSheet } from "@/components/ComponentSheet";
import type { OpenMode } from "@/components/QuickStart";
import { SkinBar } from "@/components/SkinBar";
import { LaunchPanel } from "@/components/LaunchPanel";
import type { GalleryItem } from "@/lib/gallery";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  STEPS,
  afterAnswer,
  questionCount,
  TOOLS,
  toolMessages,
  buildPrescription,
  tokensCss,
  type Tokens,
  type Integration,
} from "@/lib/design";
import { proposeDirections, proposeStep } from "@/lib/design.functions";
import {
  AUDIENCES,
  TONES,
  affectedSteps,
  fixContrast,
  measuredChecks,
  qualityGrade,
  rankOptions,
  type Purpose,
  GOALS,
  DEVICES,
  READING,
} from "@/lib/engine";
import { cardFor } from "@/lib/knowledge";
import { useDesignFonts } from "@/lib/useDesignFonts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Focus — your point of view, by design" },
      {
        name: "description",
        content:
          "Find a design direction, make it yours, and export a precise design spec for your next build.",
      },
      { property: "og:title", content: "Focus — your point of view, by design" },
      {
        property: "og:description",
        content: "Focus turns your taste, step by step, into a precise Vision for AI builders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

// Library backups and reopening a design retain its bounded Undo/Redo timeline.
// archiveDesign removes generated option caches before writing this state.
const libState = (state: State) => state as unknown as LibraryState;
const purposeText = (p: Purpose) =>
  [
    p.audience && `audience: ${p.audience}`,
    p.tone && `tone: ${p.tone}`,
    p.goal && `main visitor goal: ${p.goal}`,
    p.device && `visitors use: ${p.device}`,
    p.reading && `amount of text: ${p.reading}`,
    p.experience && `building: ${p.experience}`,
  ]
    .filter(Boolean)
    .join("; ");
const KEY = STUDIO_KEY;
const EXAMPLES = [
  "A neighborhood ceramics studio in Portland offering wheel classes and selling small-batch tableware.",
  "A bookkeeping service for independent tattoo artists who hate spreadsheets.",
  "A climate-tech startup that turns restaurant food waste into compost for city farms.",
];

function Studio() {
  const [s, setS] = useState<State>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [recoveryError, setRecoveryError] = useState<{
    raw: string | null;
    message: string;
  } | null>(null);
  const [recoveries, setRecoveries] = useState<{ key: string; raw: string }[]>([]);
  const [persistenceIssue, setPersistenceIssue] = useState("");
  const [handoffIssue, setHandoffIssue] = useState("");
  const [saveAttempt, setSaveAttempt] = useState(0);
  const restored = useRef(false);
  const restore = useCallback(() => {
    setRecoveryError(null);
    setHandoffIssue("");
    try {
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
        EMPTY,
        `${KEY}:recovery:${new Date().toISOString()}:${crypto.randomUUID()}`,
        (raw) => studioHistoryNeedsRecovery(JSON.parse(raw)),
      );
      if (result.status === "blocked") {
        setRecoveryError(result);
        return;
      }
      // Recovered originals stay available on later visits, including after new work is saved.
      setRecoveries(readStudioRecoveries(focusLocalStorage, KEY));
      const prior = { ...result.state };
      if (prior.tokens && prior.content && !prior.libraryId) prior.libraryId = crypto.randomUUID();
      try {
        focusLocalStorage.setItem(KEY, JSON.stringify(prior));
      } catch {
        setRecoveryError({
          raw: focusLocalStorage.getItem(KEY),
          message:
            "This browser cannot save your work right now. Download any existing data below, free some browser storage, then try again.",
        });
        return;
      }
      setS(prior);
      // A failed archive or pending hand-off must not disable autosave for a valid current design.
      try {
        const pending = focusSessionStorage.getItem("refraction:pending-rescue");
        if (pending) {
          const next = migrate(JSON.parse(pending));
          if (next.tokens && !next.libraryId) next.libraryId = crypto.randomUUID();
          if (prior.tokens && prior.content && prior.libraryId)
            writeLibrary(withVersion(readLibrary(), libState(prior), new Date().toISOString()));
          focusLocalStorage.setItem(KEY, JSON.stringify(next));
          setS(next);
          focusSessionStorage.removeItem("refraction:pending-rescue");
          if (prior.tokens)
            toast("Opened redesign", {
              duration: 15000,
              action: { label: "Undo", onClick: () => setS(prior) },
            });
        }
      } catch {
        setHandoffIssue(
          "The incoming redesign could not be opened safely. Its hand-off data has been kept; your current design remains available.",
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
  }, []);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    restore();
  }, [restore]);
  useEffect(() => {
    if (!loaded) return;
    try {
      focusLocalStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      setPersistenceIssue(
        "Your latest changes could not be saved in this browser. Keep this tab open, download your current work below, or free some browser storage and retry.",
      );
      return;
    }
    try {
      if (s.tokens && s.content && s.libraryId)
        writeLibrary(withVersion(readLibrary(), libState(s), new Date().toISOString()));
      setPersistenceIssue("");
    } catch {
      setPersistenceIssue(
        "Your current design is saved for refresh, but My designs could not be updated. Download your work before switching designs, or free some browser storage and retry.",
      );
    }
  }, [s, loaded, saveAttempt]);
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
  const stepBack = (dir: "undo" | "redo") =>
    setS((o) => {
      const r = (dir === "undo" ? undoStep : redoStep)({ past: o.past, future: o.future }, snap(o));
      if (!r) return o;
      toast(dir === "undo" ? "Undid the last step" : "Redid the step", { duration: 2500 });
      return { ...o, ...r.state, cache: o.cache, ...r.t };
    });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z")
        return;
      e.preventDefault();
      stepBack(e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
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
  useLeaveGuard(dirty);
  const reset = (k: "new" | "retake") =>
    setS((o) =>
      k === "new"
        ? { ...EMPTY, past: [...o.past, snap(o)].slice(-30) }
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
  return (
    <div className="min-h-screen">
      <AppHeader onLogo={() => update({ stage: "brief" })}>
        {s.stage !== "brief" && (
          <>
            <div className="flex items-center gap-4">
              <Progress stage={s.stage} step={s.stepIndex} total={questionCount(s.quick)} />
              {s.aiCalls > 0 && (
                <HelpTip tip="Each AI step uses a small amount of credit.">
                  <span tabIndex={0} className="eyebrow">
                    {s.aiCalls} AI {s.aiCalls === 1 ? "step" : "steps"} used
                  </span>
                </HelpTip>
              )}
              {dirty && <span className="eyebrow">Not saved</span>}
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
              <Button variant="ghost" size="sm" onClick={() => requestReset("new")}>
                New design
              </Button>
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
                <Button variant="outline" size="sm" onClick={() => setSaveAttempt((n) => n + 1)}>
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
                A previous save could not be read. Its original data is retained in this browser and
                can be downloaded for recovery. New work saves separately.
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
      {s.stage !== "brief" && <Journey current={s.stage === "rx" ? 2 : 1} />}
      {s.stage === "brief" && <Brief s={s} update={update} />}
      {s.stage === "directions" && <Directions s={s} update={update} />}
      {s.stage === "exam" && s.tokens && s.content && <Exam s={s} update={update} />}
      {s.stage === "review" && s.tokens && s.content && <Review s={s} update={update} />}
      {s.stage === "rx" && s.tokens && s.content && <Rx s={s} update={update} ask={requestReset} />}
    </div>
  );
}

function Review({ s, update }: P) {
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

type P = { s: State; update: (p: Partial<State>) => void; ask?: (k: "new" | "retake") => void };

function Brief({ s, update }: P) {
  const run = useServerFn(proposeDirections);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const req = useRef(0);
  const wait = useWait(busy, "Designing three directions");
  useLeaveGuard(busy);
  const go = async () => {
    const id = ++req.current;
    setBusy(true);
    setErr("");
    try {
      const r =
        AI_SPENDING_ENABLED && hasCloudBackend()
          ? await run({
              data: {
                brief: s.brief,
                purpose: purposeText(s.purpose),
                taste: profileText(readProfile()),
              },
            })
          : createLocalDirections(s.brief, s.purpose);
      if (id !== req.current) return; // cancelled
      update({
        stage: "directions",
        content: r.content,
        page: { ...DEFAULT_PAGE_SETTINGS },
        directions: r.directions,
        aiCalls: s.aiCalls + (AI_SPENDING_ENABLED && hasCloudBackend() ? 1 : 0),
        cache: {},
        tokens: null,
        libraryId: crypto.randomUUID(),
        projectId: null,
        savedHash: null,
      });
    } catch (e) {
      if (id === req.current) setErr((e as Error).message);
    } finally {
      if (id === req.current) setBusy(false);
    }
  };
  const openGallery = (g: GalleryItem, mode: OpenMode = "exam") => {
    const before = { ...s };
    update({
      stage: mode,
      brief: g.brief,
      content: g.content,
      page: { ...DEFAULT_PAGE_SETTINGS },
      directions: [g.direction],
      direction: g.direction.name,
      tokens: g.direction.tokens,
      stepIndex: 0,
      picks: [],
      history: [],
      cache: {},
      recheck: [],
      projectId: null,
      savedHash: null,
      libraryId: crypto.randomUUID(),
    });
    if (before.tokens)
      toast(`Opened ${g.direction.name}`, {
        duration: 8000,
        action: { label: "Undo", onClick: () => update(before) },
      });
  };
  const previousStage = [...s.past]
    .reverse()
    .find((p) => p.libraryId === s.libraryId && p.stage !== "brief")?.stage;
  const resumeStage =
    previousStage === "rx" || previousStage === "review"
      ? previousStage
      : s.stepIndex >= questionCount(s.quick)
        ? "review"
        : "exam";
  return (
    <>
      <StudioWelcome
        brief={s.brief}
        onBrief={(brief) => update({ brief })}
        onStart={() => void go()}
        busy={busy}
        error={err}
        quick={s.quick}
        onQuick={(quick) => update({ quick })}
        experience={s.purpose.experience ?? "website"}
        integration={s.integration}
        onIntegration={(integration) => update({ integration })}
        onExperience={(experience) => update({ purpose: { ...s.purpose, experience } })}
        resume={
          s.tokens ? (
            <div className="resume-current">
              <span>
                Keep going with <strong>{s.content?.brand}</strong>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update({
                    stage: resumeStage,
                  })
                }
              >
                Continue design <ArrowRight size={14} />
              </Button>
            </div>
          ) : (
            <ResumeList onOpen={(st) => update(migrate(st as Partial<State>))} />
          )
        }
        settings={
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Choice
              label="Audience"
              value={s.purpose.audience}
              list={AUDIENCES}
              onChange={(v) =>
                update({ purpose: { ...s.purpose, audience: v as Purpose["audience"] } })
              }
            />
            <Choice
              label="Feeling"
              value={s.purpose.tone}
              list={TONES}
              onChange={(v) => update({ purpose: { ...s.purpose, tone: v as Purpose["tone"] } })}
            />
          </div>
        }
      />
      <StarterCollection onOpen={(g) => openGallery(g)} />
    </>
  );
}

function Choice({
  label,
  value,
  list,
  onChange,
}: {
  label: string;
  value: string;
  list: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-sm border border-input bg-background px-2"
      >
        <option value="">No preference</option>
        {list.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Directions({ s, update }: P) {
  useDesignFonts(s.directions.map((d) => d.tokens));
  if (!s.content) return null;
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-10">
      <p className="eyebrow">Your starting point</p>
      <h2 className="mt-2 font-display text-4xl md:text-5xl">Which direction is closest?</h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Three looks from the collection, using your words. Pick a direction, then make it your own.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {s.directions.map((d, i) => (
          <button
            key={i}
            onClick={() =>
              update({
                stage: "exam",
                direction: d.name,
                tokens: d.tokens,
                stepIndex: 0,
                picks: [],
                history: [],
                cache: {},
                recheck: [],
              })
            }
            className="lens group overflow-hidden rounded-sm border border-border bg-card text-left"
          >
            <div className="h-72 overflow-hidden border-b border-border">
              <DesignPreview t={d.tokens} c={s.content!} compact />
            </div>
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-2xl">{d.name}</h3>
                <span className="eyebrow">{i + 1}</span>
              </div>
              <p className="mt-1 text-sm">{d.mood}</p>
              <p className="mt-2 text-sm text-muted-foreground">{d.why}</p>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function Exam({ s, update }: P) {
  const step = STEPS[s.stepIndex]!;
  const run = useServerFn(proposeStep);
  const cached = s.cache[step.id];
  const [sel, setSelRaw] = useState(0);
  const [tw, setTw] = useState<Nudge[]>([]);
  const setSel = (i: number) => {
    setSelRaw(i);
    setTw([]);
  };
  const [taste, setTaste] = useState("");
  useEffect(() => {
    setTaste(
      [profileText(readProfile()), tasteText(parseTaste(focusLocalStorage.getItem(TASTE_KEY)))]
        .filter(Boolean)
        .join("; "),
    );
  }, []);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const req = useRef(0);
  const wait = useWait(busy, `Designing options for ${step.title.toLowerCase()}`);
  useLeaveGuard(busy);
  const cancel = () => {
    req.current++;
    setBusy(false);
    setErr("Stopped. Press Try again when you're ready.");
  };
  const history =
    s.picks.map((p) => `${p.step}: ${p.label}${p.reason ? ` (${p.reason})` : ""}`).join("; ") +
    (taste ? `${s.picks.length ? "; " : ""}Taste from the owner's earlier designs: ${taste}` : "");

  const load = async () => {
    const id = ++req.current;
    setErr("");
    setBusy(true);
    try {
      const r =
        AI_SPENDING_ENABLED && hasCloudBackend()
          ? await run({
              data: {
                brief: s.brief,
                purpose: purposeText(s.purpose),
                stepId: step.id,
                tokens: s.tokens!,
                history,
              },
            })
          : { options: buildLocalOptions(step.id, s.tokens!, s.purpose) };
      if (id !== req.current) return; // cancelled
      update({
        cache: { ...s.cache, [step.id]: r.options },
        aiCalls: s.aiCalls + (AI_SPENDING_ENABLED && hasCloudBackend() ? 1 : 0),
      });
    } catch (e) {
      if (id === req.current) setErr((e as Error).message);
    } finally {
      if (id === req.current) setBusy(false);
    }
  };
  useEffect(() => {
    setSel(0);
    setReason("");
    if (!cached) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.stepIndex]);

  const ranked = cached
    ? rankOptions(
        s.purpose,
        cached.map((o) => ({ ...o, tokens: s.fix ? fixContrast(o.tokens) : o.tokens })),
      )
    : null;
  const opts = ranked?.list ?? null;
  const base0 = opts?.[sel]?.tokens;
  const shown = base0 ? (tw.length ? applyNudges(base0, tw) : base0) : s.tokens!;
  useDesignFonts([s.tokens, ...(opts ?? []).map((o) => o.tokens)]);

  const commit = (o: (typeof opts extends (infer X)[] | null ? X : never) | null) => {
    const next = s.stepIndex + 1;
    const changed = !!o && JSON.stringify(o.tokens) !== JSON.stringify(s.tokens);
    // A change invalidates cached options for later Lenses and flags the ones that depend on it.
    const cache = { ...s.cache };
    if (changed) STEPS.slice(next).forEach((x) => delete cache[x.id]);
    const before = s; // full snapshot for Undo
    const recheck = changed
      ? [...new Set([...s.recheck.filter((r) => r !== step.id), ...affectedSteps(step.id)])]
      : s.recheck.filter((r) => r !== step.id);
    update({
      tokens: o ? o.tokens : s.tokens,
      history: [...s.history, s.tokens!],
      picks: o
        ? [
            ...s.picks.filter((p) => p.step !== step.title),
            { step: step.title, label: o.label, reason: reason.trim() },
          ]
        : s.picks,
      ...afterAnswer(s.stepIndex, s.quick),
      cache,
      recheck,
    });
    if (o)
      toast(`Chose “${o.label}” for ${step.title.toLowerCase()}`, {
        duration: 6000,
        action: { label: "Undo", onClick: () => update(before) },
      });
  };
  const back = () => {
    if (s.stepIndex === 0) return update({ stage: "directions" });
    const prev = s.history[s.history.length - 1];
    update({
      tokens: prev ?? s.tokens,
      history: s.history.slice(0, -1),
      picks: s.picks.filter((p) => p.step !== STEPS[s.stepIndex - 1]?.title),
      stepIndex: s.stepIndex - 1,
    });
  };
  const sel0 = opts?.[sel];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (opts && n >= 1 && n <= opts.length) {
        setSel(n - 1);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        back();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  // Show only reasons that tell options apart; a reason every option shares is noise.
  const shared = new Set(
    (opts ?? [])
      .map((o) => o.ev.effects.map((e) => e.reason))
      .reduce<string[]>((a, r, k) => (k === 0 ? r : a.filter((x) => r.includes(x))), []),
  );

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:px-10 lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-5">
        <div>
          <p className="eyebrow">
            Question {s.stepIndex + 1} of {questionCount(s.quick)} · {step.title}
          </p>
          <h2 className="mt-2 font-display text-4xl leading-tight">{step.question}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{step.teach}</p>
          <LensCard id={step.id} />
          {s.recheck.includes(step.id) && (
            <p className="mt-3 rounded-sm border border-accent/50 bg-accent/10 p-2 text-xs">
              An earlier choice changed something this question depends on, so these options are
              fresh.
            </p>
          )}
        </div>
        <WaitLine wait={wait} onCancel={cancel} />
        {err && (
          <div role="alert" className="space-y-2 rounded-sm border border-destructive p-3 text-sm">
            <p>{err}</p>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={busy}>
              {busy ? "Trying…" : "Try again"}
            </Button>
          </div>
        )}
        <div className="space-y-2">
          {!opts &&
            !err &&
            [0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-sm bg-muted" />
            ))}
          {ranked && ranked.removed > 0 && (
            <p className="text-xs text-muted-foreground">
              {ranked.removed} option{ranked.removed > 1 ? "s" : ""} hidden because they don't suit
              your audience.
            </p>
          )}
          {ranked?.relaxed && (
            <p className="text-xs text-muted-foreground">
              No option fully suited your audience, so all are shown.
            </p>
          )}
          {opts?.map((o, i) => (
            <button
              key={o.i}
              onClick={() => setSel(i)}
              className={`lens w-full rounded-sm border p-4 text-left ${sel === i ? "border-accent bg-card ring-1 ring-accent" : "border-border bg-card/60"}`}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl text-accent">{i + 1}</span>
                <span className="font-medium">{o.label}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{o.why}</p>
              {o.ev.effects.some((e) => !shared.has(e.reason)) && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {o.ev.effects
                    .filter((e) => !shared.has(e.reason))
                    .map((e, k) => (
                      <li key={k} className={e.score < 0 ? "text-destructive" : "text-foreground"}>
                        {e.score < 0 ? "⚠ " : "＋ "}
                        {e.reason}
                      </li>
                    ))}
                </ul>
              )}
            </button>
          ))}
        </div>
        {opts && (
          <>
            <div
              role="group"
              aria-label="Fine-tune this option"
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="eyebrow mr-1">Fine-tune</span>
              {NUDGES.map((n) => (
                <Button
                  key={n.id}
                  size="sm"
                  variant="outline"
                  onClick={() => setTw((x) => [...x, n.id].slice(-6))}
                >
                  {n.label}
                </Button>
              ))}
              {tw.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setTw([])}>
                  Reset
                </Button>
              )}
            </div>
            {tw.length > 0 && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Option {sel + 1}, nudged: {tw.map((n) => n.toLowerCase()).join(" → ")}. Text stays
                readable.
              </p>
            )}
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={140}
              placeholder="What do you like about it? (optional)"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={back}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => commit(null)}>
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  commit(
                    sel0
                      ? {
                          ...sel0,
                          tokens: shown,
                          label: tw.length
                            ? `${sel0.label}, ${tw.map((n) => n.toLowerCase()).join(", ")}`
                            : sel0.label,
                        }
                      : null,
                  )
                }
              >
                Choose {sel + 1}
              </Button>
            </div>
            {AI_SPENDING_ENABLED && hasCloudBackend() && (
              <Button
                variant="link"
                size="sm"
                className="px-0"
                disabled={busy}
                onClick={() => void load()}
              >
                {busy ? "Getting 3 new options…" : "Show three different options"}
              </Button>
            )}
            <p className="hidden text-xs text-muted-foreground md:block">
              Tip: press 1, 2 or 3 to compare · ← to go back
            </p>
          </>
        )}
        <label className="flex min-h-9 items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={s.fix}
            onChange={(e) => update({ fix: e.target.checked })}
          />{" "}
          Make text readable for me (fixes low <Term term="contrast">contrast</Term>)
        </label>
        <ChecksList t={shown} />
        <DecisionMap s={s} current={step.id} jump={(i) => update({ stepIndex: i })} />
      </aside>
      <section className="sticky top-0 z-10 order-first max-h-[42vh] h-fit overflow-auto rounded-sm border border-border shadow-sm lg:static lg:order-none lg:max-h-none lg:overflow-hidden">
        <PreviewFrame
          t={shown}
          c={s.content!}
          phoneFirst={s.purpose.device === "mostly phones"}
          bottomTabs={s.nav === "bottom-tabs"}
          experience={s.purpose.experience}
        />
      </section>
    </main>
  );
}

function ChecksList({ t }: { t: Tokens }) {
  return (
    <div className="border-t border-border pt-4">
      <p className="eyebrow mb-2">
        <Term term="checks">Quality checks</Term>
      </p>
      <ul className="space-y-1 font-mono text-xs">
        {measuredChecks(t).map((n) => (
          <li key={n.name} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {n.name} {CHECK_CARD[n.name] && <WhyPopover cardId={CHECK_CARD[n.name]!} />}
            </span>
            <span className={n.ok ? "" : "text-destructive"}>
              {n.value} {n.ok ? "✓" : "✗"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LensCard({ id }: { id: string }) {
  const c = cardFor(id);
  if (!c) return null;
  return (
    <details className="mt-3 rounded-sm border border-border bg-card/70 p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        What experts know about this{" "}
        <HelpTip tip="A = law, standard or repeated study. B = solid but limited research. C = what experienced designers agree on.">
          <span tabIndex={0} className="eyebrow ml-1">
            evidence {c.grade}
          </span>
        </HelpTip>
      </summary>
      <dl className="mt-2 space-y-1.5 text-muted-foreground">
        <div>
          <dt className="inline font-medium text-foreground">Do: </dt>
          <dd className="inline">{c.use}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Avoid: </dt>
          <dd className="inline">{c.avoid}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Minimum: </dt>
          <dd className="inline">{c.floor}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Typical AI mistake: </dt>
          <dd className="inline">{c.mistakes}</dd>
        </div>
        <div className="text-xs">Source: {c.evidence}</div>
      </dl>
    </details>
  );
}

function DecisionMap({
  s,
  current,
  jump,
}: {
  s: State;
  current: string;
  jump: (i: number) => void;
}) {
  const touched = affectedSteps(current);
  return (
    <div className="border-t border-border pt-4">
      <p className="eyebrow mb-2">
        Decision map{" "}
        <span className="normal-case tracking-normal">· tap an answered question to change it</span>
      </p>
      <ol className="space-y-1 text-xs">
        {STEPS.map((st, i) => {
          const pick = s.picks.find((p) => p.step === st.title);
          return (
            <li
              key={st.id}
              className={`flex justify-between gap-2 ${st.id === current ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              <span>
                {i < s.stepIndex ? (
                  <button
                    className="min-h-6 underline decoration-dotted underline-offset-2 hover:text-foreground"
                    onClick={() => jump(i)}
                    aria-label={`Change answer to question ${i + 1}, ${st.title}`}
                  >
                    {i + 1}. {st.title}
                  </button>
                ) : (
                  <>
                    {i + 1}. {st.title}
                  </>
                )}
                {touched.includes(st.id) && (
                  <span className="ml-1 text-accent">← affected by this</span>
                )}
                {s.recheck.includes(st.id) && st.id !== current && (
                  <HelpTip tip="An earlier choice changed something this question depends on. It will show fresh options.">
                    <span tabIndex={0} className="ml-1 text-accent">
                      ● re-check
                    </span>
                  </HelpTip>
                )}
              </span>
              <span className="truncate text-right">
                {pick ? pick.label : i < s.stepIndex ? "kept" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Rx({ s, update, ask }: P) {
  useDesignFonts([s.tokens]);
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("Lovable");
  const integration = s.integration;
  const setIntegration = (mode: Integration) => update({ integration: mode });
  const md = buildPrescription({
    integration,
    brief: s.brief,
    content: s.content!,
    direction: s.direction,
    tokens: s.tokens!,
    picks: s.picks,
    tool,
    checks: measuredChecks(s.tokens!),
    nav: s.nav,
    experience: s.purpose.experience,
  });
  useEffect(() => {
    if (!s.picks.length) return;
    try {
      const next = rememberTaste(
        parseTaste(focusLocalStorage.getItem(TASTE_KEY)),
        s.picks,
        s.content?.brand ?? "",
      );
      focusLocalStorage.setItem(TASTE_KEY, JSON.stringify(next));
    } catch {
      /* taste memory is optional */
    }
  }, [s.picks, s.content?.brand]);
  const { copied, copy: copyText } = useCopied();
  const exported = (scope: "spec" | "project" = "spec") => {
    const pageIsDefault = JSON.stringify(s.page) === JSON.stringify(DEFAULT_PAGE_SETTINGS);
    if (
      scope === "project" ||
      pageIsDefault ||
      integration === "existing" ||
      s.purpose.experience === "app"
    )
      update({ savedHash: workHash(s) });
  };
  const copy = async (k: string, text: string) => {
    if (await copyText(k, text)) {
      if (k === "rx" || k === "msg0") exported();
    }
  };
  const download = () => {
    downloadBlob(new Blob([md], { type: "text/markdown" }), "DESIGN.md");
    exported();
  };
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"page" | "parts">("page");
  const [advanced, setAdvanced] = useState(false);
  const showAuthored = s.purpose.experience !== "app" && integration === "new";
  const [packing, setPacking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const pack = async () => {
    if (busy || !s.tokens) return;
    setBusy(true);
    setPacking(true);
    try {
      // Signature is optional: an unsigned pack still works if signing is unavailable.
      const sig = hasCloudBackend()
        ? await signDesignId({ data: { id: designId(s.tokens) } })
            .then((r) => r.sig)
            .catch(() => undefined)
        : undefined;
      downloadBlob(
        await buildPack(md, s.tokens, s.content?.brand, sig, integration),
        integration === "existing" ? "focus-existing-site-pack.zip" : "focus-design-pack.zip",
      );
      exported();
    } catch (e) {
      toast.error(
        e instanceof PackError
          ? `This pack didn't pass its safety check, so nothing was downloaded: ${e.problems.join("; ")}.`
          : "Could not download the design pack. Please try again.",
      );
    } finally {
      setBusy(false);
      setPacking(false);
    }
  };
  const share = async () => {
    if (busy) return;
    setBusy(true);
    setSharing(true);
    try {
      const url = await createShare(s.content?.brand ?? "Untitled design", {
        tokens: s.tokens,
        content: s.content,
        direction: s.direction,
      });
      const copied = await copyText("share", url);
      if (copied) toast.success("Share link copied", { description: url });
      else toast.info("Your share link is ready", { description: url, duration: 15000 });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setSharing(false);
    }
  };
  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:px-10 lg:grid-cols-[1fr_1.1fr]">
      <div className="lg:col-span-2">
        <IntegrationChoice value={integration} onChange={setIntegration} />
      </div>
      {showAuthored && (
        <div className="lg:col-span-2">
          <AuthoredPagePanel
            key={s.libraryId ?? "draft"}
            tokens={s.tokens!}
            content={s.content!}
            settings={s.page}
            onSettings={(page) => update({ page })}
            onContent={(content) => update({ content })}
            onExport={() => exported("project")}
            projectState={libState(s)}
          />
        </div>
      )}
      {showAuthored && (
        <button
          type="button"
          className="lg:col-span-2 flex min-h-14 items-center justify-between border-b border-border text-left text-sm font-medium"
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          Design specification &amp; handoff tools{" "}
          <span aria-hidden="true">{advanced ? "−" : "+"}</span>
        </button>
      )}
      <div hidden={showAuthored && !advanced} className="min-w-0 space-y-5">
        <BrandLogo variant="vision" />
        <h2 className="font-display text-5xl leading-none">
          A clear direction.
          <br />
          Ready to make real.
        </h2>
        {integration === "existing" && (
          <p className="rounded-sm border border-border bg-card p-3 text-sm">
            This is a style study. Focus reads public pages and prepares files; it does not install
            changes on your live site. Preview words and navigation are examples. Apply the pack to
            a separate staging or local copy first, then verify the original content, routes, and
            working tasks before an owner-reviewed release.
          </p>
        )}
        <ContentEditor content={s.content!} onChange={(content) => update({ content })} />
        {s.quick && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-accent/50 bg-accent/10 p-3 text-sm">
            <span>
              You answered the 3 main questions. The other {STEPS.length - 3} use your direction's
              choices.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => update({ quick: false, stage: "exam", stepIndex: 3 })}
            >
              Answer the other {STEPS.length - 3} questions
            </Button>
          </div>
        )}
        {(() => {
          const g = qualityGrade(measuredChecks(s.tokens!));
          return (
            <div
              className="rounded-sm border border-border bg-card p-4"
              aria-label="Design token checks"
            >
              <div className="flex items-center gap-3">
                <HelpTip tip="These checks measure the selected design tokens. They do not verify a rendered page, keyboard operation, or usability.">
                  <div tabIndex={0} className="flex gap-1" aria-label={`Level ${g.level + 1} of 3`}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-2 w-8 rounded-full ${i <= g.level ? "bg-primary" : "bg-border"}`}
                      />
                    ))}
                  </div>
                </HelpTip>
                <p className="font-semibold">
                  {g.name}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · design tokens only
                  </span>
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{g.summary}</p>
              {g.missing.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {g.missing.map((m) => (
                    <li key={m}>
                      To improve: {m} {CHECK_CARD[m] && <WhyPopover cardId={CHECK_CARD[m]!} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
        {s.libraryId && s.tokens && (
          <SkinBar id={s.libraryId} tokens={s.tokens} onChange={(tokens) => update({ tokens })} />
        )}
        <p className="text-muted-foreground">
          Paste this <Term term="prescription">Vision</Term> into your AI builder. It carries every
          decision, your reasons, measured contrast, and the craft rules generic AI pages skip.
        </p>

        <label className="block text-sm">
          <span className="eyebrow">Which tool do you build with?</span>
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value as (typeof TOOLS)[number])}
            className="mt-1 h-11 w-full rounded-sm border border-input bg-background px-2"
          >
            {TOOLS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            {integration === "existing"
              ? "The Vision adds safe restyle steps for that tool. The pack adds rule lines you paste into your own rules file, plus a short version for small or local models."
              : "The Vision adds instructions for that tool. The design pack also includes files for every major tool and a short version for small or local models."}
          </span>
        </label>
        {(() => {
          const m = toolMessages(tool, s.content!.brand, integration);
          return (
            <details className="rounded-sm border border-border bg-card p-3 text-sm">
              <summary className="min-h-6 cursor-pointer font-medium">
                What to say to {tool}, step by step
              </summary>
              <ol className="mt-3 space-y-3">
                {[m.first, ...m.next].map((msg, i) => (
                  <li key={msg}>
                    <p className="text-xs text-muted-foreground">
                      {i === 0
                        ? "1. Send first, with the Vision pasted after it"
                        : `${i + 1}. Send next`}
                    </p>
                    <p className="mt-1">{msg}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={() => copy(`msg${i}`, i === 0 ? `${msg}\n\n${md}` : msg)}
                    >
                      {copied === `msg${i}`
                        ? "Copied ✓"
                        : i === 0
                          ? "Copy message and Vision"
                          : "Copy message"}
                    </Button>
                  </li>
                ))}
              </ol>
            </details>
          );
        })()}
        <fieldset className="space-y-1.5">
          <legend className="eyebrow">How visitors move around</legend>
          {NAV_PATTERNS.map((n) => (
            <label
              key={n.id}
              className="flex min-h-11 cursor-pointer items-start gap-2 rounded-sm border border-border bg-card p-2.5 text-sm has-[:checked]:border-accent"
            >
              <input
                type="radio"
                name="nav"
                className="mt-1 h-4 w-4"
                checked={s.nav === n.id}
                onChange={() => update({ nav: n.id })}
              />
              <span>
                <span className="font-medium">{n.label}</span>
                <span className="block text-xs text-muted-foreground">Best when: {n.when}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="brand-handoff-note">
          <CatMascot pose="handoff" />
          <p>
            <strong>A thoughtful handoff, one step at a time.</strong>
            <br />
            {integration === "existing"
              ? "Start with START-HERE.md in a new, empty folder. Keep a backup, try one page in staging, test real tasks with sandbox data, and rehearse rollback before publishing."
              : "Keep a copy of your work. Review the included setup steps, test your pages and key tasks in a preview, and check the details before publishing."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="min-w-44" onClick={() => copy("rx", md)}>
            {copied === "rx" ? "Copied ✓" : "Copy Vision"}
          </Button>
          <Button
            variant="outline"
            className="min-w-48"
            onClick={() =>
              copy(
                "tok",
                integration === "existing" ? scopedTokensCss(s.tokens!) : tokensCss(s.tokens!),
              )
            }
          >
            {copied === "tok" ? "Copied ✓" : "Copy design values only"}
          </Button>
          <Button variant="outline" onClick={download}>
            Download DESIGN.md
          </Button>
          <Button variant="outline" disabled={busy} onClick={pack}>
            {packing
              ? "Checking and preparing your pack…"
              : integration === "existing"
                ? "Download existing-site pack"
                : "Download design pack"}
          </Button>
          <DesignShareAction
            signedIn={!!user}
            busy={busy}
            sharing={sharing}
            onShare={() => void share()}
          />
          <Button variant="ghost" onClick={() => ask?.("retake")}>
            Answer the questions again
          </Button>
        </div>
        <p role="status" className="sr-only">
          {sharing ? "Creating your share link…" : packing ? "Preparing your design pack…" : ""}
        </p>
        <pre className="max-h-[32rem] overflow-auto rounded-sm border border-border bg-card p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {md}
        </pre>
        {integration === "existing" && <BeforeAfter />}
        {s.libraryId && s.tokens && s.content && (
          <LaunchPanel
            id={s.libraryId}
            title={s.content.brand}
            tokens={s.tokens}
            tool={tool}
            artifact={{
              content: s.content,
              page: s.page,
              experience: s.purpose.experience,
              nav: s.nav,
            }}
          />
        )}
        {s.tokens && s.content && (
          <LiveVisionPanel designId={designId(s.tokens)} title={s.content.brand} vision={md} />
        )}
        {s.tokens && (
          <BadgePanel tokens={s.tokens} picks={s.picks} brand={s.content?.brand ?? ""} />
        )}
      </div>
      <section hidden={showAuthored && !advanced} className="h-fit min-w-0 space-y-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "page" ? "default" : "outline"}
            onClick={() => setView("page")}
          >
            Page
          </Button>
          <Button
            size="sm"
            variant={view === "parts" ? "default" : "outline"}
            onClick={() => setView("parts")}
          >
            Components &amp; states
          </Button>
        </div>
        <div className="overflow-hidden rounded-sm border border-border shadow-sm">
          {view === "page" ? (
            <PreviewFrame
              t={s.tokens!}
              c={s.content!}
              phoneFirst={s.purpose.device === "mostly phones"}
              bottomTabs={s.nav === "bottom-tabs"}
              experience={s.purpose.experience}
            />
          ) : (
            <ComponentSheet t={s.tokens!} c={s.content!} />
          )}
        </div>
      </section>
    </main>
  );
}

// Up to three recent saved designs, so people can pick up where they left off.
function ResumeList({ onOpen }: { onOpen: (state: Record<string, unknown>) => void }) {
  const [list, setList] = useState<LibraryEntry[]>([]);
  useEffect(() => {
    try {
      setList([...readLibrary()].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3));
    } catch {
      setList([]);
    }
  }, []);
  if (!list.length) return null;
  return (
    <section
      aria-label="Continue a saved design"
      className="mb-4 rounded-sm border border-border bg-card p-3"
    >
      <p className="eyebrow mb-2">Continue a saved design</p>
      <ul className="space-y-1">
        {list.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{e.title}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpen({ ...e.state, libraryId: e.id })}
            >
              {resumeLabel(e.state)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
