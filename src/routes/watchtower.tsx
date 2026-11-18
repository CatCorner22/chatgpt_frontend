import { isHostedBuild } from "@/lib/browser-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { findByDesignId } from "@/lib/brands";
import { readLibrary, type LibraryEntry } from "@/lib/library";
import { Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useUser } from "@/hooks/useSession";
import { listWatches, addWatch, checkWatch, changeWatch } from "@/lib/watchtower.functions";
import { tagChange, scoreTimeline, changedFindings, parseFindings } from "@/lib/watchtower";

export const Route = createFileRoute("/watchtower")({
  head: () => ({
    meta: [
      { title: "Site monitor — Focus" },
      {
        name: "description",
        content:
          "Weekly measured checks for your public websites and apps, with regression alerts and concrete fixes.",
      },
      { property: "og:title", content: "Site monitor — Focus" },
      {
        property: "og:description",
        content: "Keep design improvements from drifting with weekly page checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Watchtower,
});

function Watchtower() {
  if (!isHostedBuild()) return <ConnectedWatchtower />;
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 md:px-10">
        <p className="eyebrow">Keep checking your work</p>
        <h1 className="mt-2 font-display text-5xl">Site monitor</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Scheduled monitoring is not configured in this workspace. You can run a measured
          public-page check whenever you need one. Keep testing the same customer tasks after each
          change; a page score does not replace those checks.
        </p>
        <Button asChild className="mt-6">
          <Link to="/critic">Check a public page</Link>
        </Button>
      </main>
    </div>
  );
}
function ConnectedWatchtower() {
  const user = useUser();
  const qc = useQueryClient();
  const list = useServerFn(listWatches),
    add = useServerFn(addWatch),
    check = useServerFn(checkWatch),
    change = useServerFn(changeWatch);
  const pages = useQuery({
    queryKey: ["watches", user?.id],
    enabled: !!user,
    queryFn: () => list(),
  });
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState("");
  const [busyMessage, setBusyMessage] = useState("");
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  useEffect(() => {
    try {
      setLibrary(readLibrary());
    } catch {
      /* unreadable browser storage: names stay unknown */
    }
  }, []);
  const act = async (id: string, message: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setBusyMessage(message);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["watches"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete this action.");
    } finally {
      await qc.invalidateQueries({ queryKey: ["watches"] });
      setBusy("");
      setBusyMessage("");
    }
  };
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 md:px-10">
        <p className="eyebrow">Weekly re-checks of your live sites</p>
        <h1 className="mt-2 font-display text-5xl">Re-check your live sites every week</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Weekly measured checks of public pages. Private app screens need a fresh screenshot in the
          “Check a site” page; no passwords are collected.
        </p>
        {!user ? (
          <Button asChild className="mt-6">
            <Link to="/auth">Sign in to watch your pages</Link>
          </Button>
        ) : (
          <>
            <form
              className="mt-6 flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void act("add", "Adding your page…", async () => {
                  const saved = await add({ data: { url, label } });
                  setBusyMessage(`Checking ${label.trim() || url.trim()}…`);
                  setUrl("");
                  setLabel("");
                  await check({ data: { id: saved.id } });
                });
              }}
            >
              <Input
                aria-label="Watch address"
                placeholder="Public page address"
                className="min-w-48 flex-1"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Input
                aria-label="Watch label"
                placeholder="Client or page name"
                className="max-w-xs"
                maxLength={120}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <Button type="submit" disabled={!!busy}>
                <Eye />
                {busy === "add"
                  ? busyMessage === "Adding your page…"
                    ? busyMessage
                    : "Checking your page…"
                  : "Watch page"}
              </Button>
            </form>
            <p
              role="status"
              className={busyMessage || pages.isLoading ? "mt-8 break-words" : "sr-only"}
            >
              {busyMessage || (pages.isLoading ? "Loading your monitored pages…" : "")}
            </p>
            {pages.error && (
              <p role="alert" className="mt-8 text-destructive">
                Could not load watched pages.
              </p>
            )}
            {pages.data?.length === 0 && busy !== "add" && (
              <p className="mt-10 text-muted-foreground">No watched pages yet.</p>
            )}
            <div className="mt-8 space-y-8">
              {pages.data?.map((p) => {
                const findings = parseFindings(p.findings);
                const history = Array.isArray(p.history) ? p.history : [];
                const previous = history.length > 1 ? history[history.length - 2] : null;
                const prior =
                  previous && typeof previous === "object" && "findings" in previous
                    ? parseFindings(previous["findings"])
                    : [];
                const delta = changedFindings(prior, findings);
                const tagMoved = tagChange(history);
                const built = findByDesignId(p.design_id, library);
                return (
                  <section key={p.id} className="border-t border-border pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-3xl">
                          {p.label || new URL(p.url).hostname}
                        </h2>
                        <p className="mt-1 break-all text-sm text-muted-foreground">{p.url}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            aria-label={`Weekly checks for ${p.label || p.url}`}
                            checked={p.enabled}
                            disabled={!!busy}
                            onCheckedChange={(enabled) =>
                              void act(
                                `weekly:${p.id}`,
                                enabled
                                  ? `Turning weekly checks on for ${p.label || new URL(p.url).hostname}…`
                                  : `Pausing weekly checks for ${p.label || new URL(p.url).hostname}…`,
                                () => change({ data: { id: p.id, enabled } }),
                              )
                            }
                          />
                          Weekly
                        </label>
                        <Button
                          variant="outline"
                          disabled={!!busy}
                          onClick={() =>
                            void act(p.id, `Checking ${p.label || new URL(p.url).hostname}…`, () =>
                              check({ data: { id: p.id } }),
                            )
                          }
                        >
                          <RefreshCw />
                          {busy === p.id ? "Checking…" : "Check now"}
                        </Button>
                      </div>
                    </div>
                    {p.error && (
                      <p role="alert" className="mt-3 text-sm text-destructive">
                        {p.error}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-baseline gap-4">
                      <strong className="font-display text-4xl">
                        {p.score === null ? "Not checked" : `${p.score}/100`}
                      </strong>
                      <span className="text-sm text-muted-foreground">
                        {p.checked_at
                          ? `Last checked ${new Date(p.checked_at).toLocaleString()}`
                          : "First check pending"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm" aria-label="Focus design tag">
                      {p.design_id
                        ? `Says it was built from ${built ? `“${built.title}”` : "a Focus design not in this browser"} (${p.design_id}).`
                        : p.checked_at
                          ? "No Focus design tag found on this page."
                          : null}
                      {tagMoved === "missing" && (
                        <span className="ml-1 text-destructive">
                          The tag disappeared since the last check.
                        </span>
                      )}
                      {tagMoved === "changed" && (
                        <span className="ml-1 text-destructive">
                          The tag changed since the last check.
                        </span>
                      )}
                    </p>
                    {scoreTimeline(history).length > 1 && (
                      <ol aria-label="Score over time" className="mt-3 flex h-12 items-end gap-1">
                        {scoreTimeline(history).map((t) => (
                          <li
                            key={t.at}
                            title={`${new Date(t.at).toLocaleDateString()}: ${t.score}/100`}
                            className="w-3 rounded-t-sm bg-accent"
                            style={{ height: `${Math.max(6, t.score)}%` }}
                          >
                            <span className="sr-only">{`${new Date(t.at).toLocaleDateString()}: ${t.score} out of 100`}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {history.length > 1 && (
                      <p className="mt-2 text-sm">
                        {delta.newIssues.length} new issues · {delta.resolved.length} resolved
                      </p>
                    )}
                    <ol className="mt-4 divide-y divide-border">
                      {findings
                        .filter((f) => !f.ok)
                        .sort(
                          (a, b) =>
                            (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1),
                        )
                        .slice(0, 3)
                        .map((f) => (
                          <li key={f.id} className="py-3">
                            <p className="font-medium">
                              {f.area} · {f.severity === "high" ? "Fix first" : "Improve"}
                            </p>
                            <p className="text-sm text-muted-foreground">{f.detail}</p>
                            <p className="mt-1 text-sm">{f.fix}</p>
                          </li>
                        ))}
                    </ol>
                    {findings.length > 0 && findings.every((f) => f.ok) && (
                      <p className="mt-3">All measured checks pass.</p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {p.enabled
                        ? `Next check after ${new Date(p.next_check).toLocaleDateString()}`
                        : "Weekly checks paused"}{" "}
                      · Checks inspect downloaded page code, not signed-in flows or rendered
                      interactions.
                    </p>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
