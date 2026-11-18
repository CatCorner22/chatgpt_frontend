import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { ownerCounts } from "@/lib/northstar.functions";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "North Star counts — Focus" },
      { name: "description", content: "Visions completed each week and badge results, for the Focus owner." },
      { property: "og:title", content: "North Star counts — Focus" },
      { property: "og:description", content: "Owner-only counts for Focus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Owner,
});

function Owner() {
  const get = useServerFn(ownerCounts);
  const q = useQuery({ queryKey: ["owner-counts"], queryFn: () => get() });
  const d = q.data;
  const max = Math.max(1, ...(d?.weeks ?? []).map((w) => w.visions));
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-5 py-12 md:px-10">
        <p className="eyebrow">Owner only · no names or emails</p>
        <h1 className="mt-2 font-display text-5xl">Design Visions completed each week</h1>
        {q.isLoading ? (
          <p className="mt-6" role="status">Loading the counts…</p>
        ) : !d ? (
          <p className="mt-6">This page is only for the Focus owner's account.</p>
        ) : (
          <>
            <ol className="mt-8 space-y-2" aria-label="Visions per week">
              {d.weeks.length ? d.weeks.map((w) => (
                <li key={w.week} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
                  <span>Week of {w.week}</span>
                  <span className="h-3 rounded-sm bg-accent" style={{ width: `${(w.visions / max) * 100}%` }} aria-hidden />
                  <span className="text-right font-medium">{w.visions}</span>
                </li>
              )) : <li>No Visions completed yet.</li>}
            </ol>
            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Badges issued</dt><dd className="font-display text-3xl">{d.badges}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Still passing</dt><dd className="font-display text-3xl">{d.passing}{d.badges ? ` (${Math.round((d.passing / d.badges) * 100)}%)` : ""}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Lost their badge</dt><dd className="font-display text-3xl">{d.lost}</dd></div>
            </dl>
            <p className="mt-6 text-xs text-muted-foreground">Counts only signed-in people; each design counts once.</p>
          </>
        )}
      </main>
    </div>
  );
}
