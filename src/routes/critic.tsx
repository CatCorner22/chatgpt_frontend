import { focusLocalStorage } from "@/lib/browser-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { fitterBrief } from "@/lib/critic";
import { findByDesignId } from "@/lib/brands";
import { readLibrary } from "@/lib/library";

function readLibraryQuiet() {
  try {
    return typeof window === "undefined" ? [] : readLibrary();
  } catch {
    return [];
  }
}
import { STUDIO_KEY } from "@/lib/projects";
import { normalizeTokens, type Tokens } from "@/lib/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/AppHeader";
import { HelpTip, Term, WhyPopover } from "@/components/Help";
import { useCancellable, useCopied, useWait } from "@/hooks/useUx";
import { WaitLine } from "@/components/WaitLine";
import { WholeSiteCheck } from "@/components/WholeSiteCheck";
import { CHECK_CARD } from "@/lib/ux";
import { safeUrl } from "@/lib/critic";
import { critiqueUrl } from "@/lib/critic.functions";
import {
  HISTORY_KEY,
  addRun,
  clientReport,
  parseHistory,
  runsFor,
  scoreChange,
  type HistoryEntry,
} from "@/lib/report";
import { toast } from "sonner";
import { ShotReview } from "@/components/ShotReview";
import { RescuePanel } from "@/components/RescuePanel";
import { Journey } from "@/components/Journey";
import { BeforeAfter } from "@/components/BeforeAfter";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import {
  BASELINE_KEY,
  preservationComparison,
  samePage,
  matchVision,
  readBaselines,
  saveBaseline,
  type Inventory,
} from "@/lib/transfer";
import { useUser } from "@/hooks/useSession";
import { useHostedSession } from "@/components/HostedBoundary";

export const Route = createFileRoute("/critic")({
  validateSearch: (s: Record<string, unknown>): { mode?: "makeover" | "check" } => ({
    mode: s["mode"] === "makeover" ? "makeover" : "check",
  }),
  head: () => ({
    meta: [
      { title: "Check a site — Focus" },
      {
        name: "description",
        content: "Paste a public website address for measured design findings and practical fixes.",
      },
      { property: "og:title", content: "Check a site — Focus" },
      {
        property: "og:description",
        content: "Measured findings and practical fixes for a public web page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Critic,
});

type R = Awaited<ReturnType<typeof critiqueUrl>>;

function Critic() {
  const user = useUser();
  const hosted = useHostedSession();
  const canCheck = hosted ? Boolean(hosted.user) : Boolean(user);
  const { mode } = Route.useSearch();
  const run = useServerFn(critiqueUrl);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [r, setR] = useState<R | null>(null);
  const [rx, setRx] = useState<Tokens | null>(null);
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  const [baselines, setBaselines] = useState<Inventory[]>([]);
  const [baselineUrl, setBaselineUrl] = useState("");
  useEffect(() => {
    setHist(parseHistory(focusLocalStorage.getItem(HISTORY_KEY)));
    setBaselines(readBaselines(focusLocalStorage.getItem(BASELINE_KEY)));
  }, []);
  useEffect(() => {
    try {
      const raw = JSON.parse(focusLocalStorage.getItem(STUDIO_KEY) ?? "null");
      if (raw?.tokens) setRx(normalizeTokens(raw.tokens));
    } catch {
      /* no saved design */
    }
  }, []);
  const [rxName, setRxName] = useState("your current design");
  const tagged = r ? findByDesignId(r.facts.focusId, readLibraryQuiet()) : null;
  const cmp = r && rx ? matchVision(r.facts, rx) : null;
  const baseline = baselines.find((v) => v.url === baselineUrl);
  const comparable = r && baseline ? samePage(baseline, r.inventory) : false;
  const preservation =
    r && baseline && comparable ? preservationComparison(baseline, r.inventory) : null;
  const missing = preservation?.missing ?? [];
  const wait = useWait(busy, `Checking ${safeUrl(url)?.hostname ?? "the page"}`);
  const { copied, copy } = useCopied();
  const target = url.trim().length >= 4 ? safeUrl(url)?.hostname : undefined;
  const job = useCancellable();
  const review = async (u: string) => {
    const id = job.start();
    setBusy(true);
    setErr("");
    try {
      const res = await run({ data: { url: u } });
      if (!job.current(id)) return; // cancelled
      setR(res);
      setHist((h) => {
        const next = addRun(h, {
          host: res.host,
          score: res.score,
          fails: res.findings.filter((f) => !f.ok).length,
          at: new Date().toISOString(),
        });
        try {
          focusLocalStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          /* history is optional */
        }
        return next;
      });
    } catch (x) {
      if (job.current(id)) setErr((x as Error).message);
    } finally {
      if (job.current(id)) setBusy(false);
    }
  };
  const stop = () => {
    job.cancel();
    setBusy(false);
    toast("Stopped checking. Nothing was changed.");
  };
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (canCheck && !busy && url.trim().length >= 4) void review(url);
  };
  const brief = r
    ? fitterBrief(
        r.host,
        r.findings,
        cmp ? cmp.items.filter((i) => !i.ok).map((i) => i.fix) : [],
        r.review?.priorities ?? [],
      )
    : "";
  const change = r ? scoreChange(hist, r.host) : null;
  const past = r ? runsFor(hist, r.host) : [];
  const downloadReport = () => {
    if (!r) return;
    const md = clientReport({
      host: r.host,
      title: r.facts.title,
      score: r.score,
      date: new Date().toLocaleDateString(),
      findings: r.findings,
      verdict: r.review?.verdict ?? undefined,
      priorities: r.review?.priorities,
      strengths: r.review?.strengths,
      change,
      brief,
    });
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
      a.download = `design-review-${r.host}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      toast.error("Couldn't download the report. Try again.");
    }
  };
  const fails = r?.findings.filter((f) => !f.ok) ?? [];
  const passes = r?.findings.filter((f) => f.ok) ?? [];
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <Journey current={mode === "makeover" ? 0 : 3} />
      <main className="mx-auto max-w-4xl px-5 py-10 md:px-10">
        <p className="eyebrow">Check a site</p>
        <h1 className="mt-2 font-display text-5xl leading-none">
          {mode === "makeover"
            ? "Make over your existing site"
            : "Check that your site matches its design"}
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          {mode === "makeover"
            ? "Check your original page first. Save its original links, forms and fields, then create a new look below. Your live site stays unchanged."
            : "Paste a website address. We check its declared design values and name the fixes that matter most."}
        </p>
        <form onSubmit={go} className="mt-6 flex max-w-xl gap-2">
          <Input
            aria-label="Website address"
            placeholder="yourbusiness.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            type="submit"
            className="min-w-28"
            disabled={!canCheck || busy || url.trim().length < 4}
          >
            {busy ? "Checking…" : "Check this page"}
          </Button>
        </form>
        {!canCheck && hosted?.mode === "preview" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Public website checks need sign-in on the hosted app. The local design tools remain
            available here.
          </p>
        )}
        {!canCheck && hosted?.mode !== "preview" && (
          <Button asChild variant="link" className="mt-2">
            <Link to="/auth" search={{ next: "/critic" }}>
              Sign in to check a site
            </Link>
          </Button>
        )}
        {busy && wait?.canCancel ? (
          <WaitLine wait={wait} onCancel={stop} />
        ) : (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {busy
              ? (wait?.text ?? "Starting…")
              : target
                ? `Will check ${target}`
                : "Type an address like stripe.com — no need for https://"}
          </p>
        )}
        {err && (
          <div role="alert" className="mt-3 rounded-sm border border-destructive p-3 text-sm">
            <p>{err}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => void review(url)}>
              Try again
            </Button>
          </div>
        )}
        {!r && !busy && (
          <div className="mt-10 rounded-sm border border-dashed border-border p-6 text-sm">
            <p className="font-medium">Not sure where to start? Try a well-known page:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["stripe.com", "gov.uk", "example.com"].map((x) => (
                <Button
                  key={x}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUrl(x);
                    void review(x);
                  }}
                >
                  {x}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-muted-foreground">
              You'll get a score, the three fixes that matter most, and a{" "}
              <Term term="fitter">repair brief</Term> to paste into your AI builder.
            </p>
          </div>
        )}
        {!r && <ShotReview rx={rx} />}
        <WholeSiteCheck url={url} />
        {r && (
          <section className="mt-10 space-y-8">
            <div className="flex items-end gap-6 border-b border-border pb-6">
              <div>
                <p className="eyebrow">
                  <Term term="floor">Quality score</Term>
                </p>
                <p className="font-display text-7xl leading-none">{r.score}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="text-foreground">{r.facts.title || r.host}</p>
                <p>
                  {fails.length} issues · {passes.length} passes · ~{r.facts.words} words
                </p>
                {change ? (
                  <p className={change.delta >= 0 ? "text-foreground" : "text-destructive"}>
                    Before → after: {change.before} → {change.after} ({change.delta >= 0 ? "+" : ""}
                    {change.delta}) since your last review
                  </p>
                ) : (
                  <p>
                    First review of this site — review it again after changes to see before and
                    after.
                  </p>
                )}
                {past.length > 1 && (
                  <p aria-label="Earlier scores">
                    Earlier scores:{" "}
                    {past
                      .slice(0, -1)
                      .map((e) => e.score)
                      .join(" · ")}
                  </p>
                )}
                {r.facts.colors.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {r.facts.colors.slice(0, 14).map((c) => (
                      <HelpTip key={c} tip={`Color ${c} found on the page`}>
                        <span
                          tabIndex={0}
                          aria-label={`Color ${c}`}
                          className="h-4 w-4 rounded-sm border border-border"
                          style={{ background: c }}
                        />
                      </HelpTip>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {r.review ? (
              <div className="space-y-5">
                <p className="font-display text-2xl leading-snug">{r.review.verdict}</p>
                <ol className="space-y-4">
                  {r.review.priorities.map((p, i) => (
                    <li key={i} className="rounded-sm border border-border bg-card p-4">
                      <p className="font-semibold">
                        {i + 1}. {p.title.replace(/^\d+[.)]\s*/, "")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{p.why}</p>
                      <p className="mt-2 text-sm">
                        <span className="font-semibold">Fix: </span>
                        {p.fix}
                      </p>
                    </li>
                  ))}
                </ol>
                {r.review.strengths.length > 0 && (
                  <div>
                    <p className="eyebrow">Keep</p>
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {r.review.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The art director review is unavailable right now; the measured findings below still
                apply.
              </p>
            )}
            {r.facts.focusId && (
              <div
                className="rounded-sm border border-border bg-card p-4"
                aria-label="Focus design tag"
              >
                <p className="eyebrow">Says it was built from a Focus design</p>
                <p className="mt-1 text-sm">
                  This page carries the hidden tag <code>{r.facts.focusId}</code>.{" "}
                  {tagged
                    ? `It matches “${tagged.title}” in your saved designs.`
                    : "No design in this browser has that code — it may be someone else's, or a design whose values have changed since it was exported."}
                </p>
                <p className="mt-2 text-sm text-muted-foreground" aria-label="Signature check">
                  {r.facts.stamp === "signed"
                    ? "Signature checked: this tag was issued by Focus."
                    : r.facts.stamp === "forged"
                      ? "Signature does not match: this tag was changed or copied by hand, so it proves nothing."
                      : "No signature: this tag is a label only, and anyone could have added it."}
                </p>
                {tagged && rxName !== tagged.title && (
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setRx(normalizeTokens(tagged.state.tokens));
                      setRxName(tagged.title);
                    }}
                  >
                    Compare with this design
                  </Button>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Anyone can copy a tag, so the measured match below is the real evidence.
                </p>
              </div>
            )}
            {cmp && (
              <div className="rounded-sm border border-border bg-card p-4">
                <p className="eyebrow">Matches your design · {rxName}</p>
                <p className="mt-1 font-display text-3xl">
                  {cmp.matched} of {cmp.items.length} declared values found
                </p>
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {cmp.items.map((i) => (
                    <li key={i.name} className={i.ok ? "" : "text-destructive"}>
                      {i.ok ? "Declared value found" : i.known ? "Different" : "Not measured"} ·{" "}
                      {i.name}: {i.expected}
                      {!i.ok && (
                        <Button size="sm" variant="link" onClick={() => void copy(i.name, i.fix)}>
                          {copied === i.name ? "Copied ✓" : "Copy exact fix"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-muted-foreground">
                  These values were found in downloaded HTML/CSS, not measured on the rendered
                  screen. Up to four linked stylesheets are read, with size limits. Unreadable or
                  omitted styles remain unverified. Finding a value does not prove it is applied
                  correctly.
                </p>
              </div>
            )}
            {!cmp && (
              <p className="text-sm text-muted-foreground">
                Open a saved Vision in this browser to compare its design values.
              </p>
            )}
            <section
              className="space-y-3 border-y border-border py-5"
              aria-label="Feature preservation"
            >
              <h2 className="font-display text-2xl">Compare original public links and forms</h2>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    if (!saveBaseline(r.inventory)) throw new Error("storage");
                    setBaselines(readBaselines(focusLocalStorage.getItem(BASELINE_KEY)));
                    setBaselineUrl(r.inventory.url);
                    toast("Saved this page's original links, forms and fields in this browser.");
                  } catch {
                    toast.error(
                      "Couldn't save the original page in this browser. Private browsing or full storage can block it; nothing was replaced.",
                    );
                  }
                }}
              >
                Save this as the original page
              </Button>
              <label className="block text-sm">
                Compare with an original page
                <select
                  className="mt-1 min-h-11 w-full rounded-sm border border-input bg-background px-2"
                  value={baselineUrl}
                  onChange={(e) => setBaselineUrl(e.target.value)}
                >
                  <option value="">Choose a saved original</option>
                  {baselines.map((v) => (
                    <option key={v.url} value={v.url}>
                      {v.url}
                    </option>
                  ))}
                </select>
              </label>
              {baseline && !comparable && (
                <p role="alert" className="text-sm text-destructive">
                  Choose the original of this same page path. Different pages cannot prove
                  preservation.
                </p>
              )}
              {baseline && comparable && (
                <div role="status">
                  <p className={missing.length ? "text-destructive" : "text-foreground"}>
                    {preservation?.message}
                  </p>
                  {preservation && !preservation.complete && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      One source was truncated, exceeded the inventory limits, or was saved before
                      completeness was recorded. Recheck the original and test the full visitor
                      tasks before accepting the restyle.
                    </p>
                  )}
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {missing.map((v) => (
                      <li key={`${v.kind}:${v.value}`}>
                        {v.kind}: {v.value}
                      </li>
                    ))}
                  </ul>
                  {missing.length > 0 && (
                    <Button
                      className="mt-2"
                      variant="outline"
                      onClick={() =>
                        void copy(
                          "preserve",
                          `Restore these original items without altering behavior:\n${missing.map((v) => `${v.kind}: ${v.value}`).join("\n")}\nRerun original visitor tasks, validation and permissions; preserve all unrelated work.`,
                        )
                      }
                    >
                      {copied === "preserve" ? "Copied ✓" : "Copy preservation fix"}
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Check and save the original before changing it, then check the same page after. This
                is a public source inventory, not a browser DOM or interaction check. Unseen pages,
                private screens and working actions still need task tests. Nothing edits your site.
              </p>
            </section>
            <BeforeAfter />
            <RescuePanel key={r.source.url} source={r.source} inventory={r.inventory} />
            <AdvisorPanel
              target={r.source.url}
              summary={
                r.review?.verdict ?? "Measured findings only; art director opinion unavailable."
              }
              priorities={
                r.review?.priorities ??
                fails.slice(0, 3).map((f) => ({ title: f.area, why: f.detail, fix: f.fix }))
              }
              brief={brief}
              measured
            />
            <div>
              <p className="eyebrow">Measured findings</p>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {[...fails, ...passes].map((f) => (
                  <li key={f.id} className="grid gap-1 py-3 text-sm md:grid-cols-[7rem_1fr]">
                    <span
                      className={
                        f.ok
                          ? "text-muted-foreground"
                          : f.possible
                            ? "font-semibold text-foreground"
                            : "font-semibold text-destructive"
                      }
                    >
                      {f.ok
                        ? "Pass"
                        : f.possible
                          ? "Possible issue (not scored)"
                          : f.severity === "high"
                            ? "Fix first"
                            : "Improve"}{" "}
                      · {f.area}
                    </span>
                    <span>
                      {f.detail}{" "}
                      {CHECK_CARD[f.id] && <WhyPopover cardId={CHECK_CARD[f.id] ?? ""} />}
                      {!f.ok && <span className="block text-muted-foreground">{f.fix}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card p-4">
              <div>
                <p className="font-semibold">Client report</p>
                <p className="text-sm text-muted-foreground">
                  Score, before/after, top fixes and the repair brief in one file you can send to a
                  client.
                </p>
              </div>
              <Button variant="outline" onClick={downloadReport}>
                Download report
              </Button>
            </div>
            {brief && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="eyebrow">Fitter</p>
                    <p className="font-display text-2xl">Repair brief for your AI builder</p>
                  </div>
                  <Button className="min-w-44" onClick={() => void copy("brief", brief)}>
                    {copied === "brief" ? "Copied ✓" : "Copy repair brief"}
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-sm border border-border bg-card p-4 font-mono text-xs whitespace-pre-wrap">
                  {brief}
                </pre>
              </div>
            )}
            <div className="rounded-sm border border-border bg-card p-5">
              <p className="font-display text-2xl">Want a version that passes?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Answer eight quick questions in Focus and hand your AI builder a Vision with these
                floors built in.
              </p>
              <Button asChild className="mt-3">
                <Link to="/">Start designing</Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
