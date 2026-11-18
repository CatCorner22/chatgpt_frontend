import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { BrandLogo } from "@/components/BrandArt";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useSession";
import { parseDetails, weeklyTotals, TASKS, type ProgressRecord } from "@/lib/launch";
import { listProgress } from "@/lib/launch.functions";
import { horizonGuidance, readHorizonProgress } from "@/lib/horizon";
import { hasCloudBackend } from "@/lib/runtime-config";
export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Horizon — project progress in Focus" },
      {
        name: "description",
        content: "Your project progress, saved review records, and practical next steps.",
      },
      { property: "og:title", content: "Horizon — Focus" },
      {
        property: "og:description",
        content:
          "See the next step for each design, from a completed Vision to an owner-recorded launch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Horizon,
});
export function Horizon() {
  const user = useUser();
  const cloud = hasCloudBackend();
  const list = useServerFn(listProgress);
  const [local, setLocal] = useState<ProgressRecord[]>([]);
  const [localState, setLocalState] = useState<"loading" | "ready" | "error" | "invalid">(
    "loading",
  );
  const [now, setNow] = useState("");
  const loadLocal = useCallback(() => {
    const result = readHorizonProgress();
    if (!result.issue) {
      setLocal(result.records);
      setLocalState("ready");
    } else {
      // Keep the last readable snapshot; a failed read is not an empty library.
      if (result.records.length) setLocal(result.records);
      setLocalState(result.issue === "invalid" ? "invalid" : "error");
    }
    setNow(new Date().toISOString());
  }, []);
  useEffect(loadLocal, [loadLocal]);
  const account = useQuery({
    queryKey: ["launch-progress", user?.id],
    enabled: cloud && !!user,
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
  const accountLoading = cloud && !!user && account.isPending;
  const partial = localState !== "ready" || Boolean(account.error) || accountLoading;
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-5xl px-5 py-10 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0 max-w-2xl flex-1 basis-80">
            <p className="eyebrow">Your next step, in view</p>
            <h1 className="mt-2 font-display text-5xl">Horizon</h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Project progress and practical next steps. Pick up a completed Vision, review the
              evidence, and keep moving with care.
            </p>
          </div>
          <BrandLogo variant="horizon" decorative />
        </div>
        <section
          aria-labelledby="horizon-week-heading"
          className="mt-8 border-y border-border py-6"
        >
          <h2 id="horizon-week-heading" className="eyebrow">
            This week · Monday–Sunday (UTC)
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-display text-6xl">{partial ? "—" : totals.completed}</p>
              <p>Visions completed</p>
            </div>
            <div>
              <p className="font-display text-6xl">{partial ? "—" : totals.launched}</p>
              <p>Launches recorded by owners</p>
            </div>
          </div>
          {partial && (
            <p className="mt-3 text-xs text-muted-foreground">
              Weekly totals are unavailable until the progress records can be loaded.
            </p>
          )}
        </section>
        {(localState === "error" || localState === "invalid") && (
          <section
            aria-label="Browser progress needs a retry"
            className="mt-5 rounded-xl border border-destructive/40 bg-card p-4"
          >
            <p role="alert" className="text-sm">
              {localState === "invalid"
                ? "Browser progress contains unreadable data. The original saved data has not been changed. Any readable records are shown; this list may be incomplete."
                : "Browser progress could not be read. Your saved data has not been cleared or replaced. Any records already shown remain the last readable copy."}
            </p>
            <Button className="mt-3" variant="outline" onClick={loadLocal}>
              Retry browser progress
            </Button>
          </section>
        )}
        {account.error && (
          <section className="mt-4 rounded-xl border border-border p-4">
            <p role="alert" className="text-sm">
              Account records could not be loaded. Any readable browser records are still shown;
              this list may be incomplete.
            </p>
            <Button variant="outline" className="mt-3" onClick={() => void account.refetch()}>
              Retry account records
            </Button>
          </section>
        )}
        {(localState === "loading" || accountLoading) && (
          <p role="status" className="mt-6 text-sm">
            Loading progress records…
          </p>
        )}
        {records.length > 0 && (
          <section aria-labelledby="horizon-projects-heading" className="mt-8">
            <h2 id="horizon-projects-heading" className="font-display text-3xl">
              Your project records
            </h2>
            <ul className="mt-5 space-y-4">
              {records.map((record) => {
                const guidance = horizonGuidance(record.details);
                const taskCount = TASKS.filter((task) =>
                  record.details.tasks.includes(task.id),
                ).length;
                return (
                  <li key={record.id} className="rounded-xl border border-border bg-card p-5">
                    <p className="eyebrow">{guidance.label}</p>
                    <h3 className="mt-2 font-display text-2xl">{record.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {record.details.reviews.length} saved review
                      {record.details.reviews.length === 1 ? "" : "s"} · {taskCount} of{" "}
                      {TASKS.length} owner-reported task checks
                    </p>
                    {record.details.url && (
                      <p className="mt-2 break-all text-sm text-muted-foreground">
                        {record.details.url}
                      </p>
                    )}
                    <p className="mt-4 text-sm leading-relaxed">
                      <strong>Next step:</strong> {guidance.next}
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-4">
                      <Link to="/library">Find this design in My designs</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {!records.length && !partial && (
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl">
              No project progress recorded in this browser yet.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Your saved designs may already be in My designs. Open a design and continue to Vision
              to begin its progress record, or start a new direction in the studio.
            </p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/library">Open my design library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/" search={{ view: "studio" }}>
              Open design studio
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/critic" search={{ mode: "check" }}>
              Check a live site
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/welcome">Follow the guided handoff</Link>
          </Button>
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Each design counts once in its completion week. Browser progress stays in this browser
          profile; account progress appears only when that service is configured and records are
          explicitly saved. Horizon shows saved history and owner-reported checks. It does not
          certify safety, deploy a project, or approve a release. Test changes in an isolated
          preview and keep the project owner's release and rollback decisions with the project.
        </p>
      </main>
    </div>
  );
}
