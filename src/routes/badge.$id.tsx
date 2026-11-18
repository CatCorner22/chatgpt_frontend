import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { getPublicBadge } from "@/lib/badge.functions";
import { badgeLabel, BADGE_MIN_SCORE } from "@/lib/badge";

export const Route = createFileRoute("/badge/$id")({
  loader: async ({ params }) => {
    const b = await getPublicBadge({ data: { id: params.id } }).catch(() => null);
    if (!b) throw notFound();
    return b;
  },
  head: ({ loaderData }) => {
    const host = loaderData ? new URL(loaderData.url).hostname : "";
    const t = loaderData ? `${host} — ${loaderData.passing ? "Crafted with Focus" : "Focus check not passing"}` : "Focus badge";
    const d = "Measured proof that this page was built from its Focus design and meets the quality bar, re-checked every week.";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: loaderData ? "index" : "noindex" }] };
  },
  notFoundComponent: () => (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-4xl">This badge doesn't exist</h1>
        <p className="mt-3 text-muted-foreground">It may have been removed by its owner.</p>
      </main>
    </div>
  ),
  component: BadgePage,
});

function BadgePage() {
  const b = Route.useLoaderData();
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { dateStyle: "long" }) : "—");
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-12 md:px-10">
        <p className="eyebrow">Public proof · re-checked every week</p>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">
          {b.passing ? "This site is Crafted with Focus" : "This site no longer passes its Focus check"}
        </h1>
        <p className="mt-3 break-all text-muted-foreground">
          <a className="underline" href={b.url} rel="nofollow noopener" target="_blank">{b.url}</a>
        </p>
        <p className="mt-4 inline-block rounded-sm border border-border bg-card px-3 py-1 text-sm">
          {badgeLabel(b.passing, b.checked_at)}
        </p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Quality score (lowest page)</dt><dd className="font-display text-3xl">{b.score ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">First issued</dt><dd>{date(b.issued_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Last checked</dt><dd>{date(b.checked_at)}</dd></div>
        </dl>
        <h2 className="mt-10 font-display text-2xl">What was measured</h2>
        <ul className="mt-3 space-y-2">
          {b.reasons.map((r) => (
            <li key={r.text} className="flex items-start gap-2">
              {r.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
              <span><span className="sr-only">{r.ok ? "Passed: " : "Failed: "}</span>{r.text}</span>
            </li>
          ))}
        </ul>
        {b.history.length > 1 && (
          <>
            <h2 className="mt-10 font-display text-2xl">Check history</h2>
            <ol className="mt-3 space-y-1 text-sm">
              {[...b.history].reverse().map((h) => (
                <li key={h.at}>{date(h.at)} · {h.passing ? "Passed" : "Did not pass"}{h.score != null ? ` · score ${h.score}` : ""}</li>
              ))}
            </ol>
          </>
        )}
        <p className="mt-10 text-sm text-muted-foreground">
          These are measurements of the live site (the address above and up to 9 pages it links to), not an opinion of its
          taste. Every one of those pages needs a signed Focus design code that matches the design, a Quality score of at least {BADGE_MIN_SCORE}, no serious problems, and all five
          Vision colors and fonts in use. Design code {b.design_id}.
        </p>
        <p className="mt-6 flex flex-wrap gap-4"><Link to="/" className="underline">Design your own site with Focus</Link><Link to="/showcase" className="underline">See other passing sites</Link></p>
      </main>
    </div>
  );
}
