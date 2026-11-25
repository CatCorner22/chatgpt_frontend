import { focusLocalStorage } from "@/lib/browser-storage";
import type { State } from "@/lib/studio-state";
import { AI_SPENDING_ENABLED } from "@/lib/ai-policy";
import { hasCloudBackend } from "@/lib/runtime-config";
import { buildLocalOptions } from "@/lib/local-design";
import { WaitLine } from "@/components/WaitLine";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { HelpTip, Term, WhyPopover } from "@/components/Help";
import { useLeaveGuard, useWait } from "@/hooks/useUx";
import { CHECK_CARD, isTypingTarget } from "@/lib/ux";
import { toast } from "sonner";
import { PreviewFrame } from "@/components/DesignPreview";
import { NUDGES, applyNudges } from "@/lib/refine";
import { readExamOptionDraft, type ExamOptionDraft } from "@/lib/exam-option-draft";
import { TASTE_KEY, parseTaste, tasteText } from "@/lib/taste";
import { readProfile, profileText } from "@/lib/portrait";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STEPS, afterAnswer, questionCount, type Tokens } from "@/lib/design";
import { proposeStep } from "@/lib/design.functions";
import { affectedSteps, fixContrast, measuredChecks, rankOptions } from "@/lib/engine";
import { cardFor } from "@/lib/knowledge";
import { useDesignFonts } from "@/lib/useDesignFonts";
import { purposeText, type StudioStageProps } from "./stage";

export function Exam({ s, update }: StudioStageProps) {
  const step = STEPS[s.stepIndex]!;
  const run = useServerFn(proposeStep);
  const cached = s.cache[step.id];
  const hasOptions = !!cached;
  const [taste, setTaste] = useState("");
  useEffect(() => {
    setTaste(
      [profileText(readProfile()), tasteText(parseTaste(focusLocalStorage.getItem(TASTE_KEY)))]
        .filter(Boolean)
        .join("; "),
    );
  }, []);
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
  // An Undo can change the request's design while its question and empty cache stay
  // the same. Track source values, not object identities or the generated response.
  // Taste hydrates once on mount; that optional context must not restart a paid call.
  const optionContext = JSON.stringify([
    s.libraryId,
    s.stepIndex,
    s.tokens,
    s.purpose,
    s.brief,
    s.picks,
  ]);

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
    setErr("");
    if (!hasOptions) void load();
    else setBusy(false);
    const requests = req;
    return () => {
      requests.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionContext, hasOptions]);

  const ranked = cached
    ? rankOptions(
        s.purpose,
        cached.map((o) => ({
          ...o,
          draft: readExamOptionDraft(o.draft),
          tokens: s.fix ? fixContrast(o.tokens) : o.tokens,
        })),
      )
    : null;
  const opts = ranked?.list ?? null;
  const sel = Math.max(0, opts?.findIndex((option) => option.draft !== undefined) ?? -1);
  const selected = opts?.[sel];
  const reason = selected?.draft?.reason ?? "";
  const tw = selected?.draft?.nudges ?? [];
  function saveDraft(position: number, draft: ExamOptionDraft) {
    const sourceIndex = opts?.[position]?.i;
    if (!cached || sourceIndex === undefined) return;
    update({
      cache: {
        ...s.cache,
        [step.id]: cached.map(({ draft: _previous, ...option }, index) =>
          index === sourceIndex ? { ...option, draft } : option,
        ),
      },
    });
  }
  const setSel = (i: number) => saveDraft(i, { reason, nudges: [] });
  const base0 = selected?.tokens;
  const shown = base0 ? (tw.length ? applyNudges(base0, tw) : base0) : s.tokens!;
  useDesignFonts([s.tokens, ...(opts ?? []).map((o) => o.tokens)]);

  const commit = (o: (typeof opts extends (infer X)[] | null ? X : never) | null) => {
    const next = s.stepIndex + 1;
    const changed = !!o && JSON.stringify(o.tokens) !== JSON.stringify(s.tokens);
    // A change invalidates cached options for later Lenses and flags the ones that depend on it.
    const cache = { ...s.cache };
    if (cached) cache[step.id] = cached.map(({ draft: _previous, ...option }) => option);
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
      cache: {},
    });
  };
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
                  onClick={() => saveDraft(sel, { reason, nudges: [...tw, n.id].slice(-6) })}
                >
                  {n.label}
                </Button>
              ))}
              {tw.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => saveDraft(sel, { reason, nudges: [] })}
                >
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
              onChange={(e) => saveDraft(sel, { reason: e.target.value, nudges: tw })}
              maxLength={140}
              placeholder="What do you like about it? (optional)"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={back}>
                {s.stepIndex > 0 ? "Revisit previous answer" : "Back to directions"}
              </Button>
              <Button variant="ghost" onClick={() => commit(null)}>
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  commit(
                    selected
                      ? {
                          ...selected,
                          tokens: shown,
                          label: tw.length
                            ? `${selected.label}, ${tw.map((n) => n.toLowerCase()).join(", ")}`
                            : selected.label,
                        }
                      : null,
                  )
                }
              >
                Choose {sel + 1}
              </Button>
            </div>
            {s.stepIndex > 0 && (
              <p className="text-xs text-muted-foreground">
                Revisiting restores the design from before the previous answer. Undo can bring your
                current design back.
              </p>
            )}
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
              Tip: press 1, 2 or 3 to compare · ← to revisit the previous answer
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
