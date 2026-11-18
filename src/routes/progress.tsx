import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useSession";
import { readProgress, parseDetails, weeklyTotals, type ProgressRecord } from "@/lib/launch";
import { listProgress } from "@/lib/launch.functions";
export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Launch progress — Focus" },
      {
        name: "description",
        content: "Your private weekly design completions and evidence-backed launch records.",
      },
      { property: "og:title", content: "Launch progress — Focus" },
      {
        property: "og:description",
        content: "Track completed designs and reviewed launches without counting repeat edits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Progress,
});
function Progress() {
  const user = useUser();
  const list = useServerFn(listProgress);
  const [local, setLocal] = useState<ProgressRecord[]>([]);
  const [now, setNow] = useState("");
  useEffect(() => {
    try {
      setLocal(readProgress());
    } catch {
      setLocal([]);
    }
    setNow(new Date().toISOString());
  }, []);
  const account = useQuery({
    queryKey: ["launch-progress", user?.id],
    enabled: !!user,
    queryFn: () => list(),
  });
  const merged = new Map(local.map((r) => [r.id, r]));
  for (const row of account.data ?? []) {
    if (!merged.has(row.design_id))
      merged.set(row.design_id, {
        id: row.design_id,
        title: row.title,
        completedAt: row.completed_at,
        fingerprint: row.fingerprint,
        details: parseDetails(row.details),
      });
  }
  const records = [...merged.values()];
  const totals = now ? weeklyTotals(records, now) : { completed: 0, launched: 0 };
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 md:px-10">
        <p className="eyebrow">Progress · only you can see this</p>
        <h1 className="mt-2 font-display text-5xl">Your finished designs and launched sites</h1>
        <div className="mt-8 grid gap-6 border-y border-border py-6 sm:grid-cols-2">
          <div>
            <p className="font-display text-6xl">{totals.completed}</p>
            <p>Visions completed</p>
          </div>
          <div>
            <p className="font-display text-6xl">{totals.launched}</p>
            <p>Launches recorded with review evidence</p>
          </div>
        </div>
        {account.error && (
          <p role="alert" className="mt-4 text-destructive">
            Could not load account records. Browser progress is still shown.
          </p>
        )}
        <ul className="mt-6 divide-y divide-border">
          {records.map((r) => (
            <li key={r.id} className="py-4">
              <h2 className="font-display text-2xl">{r.title}</h2>
              <p className="text-sm text-muted-foreground">
                {r.details.status} · {r.details.reviews.length} review attempts
              </p>
              {r.details.url && <p className="mt-1 break-all text-sm">{r.details.url}</p>}
            </li>
          ))}
        </ul>
        {!records.length && <p className="mt-8">No completed designs yet.</p>}
        <Button asChild className="mt-6" variant="outline">
          <Link to="/library">Open my design library</Link>
        </Button>
        <p className="mt-6 text-xs text-muted-foreground">
          Each design counts once. Browser records stay on this device; account records require
          saving. Launches are owner-confirmed, not human design certification.
        </p>
      </main>
    </div>
  );
}
