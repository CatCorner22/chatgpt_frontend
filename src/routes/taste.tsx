import { focusLocalStorage } from "@/lib/browser-storage";
import { TASTE_KEY, parseTaste, styleSoFar } from "@/lib/taste";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DesignPreview } from "@/components/DesignPreview";
import { proposePortrait } from "@/lib/design.functions";
import {
  DUELS,
  EMPTY_PROFILE,
  PORTRAIT_KEY,
  duelPair,
  preferenceTokens,
  profileText,
  parseProfile,
  voteLabel,
  type TasteProfile,
  type DuelVote,
} from "@/lib/portrait";
import { useDraftExitSave } from "@/hooks/useDraftExitSave";
import { GALLERY } from "@/lib/gallery";
import { useDesignFonts } from "@/lib/useDesignFonts";
import { downloadBlob } from "@/lib/exportPack";
import { AI_SPENDING_ENABLED, AI_PAUSED_MESSAGE } from "@/lib/ai-policy";

export const Route = createFileRoute("/taste")({
  head: () => ({
    meta: [
      { title: "Taste Portrait & Design Duel — Focus" },
      {
        name: "description",
        content:
          "Turn personal inspirations into a design language and compare your preferences one visual decision at a time.",
      },
      { property: "og:title", content: "Your design taste — Focus" },
      {
        property: "og:description",
        content: "An explainable Taste Portrait and side-by-side Design Duels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Taste,
});
const CONTENT = {
  brand: "Your world",
  headline: "Make room for what matters.",
  sub: "Thoughtful work, made with care. A place to find your next favorite thing.",
  cta: "Explore the collection",
  features: [
    { title: "Made with intent", body: "Small details. Lasting impressions." },
    { title: "A personal touch", body: "Something worth coming back for." },
    { title: "Room to discover", body: "Find a little unexpected delight." },
  ],
  quote: "",
};
const BASE = GALLERY[0]?.direction.tokens;

function Taste() {
  const run = useServerFn(proposePortrait);
  const [p, setP] = useState<TasteProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [round, setRound] = useState(0);
  const [saveIssue, setSaveIssue] = useState("");
  const pending = useRef<TasteProfile | null>(null);
  const snapshot = useRef<string | null | undefined>(undefined);
  const latest = useRef<TasteProfile>(EMPTY_PROFILE);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = focusLocalStorage.getItem(PORTRAIT_KEY);
      if (raw !== null && JSON.parse(raw)?.version !== 1) throw new Error();
      const prior = parseProfile(raw);
      snapshot.current = raw;
      latest.current = prior;
      setP(prior);
      const resumed = DUELS.findIndex((duel) => duel.id === prior.draftReasons?.at(-1)?.id);
      setRound(resumed < 0 ? prior.votes.length : resumed);
      setLoaded(true);
    } catch {
      setSaveIssue(
        "Your saved taste profile could not be opened. Reload after checking browser storage.",
      );
    }
    return () => {
      mounted.current = false;
    };
  }, []);
  function persist(next: TasteProfile) {
    try {
      const value = JSON.stringify(next);
      const raw = focusLocalStorage.getItem(PORTRAIT_KEY);
      if (raw !== value) {
        if (snapshot.current === undefined || raw !== snapshot.current) {
          setSaveIssue("Your taste profile changed elsewhere. Copy your edits before reloading.");
          return false;
        }
        focusLocalStorage.setItem(PORTRAIT_KEY, value);
        if (focusLocalStorage.getItem(PORTRAIT_KEY) !== value) throw new Error();
      }
      snapshot.current = value;
      latest.current = next;
      pending.current = null;
      setP(next);
      setSaveIssue("");
      return true;
    } catch {
      setSaveIssue(
        "Focus couldn’t save your latest taste edits. Keep this page open, check browser storage and try saving again.",
      );
      return false;
    }
  }
  function edit(next: TasteProfile) {
    pending.current = next;
    latest.current = next;
    setP(next);
  }
  const flush = () => pending.current === null || persist(pending.current);
  useDraftExitSave(flush);
  const generate = async () => {
    if (!AI_SPENDING_ENABLED) {
      setErr(AI_PAUSED_MESSAGE);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const portrait = await run({ data: { inspiration: p.inspiration, avoid: p.avoid } });
      if (!mounted.current) return;
      const next = { ...latest.current, portrait };
      if (persist(next)) toast.success("Taste Portrait saved in this browser");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create your portrait.");
    } finally {
      setBusy(false);
    }
  };
  const base = BASE ? preferenceTokens(p, BASE) : null;
  const duel = DUELS[round];
  const reason =
    p.draftReasons?.find((draft) => draft.id === duel?.id)?.text ??
    p.votes.find((vote) => vote.id === duel?.id)?.reason ??
    "";
  const pair = base && duel ? duelPair(base, duel.id) : null;
  useDesignFonts([base, ...(pair ?? [])]);
  const vote = (choice: DuelVote["choice"]) => {
    if (!duel) return;
    const next = {
      ...p,
      draftReasons: p.draftReasons?.filter((draft) => draft.id !== duel.id) ?? [],
      votes: [
        ...p.votes.filter((v) => v.id !== duel.id),
        { id: duel.id, choice, reason: reason.trim() },
      ],
    };
    if (persist(next)) {
      setRound(round + 1);
    }
  };
  const reset = () => {
    const before = p;
    if (persist({ ...p, votes: [], draftReasons: [] })) {
      setRound(0);
      toast("Comparisons reset", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            if (
              mounted.current &&
              persist({
                ...latest.current,
                votes: before.votes,
                draftReasons: before.draftReasons ?? [],
              })
            )
              setRound(before.votes.length);
          },
        },
      });
    }
  };
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <p className="eyebrow">My taste</p>
        <h1 className="mt-3 font-display text-5xl">Find out which looks you like best</h1>
        {saveIssue && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {saveIssue}
          </p>
        )}
        <StyleSoFar />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <section aria-labelledby="portrait-title">
            <h2 id="portrait-title" className="font-display text-3xl">
              Taste Portrait
            </h2>
            <label htmlFor="inspirations" className="mt-5 block text-sm font-medium">
              What do you love?
            </label>
            <Textarea
              id="inspirations"
              className="mt-2"
              rows={5}
              maxLength={2000}
              disabled={busy || !loaded}
              value={p.inspiration}
              onChange={(e) => edit({ ...latest.current, inspiration: e.target.value })}
              placeholder="Music, places, objects, films, textures…"
            />
            <label htmlFor="avoid" className="mt-4 block text-sm font-medium">
              What feels wrong for you? (optional)
            </label>
            <Textarea
              id="avoid"
              className="mt-2"
              rows={2}
              maxLength={500}
              disabled={busy || !loaded}
              value={p.avoid}
              onChange={(e) => edit({ ...latest.current, avoid: e.target.value })}
              placeholder="Bland beige, loud gradients, crowded screens…"
            />
            <Button
              className="mt-5"
              disabled={
                busy || !loaded || (AI_SPENDING_ENABLED && p.inspiration.trim().length < 10)
              }
              onClick={() => {
                if (AI_SPENDING_ENABLED) void generate();
                else if (persist(p)) toast.success("Inspirations saved in this browser");
              }}
            >
              {!AI_SPENDING_ENABLED
                ? "Save my inspirations"
                : busy
                  ? "Finding your design language…"
                  : p.portrait
                    ? "Update portrait"
                    : "Create my portrait"}
            </Button>
            {!AI_SPENDING_ENABLED && (
              <p className="mt-3 text-sm text-muted-foreground">
                AI portraits are paused. Save your inspirations here and use the comparisons below
                to refine your preferences.
              </p>
            )}
            {err && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {err}
              </p>
            )}
          </section>
          <section aria-label="Your portrait" className="min-w-0">
            {p.portrait ? (
              <>
                <p className="eyebrow">Inspired by your words · AI interpretation</p>
                <h2 className="mt-2 font-display text-4xl">{p.portrait.name}</h2>
                <p className="mt-3 text-muted-foreground">{p.portrait.summary}</p>
                <dl className="mt-5 divide-y divide-border">
                  {p.portrait.influences.map((i, n) => (
                    <div key={n} className="py-3">
                      <dt className="font-medium">
                        {i.source} <span className="text-accent">→</span> {i.choice}
                      </dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{i.why}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <p className="eyebrow">Before you choose</p>
                <h2 className="mt-2 font-display text-3xl">A starting point, not a label.</h2>
              </>
            )}
            {base && (
              <div
                className="mt-5 h-72 overflow-hidden border border-border"
                aria-label="Portrait preview"
              >
                <DesignPreview t={base} c={CONTENT} compact />
              </div>
            )}
          </section>
        </div>
        <section className="mt-14 border-t border-border pt-8" aria-labelledby="duel-title">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">
                {duel ? `Comparison ${round + 1} of ${DUELS.length}` : "Your preferences"}
              </p>
              <h2 id="duel-title" className="mt-2 font-display text-4xl">
                Design Duel{duel ? ` · ${duel.title}` : " · In focus"}
              </h2>
            </div>
            <Button variant="ghost" onClick={reset} disabled={!p.votes.length}>
              <RotateCcw />
              Start comparisons again
            </Button>
          </div>
          {duel && pair ? (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {pair.map((t, i) => (
                  <article
                    key={`${duel.id}-${i}`}
                    className="min-w-0 overflow-hidden rounded-sm border border-border bg-card"
                  >
                    <div className="h-80 overflow-hidden">
                      <DesignPreview t={t} c={CONTENT} compact />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                      <h3 className="text-sm font-medium">{i === 0 ? duel.a : duel.b}</h3>
                      <Button onClick={() => vote(i === 0 ? "a" : "b")}>
                        Choose {i === 0 ? "A" : "B"}
                        <ArrowRight />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              <label htmlFor="duel-reason" className="mt-5 block text-sm">
                What draws you to it? (optional)
              </label>
              <Textarea
                id="duel-reason"
                rows={2}
                maxLength={300}
                className="mt-2 max-w-xl"
                value={reason}
                disabled={!loaded}
                onChange={(event) => {
                  const draftReasons = (latest.current.draftReasons ?? []).filter(
                    (draft) => draft.id !== duel.id,
                  );
                  edit({
                    ...latest.current,
                    draftReasons: [...draftReasons, { id: duel.id, text: event.target.value }],
                  });
                }}
              />
              <div className="mt-4 flex gap-3">
                <Button
                  variant="outline"
                  disabled={round === 0}
                  onClick={() => {
                    setRound(round - 1);
                  }}
                >
                  <ArrowLeft />
                  Previous
                </Button>
                <Button variant="ghost" onClick={() => vote("tie")}>
                  No preference
                </Button>
              </div>
            </>
          ) : (
            <>
              <ul className="mt-5 divide-y divide-border">
                {p.votes.map((v) => (
                  <li key={v.id} className="flex items-start gap-3 py-3">
                    <Check className="mt-1 size-4 shrink-0 text-accent" />
                    <div>
                      <p className="font-medium">{voteLabel(v)}</p>
                      {v.reason && <p className="text-sm text-muted-foreground">{v.reason}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/" search={{ view: "studio" }}>
                    Return to my design
                    <ArrowRight />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    try {
                      downloadBlob(
                        new Blob([profileText(p)], { type: "text/markdown" }),
                        "my-design-taste.md",
                      );
                    } catch {
                      toast.error("Could not download your taste portrait.");
                    }
                  }}
                >
                  <Download />
                  Download my taste
                </Button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

// "Your style so far": built only from this browser's completed choices; passed-badge choices rank first.
function StyleSoFar() {
  const [rows, setRows] = useState<ReturnType<typeof styleSoFar>>([]);
  useEffect(() => {
    try {
      setRows(styleSoFar(parseTaste(focusLocalStorage.getItem(TASTE_KEY))));
    } catch {
      // Optional suggestions require readable local storage.
    }
  }, []);
  if (!rows.length) return null;
  return (
    <section
      aria-labelledby="sofar-title"
      className="mt-8 rounded-sm border border-border bg-card p-5"
    >
      <h2 id="sofar-title" className="font-display text-2xl">
        Your style so far
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your most chosen answer for each question. Choices used on a site that passed its badge
        count first, and new designs lean toward them.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.step} className="text-sm">
            <span className="text-muted-foreground">{r.step}:</span>{" "}
            <span className="font-medium">{r.label}</span>{" "}
            <span className="text-muted-foreground">
              · chosen {r.times} {r.times === 1 ? "time" : "times"}
              {r.passed ? ` · on ${r.passed} passing ${r.passed === 1 ? "site" : "sites"}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
