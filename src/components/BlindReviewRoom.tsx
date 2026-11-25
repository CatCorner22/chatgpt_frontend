import { focusLocalStorage } from "@/lib/browser-storage";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileUp,
  RotateCcw,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BookingObservationFields } from "./BookingObservationFields";
import { bookingProtocol } from "../../north-star-kit/blind-test/reviewer";
import { PilotOrganizer } from "@/components/PilotOrganizer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  completedReviewCount,
  createReviewSession,
  MAX_REVIEW_PACKET_BYTES,
  missingReviewAnswers,
  parseReviewerPacket,
  parseReviewSession,
  REVIEW_ROOM_KEY,
  reviewAnswerBundle,
  safeReviewUrl,
  type ReviewerPacket,
  type ReviewDraft,
  type ReviewSession,
} from "@/lib/review-room";

const fieldNames: Record<string, string> = {
  reviewerCode: "Reviewer code",
  bookingObservation: "Check the price, seconds and booking count. A blank field means unmeasured.",
  taskOutcome: "Task outcome",
  judgedOrigin: "Origin estimate",
  hierarchy: "Hierarchy",
  typography: "Reading and typography",
  composition: "Composition and detail",
  distinctiveness: "Fit and distinctiveness",
  interaction: "Interaction clarity",
  content: "Content and credibility",
};

export function BlindReviewRoom() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState("");
  const [pendingPacket, setPendingPacket] = useState<ReviewerPacket | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [organizing, setOrganizing] = useState(false);
  const [summary, setSummary] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const taskHeading = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);
  const fileRead = useRef(0);

  useEffect(() => {
    return () => {
      fileRead.current++;
    };
  }, []);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = focusLocalStorage.getItem(REVIEW_ROOM_KEY);
      if (saved) {
        setSession(parseReviewSession(saved));
        setStatus("Your saved answers and sample order have been restored.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This browser could not restore the review. You can load your reviewer packet again.",
      );
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !session) return;
    try {
      focusLocalStorage.setItem(REVIEW_ROOM_KEY, JSON.stringify(session));
      setSaveError("");
    } catch {
      setSaveError(
        "This browser could not save your latest answers. Keep this page open and download completed answers before leaving.",
      );
    }
  }, [session, hydrated]);

  const begin = (packet: ReviewerPacket) => {
    try {
      setSession(createReviewSession(packet));
      setPendingPacket(null);
      setError("");
      setMissing([]);
      setSummary(false);
      setStatus(
        "Packet loaded. The sample order supplied by the organizer will stay the same when you return.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The review could not start in this browser.",
      );
    }
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const request = ++fileRead.current;
    setPendingPacket(null);
    setError("");
    try {
      if (file.size > MAX_REVIEW_PACKET_BYTES)
        throw new Error("Choose a reviewer packet smaller than 2 MB.");
      const contents = await file.text();
      if (request !== fileRead.current) return;
      const packet = parseReviewerPacket(contents);
      if (session) setPendingPacket(packet);
      else begin(packet);
    } catch (cause) {
      if (request !== fileRead.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "This file could not be read. Choose a reviewer packet in JSON format.",
      );
    }
  };

  const updateDraft = (patch: Partial<ReviewDraft>) => {
    setSession((current) => {
      if (!current) return current;
      const id = current.order[current.currentIndex]!;
      return {
        ...current,
        drafts: { ...current.drafts, [id]: { ...current.drafts[id]!, ...patch } },
      };
    });
    setMissing([]);
    setStatus("");
  };

  const move = (direction: -1 | 1) => {
    if (!session) return;
    const sample = session.packet.samples.find(
      (item) => item.id === session.order[session.currentIndex],
    )!;
    if (direction === 1) {
      const unanswered = missingReviewAnswers(
        session.drafts[sample.id]!,
        sample,
        session.reviewerCode,
      );
      if (unanswered.length) {
        setMissing(unanswered);
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      if (session.currentIndex === session.order.length - 1) {
        setSummary(true);
        setMissing([]);
        return;
      }
    }
    setSession((current) =>
      current
        ? {
            ...current,
            currentIndex: Math.max(
              0,
              Math.min(current.order.length - 1, current.currentIndex + direction),
            ),
          }
        : null,
    );
    setMissing([]);
    setStatus("");
    requestAnimationFrame(() => {
      taskHeading.current?.focus();
      taskHeading.current?.scrollIntoView({ block: "start" });
    });
  };

  const download = (partial: boolean) => {
    if (!session) return;
    try {
      const bundle = reviewAnswerBundle(session, partial);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = partial ? "review-answers-partial.json" : "review-answers.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus(
        `Prepared ${bundle.evaluations.length} completed ${bundle.evaluations.length === 1 ? "answer" : "answers"} for download. Return the file to the organizer yourself; nothing was sent automatically.`,
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The answer file could not be prepared. Your answers are still shown here.",
      );
    }
  };

  const reset = () => {
    fileRead.current++;
    setPendingPacket(null);
    try {
      focusLocalStorage.removeItem(REVIEW_ROOM_KEY);
      setSession(null);
      setSummary(false);
      setStatus("The review was cleared from this browser.");
      setError("");
      setSaveError("");
    } catch {
      setError("This browser could not clear the saved review. Your current answers remain open.");
    }
    setResetOpen(false);
  };

  const sample = session?.packet.samples.find(
    (item) => item.id === session.order[session.currentIndex],
  );
  const task = session?.packet.tasks.find((item) => item.id === sample?.taskId);
  const draft = session && sample ? session.drafts[sample.id]! : null;
  const complete = session ? completedReviewCount(session) : 0;
  const allComplete = !!session && complete === session.order.length;
  const sampleUrl = sample ? safeReviewUrl(sample.assetRef) : null;
  const feedback = (
    <>
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-destructive/40 bg-card p-4 text-sm"
        >
          {saveError}
        </div>
      )}
      {status && (
        <p role="status" className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {status}
        </p>
      )}
    </>
  );

  if (organizing && !session)
    return (
      <>
        <AppHeader />
        <PilotOrganizer onClose={() => setOrganizing(false)} />
      </>
    );
  return (
    <>
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-8">
          <div className="max-w-2xl">
            <p className="eyebrow">Independent review</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
              A fresh pair of eyes.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Try the task. Look closely. Record your own judgment before moving to the next sample.
            </p>
          </div>
          {session && (
            <Button variant="outline" className="min-h-11" onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} /> Clear this review
            </Button>
          )}
        </div>
        {feedback}
        {!hydrated ? (
          <p role="status" className="py-12 text-muted-foreground">
            Opening the review room…
          </p>
        ) : !session ? (
          <section
            className="grid gap-10 py-12 md:grid-cols-[1.2fr_1fr]"
            aria-labelledby="load-review-title"
          >
            <div>
              <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-muted">
                <FileUp size={22} aria-hidden="true" />
              </div>
              <h2 id="load-review-title" className="font-display text-2xl">
                Bring your reviewer packet
              </h2>
              <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">
                The study organizer provides a JSON packet containing the tasks and neutral sample
                links. Load that file to begin.
              </p>
              <label htmlFor="review-packet" className="mt-7 block text-sm font-medium">
                Reviewer packet · JSON, up to 2 MB
              </label>
              <input
                id="review-packet"
                type="file"
                accept=".json,application/json"
                className="mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-input bg-card p-2 text-sm file:mr-3 file:min-h-10 file:rounded-md file:border-0 file:bg-muted file:px-3 file:font-medium"
                onChange={(event) => {
                  void loadFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                The packet is read in this browser. Sample pages open only when you choose their
                link.
              </p>
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  fileRead.current++;
                  setError("");
                  setOrganizing(true);
                }}
              >
                Open private organizer workspace
              </Button>
            </div>
            <div className="border-t border-border pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
              <h2 className="font-display text-xl">Before you begin</h2>
              <ol className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <span className="mr-2 font-mono text-foreground">01</span>Choose an arbitrary
                  reviewer code. Your name or email is not needed.
                </li>
                <li>
                  <span className="mr-2 font-mono text-foreground">02</span>Review samples
                  independently. Save discussion with other reviewers until your answers are
                  submitted.
                </li>
                <li>
                  <span className="mr-2 font-mono text-foreground">03</span>Use the stated task and
                  rating anchors. “Unsure” is a useful answer when judging origin.
                </li>
                <li>
                  <span className="mr-2 font-mono text-foreground">04</span>Download your answers
                  and return the file to the organizer. Your answers are saved locally as you work.
                </li>
              </ol>
            </div>
          </section>
        ) : summary ? (
          <section className="max-w-2xl py-12" aria-labelledby="review-finished-title">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Check size={22} aria-hidden="true" />
            </div>
            <p className="eyebrow mt-5">
              {complete} of {session.order.length} samples complete
            </p>
            <h2 id="review-finished-title" className="mt-3 font-display text-3xl">
              Your observations are ready.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Download the answer file and return it to the organizer through the agreed channel.
              This room does not send your answers or reveal the samples’ sources.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button className="min-h-11" disabled={!allComplete} onClick={() => download(false)}>
                <Download size={16} /> Download all answers
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => setSummary(false)}>
                <ArrowLeft size={16} /> Review my answers
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Answers remain editable here. The organizer determines when collection is locked.
            </p>
          </section>
        ) : sample && task && draft ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 py-6">
              <p className="text-sm font-medium">{session.packet.title}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {complete} / {session.order.length} complete
              </p>
              <progress
                className="h-1.5 w-full accent-[var(--foreground)]"
                value={complete}
                max={session.order.length}
                aria-label="Completed sample reviews"
              />
            </div>
            <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
              <aside className="min-w-0 space-y-6" aria-label="Review instructions and task">
                <div>
                  <label htmlFor="reviewer-code" className="block text-sm font-medium">
                    Your reviewer code
                  </label>
                  <input
                    id="reviewer-code"
                    type="text"
                    value={session.reviewerCode}
                    maxLength={120}
                    autoComplete="off"
                    aria-describedby="reviewer-code-help"
                    aria-invalid={missing.includes("reviewerCode")}
                    className="mt-2 min-h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                    placeholder="e.g. reviewer-07"
                    onChange={(event) => {
                      setSession({ ...session, reviewerCode: event.target.value });
                      setMissing([]);
                    }}
                  />
                  <p
                    id="reviewer-code-help"
                    className="mt-2 text-xs leading-relaxed text-muted-foreground"
                  >
                    Choose any code, or use the one supplied by your organizer. No name or email is
                    needed.
                  </p>
                </div>
                <details className="rounded-lg border border-border p-4 text-sm">
                  <summary className="min-h-7 cursor-pointer font-medium">
                    Instructions from the organizer
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
                    {session.packet.instructions}
                  </p>
                </details>
                <section
                  className="border-t border-border pt-6"
                  aria-labelledby="sample-task-title"
                >
                  <p className="eyebrow">The brief</p>
                  <h2
                    ref={taskHeading}
                    tabIndex={-1}
                    id="sample-task-title"
                    className="mt-2 scroll-mt-24 font-display text-2xl outline-none"
                  >
                    {task.title}
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                    {task.brief}
                  </p>
                  <h3 className="mt-6 text-sm font-semibold">Your task</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">
                    {task.task}
                  </p>
                  <h3 className="mt-5 text-sm font-semibold">What successful completion means</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                    {task.successCriterion}
                  </p>
                  <p className="mt-5 text-xs text-muted-foreground">
                    Requested viewport: {task.viewport.width} × {task.viewport.height} CSS pixels.
                    Use that size if your browser setup allows it; note any difference below.
                  </p>
                </section>
              </aside>
              <section className="min-w-0" aria-labelledby="current-sample-title">
                <div className="border-b border-border pb-6">
                  <p className="eyebrow">One sample at a time</p>
                  <h2
                    tabIndex={-1}
                    id="current-sample-title"
                    className="mt-2 scroll-mt-24 font-display text-3xl outline-none"
                  >
                    Sample {session.currentIndex + 1}{" "}
                    <span className="text-muted-foreground">of {session.order.length}</span>
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {sample.kind === "image"
                      ? "This sample is an image. Judge what is visible; task completion and interaction are not tested."
                      : "Open the page, attempt the task, then return here to record what you observed."}
                  </p>
                  {sampleUrl && (
                    <a
                      href={sampleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
                    >
                      {sample.kind === "image" ? "Open image" : "Open sample page"}
                      <ExternalLink size={15} aria-hidden="true" />
                      <span className="sr-only"> in a new tab</span>
                    </a>
                  )}
                  {sampleUrl && (
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      {new URL(sampleUrl).hostname} · opens in a new tab
                    </p>
                  )}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    move(1);
                  }}
                >
                  {missing.length > 0 && (
                    <div
                      ref={errorRef}
                      tabIndex={-1}
                      role="alert"
                      className="mt-6 rounded-lg border border-destructive/40 p-4 text-sm outline-none"
                    >
                      <p className="font-medium">Complete these answers before continuing:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {missing.map((field) => (
                          <li key={field}>{fieldNames[field]}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <fieldset
                    className="mt-7"
                    aria-describedby={sample.kind === "image" ? "image-outcome-help" : undefined}
                  >
                    <legend className="text-base font-semibold">
                      Could you complete the task?
                    </legend>
                    {sample.kind === "image" ? (
                      <p id="image-outcome-help" className="mt-2 text-sm text-muted-foreground">
                        Recorded as “Not tested” because this is an image.
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          [
                            ["completed", "Completed"],
                            ["blocked", "Blocked"],
                            ["not-tested", "Not tested"],
                          ] as const
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${draft.taskOutcome === value ? "border-foreground bg-muted" : "border-border"}`}
                          >
                            <input
                              type="radio"
                              name="task-outcome"
                              value={value}
                              checked={draft.taskOutcome === value}
                              onChange={() =>
                                updateDraft({
                                  taskOutcome: value,
                                  ...(value === "not-tested"
                                    ? { bookingObservation: undefined }
                                    : {}),
                                })
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                  {sample.kind === "interactive" &&
                    task.observationProtocol === bookingProtocol &&
                    (draft.taskOutcome === "completed" || draft.taskOutcome === "blocked") && (
                      <BookingObservationFields
                        draft={draft.bookingObservation}
                        onChange={(bookingObservation) => updateDraft({ bookingObservation })}
                      />
                    )}
                  <div className="mt-8 border-t border-border pt-6">
                    <h3 className="font-display text-xl">How well does it work?</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Rate each dimension from 1 to 7. The descriptions at 1, 4, and 7 anchor the
                      scale; use the numbers between them when needed.
                    </p>
                    {session.packet.dimensions.map((dimension) => (
                      <fieldset
                        key={dimension.id}
                        className="mt-7 border-b border-border pb-6"
                        aria-describedby={`rating-guide-${dimension.id}`}
                      >
                        <legend className="text-sm font-semibold">{dimension.title}</legend>
                        {dimension.id === "interaction" && sample.kind === "image" ? (
                          <p
                            id={`rating-guide-${dimension.id}`}
                            className="mt-2 text-sm text-muted-foreground"
                          >
                            Not rated: interaction cannot be assessed from this image.
                          </p>
                        ) : (
                          <>
                            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                              {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                                <label
                                  key={value}
                                  className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground ${draft.quality[dimension.id] === value ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
                                >
                                  <input
                                    type="radio"
                                    className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
                                    name={`quality-${dimension.id}`}
                                    value={value}
                                    checked={draft.quality[dimension.id] === value}
                                    aria-label={`${value} of 7 for ${dimension.title}`}
                                    onChange={() =>
                                      updateDraft({
                                        quality: { ...draft.quality, [dimension.id]: value },
                                      })
                                    }
                                  />
                                  {value}
                                </label>
                              ))}
                            </div>
                            <dl
                              id={`rating-guide-${dimension.id}`}
                              className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground"
                            >
                              <div className="flex gap-2">
                                <dt className="font-mono font-semibold text-foreground">1</dt>
                                <dd>{dimension.low}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="font-mono font-semibold text-foreground">4</dt>
                                <dd>{dimension.middle}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="font-mono font-semibold text-foreground">7</dt>
                                <dd>{dimension.high}</dd>
                              </div>
                            </dl>
                          </>
                        )}
                      </fieldset>
                    ))}
                  </div>
                  <fieldset className="mt-7">
                    <legend className="text-base font-semibold">
                      What do you think made this sample?
                    </legend>
                    <p className="mt-2 text-sm text-muted-foreground">
                      This is an estimate, separate from your quality ratings.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(
                        [
                          ["person", "A person"],
                          ["generated", "AI-generated"],
                          ["unsure", "Unsure"],
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${draft.judgedOrigin === value ? "border-foreground bg-muted" : "border-border"}`}
                        >
                          <input
                            type="radio"
                            name="judged-origin"
                            value={value}
                            checked={draft.judgedOrigin === value}
                            onChange={() => updateDraft({ judgedOrigin: value })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label htmlFor="review-note" className="mt-7 block text-sm font-semibold">
                    What stood out?{" "}
                    <span className="font-normal text-muted-foreground">Optional</span>
                  </label>
                  <textarea
                    id="review-note"
                    rows={4}
                    maxLength={4000}
                    value={draft.note}
                    onChange={(event) => updateDraft({ note: event.target.value })}
                    className="mt-2 w-full rounded-md border border-input bg-card p-3 text-base leading-relaxed"
                    placeholder="Note a specific detail, anything that blocked the task, or a viewport difference."
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Keep names, emails, and other identifying details out of notes.
                  </p>
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={session.currentIndex === 0}
                      onClick={() => move(-1)}
                    >
                      <ArrowLeft size={16} /> Back
                    </Button>
                    <Button type="submit" className="min-h-11">
                      {session.currentIndex === session.order.length - 1
                        ? "Finish review"
                        : "Save & next"}
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </form>
              </section>
            </div>
            <section
              className="mt-12 flex flex-wrap items-start justify-between gap-5 border-t border-border pt-6"
              aria-label="Save and export review"
            >
              <div className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                <p>Answers and sample order are saved in this browser as you work.</p>
                <p className="mt-1">
                  Downloads include completed samples only. Nothing is sent automatically.
                </p>
              </div>
              <Button
                variant="outline"
                className="min-h-11 max-w-full whitespace-normal text-left"
                disabled={complete === 0}
                onClick={() => download(!allComplete)}
              >
                <Download size={16} />
                {allComplete
                  ? "Download all answers"
                  : `Download partial answers (${complete} of ${session.order.length})`}
              </Button>
            </section>
          </>
        ) : null}
        {session && (
          <details className="mt-10 border-t border-border pt-5 text-sm">
            <summary className="min-h-8 cursor-pointer text-muted-foreground">
              Load a different reviewer packet
            </summary>
            <label htmlFor="replacement-packet" className="mt-4 block font-medium">
              Replacement reviewer packet · JSON, up to 2 MB
            </label>
            <input
              id="replacement-packet"
              type="file"
              accept=".json,application/json"
              className="mt-2 block min-h-11 w-full min-w-0 text-sm"
              onChange={(event) => {
                void loadFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </details>
        )}
      </main>
      <ConfirmDialog
        open={pendingPacket !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPacket(null);
        }}
        title="Replace this review?"
        body="Loading another packet replaces the answers saved in this browser. Download your completed answers first if you need to keep them."
        confirmLabel="Replace review"
        onConfirm={() => {
          if (pendingPacket) begin(pendingPacket);
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Clear this review?"
        body="This removes the packet, saved order, and answers from this browser. Download your answers first if you need to keep them."
        confirmLabel="Clear review"
        onConfirm={reset}
      />
    </>
  );
}
