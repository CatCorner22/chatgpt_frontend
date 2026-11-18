import { focusLocalStorage, focusSessionStorage, isHostedBuild } from "@/lib/browser-storage";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppWindow, Globe, Link2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { DesignPreview } from "@/components/DesignPreview";
import {
  readLibrary,
  readLibrarySnapshot,
  writeLibrary,
  undoLibraryChange,
  LibraryChangedError,
  type LibraryEntry,
} from "@/lib/library";
import { groupBrands, newBuild, syncLook, type BuildKind } from "@/lib/brands";
import { readProgress } from "@/lib/launch";
import { useDesignFonts } from "@/lib/useDesignFonts";
import { useUser } from "@/hooks/useSession";
import { mergeBuilds } from "@/lib/brandSync";
import { fetchBuilds, pushBuilds, removeBuilds } from "@/lib/brandCloud";

export const Route = createFileRoute("/brands")({
  head: () => ({
    meta: [
      { title: "Brands — Focus" },
      {
        name: "description",
        content: "Keep every website and app for one brand together, sharing one look.",
      },
      { property: "og:title", content: "Brands — Focus" },
      {
        property: "og:description",
        content: "Several website and app builds under one brand, linked by a shared look.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Brands,
});

const STATUS: Record<string, string> = {
  ready: "Ready to build",
  built: "Built",
  reviewed: "Checked",
  launched: "Launched",
};

function Brands() {
  const navigate = useNavigate();
  const [list, setList] = useState<LibraryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const librarySnapshot = useRef<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const snapshot = readLibrarySnapshot();
      setList(snapshot.entries);
      librarySnapshot.current = snapshot.raw;
      setStatus(Object.fromEntries(readProgress().map((r) => [r.id, r.details.status])));
    } catch {
      toast.error("Could not read this browser's designs.");
    }
    setReady(true);
  }, []);
  const user = useUser();
  const [cloud, setCloud] = useState<"off" | "syncing" | "saved" | "error">("off");
  // Signed in: bring in builds from other devices and upload this browser's newer ones.
  useEffect(() => {
    if (!user || !ready) return;
    let live = true;
    setCloud("syncing");
    (async () => {
      const remote = await fetchBuilds();
      // Read local after the download so edits made meanwhile are not overwritten.
      const { merged, push } = mergeBuilds(readLibrary(), remote);
      if (!live) return;
      librarySnapshot.current = writeLibrary(merged);
      setList(merged);
      await pushBuilds(user.id, push);
      if (live) setCloud("saved");
    })().catch(() => live && setCloud("error"));
    return () => {
      live = false;
    };
  }, [user?.id, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const upload = async (next: LibraryEntry[], prev: LibraryEntry[]) => {
    if (!user) return;
    setCloud("syncing");
    try {
      const was = new Map(prev.map((e) => [e.id, e]));
      await pushBuilds(
        user.id,
        next.filter((e) => was.get(e.id) !== e),
      );
      await removeBuilds(prev.filter((e) => !next.some((n) => n.id === e.id)).map((e) => e.id));
      setCloud("saved");
    } catch {
      setCloud("error");
    }
  };
  const brands = useMemo(() => groupBrands(list), [list]);
  useDesignFonts(brands.map((b) => b.lead.state.tokens));
  const save = (next: LibraryEntry[], ok: string, undo: LibraryEntry[]) => {
    try {
      const committed = writeLibrary(next, focusLocalStorage, librarySnapshot.current);
      librarySnapshot.current = committed;
      setList(next);
      void upload(next, undo);
      toast.success(ok, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            try {
              if (!undoLibraryChange(undo, committed)) {
                toast.error(
                  "Your library changed after that action. Undo was not applied; your current designs have been kept.",
                );
                return;
              }
              librarySnapshot.current = JSON.stringify({ version: 1, entries: undo });
              setList(undo);
              void upload(undo, next);
            } catch {
              toast.error(
                "Could not save the undo. Your current library has not been replaced in this view.",
              );
            }
          },
        },
      });
    } catch (error) {
      toast.error(
        error instanceof LibraryChangedError
          ? error.message
          : "Could not save that change. Your designs are unchanged.",
      );
    }
  };
  const open = (e: LibraryEntry) => {
    try {
      focusSessionStorage.setItem("refraction:pending-rescue", JSON.stringify(e.state));
      void navigate({ to: "/" });
    } catch {
      toast.error("Could not open this build. Your current design is unchanged.");
    }
  };
  const add = (lead: LibraryEntry, kind: BuildKind) => {
    const n = newBuild(lead, kind, crypto.randomUUID(), new Date().toISOString());
    save(
      [
        ...list.map((e) =>
          e.id === lead.id && !e.collection ? { ...e, collection: n.collection } : e,
        ),
        n,
      ],
      `New ${kind} build added`,
      list,
    );
  };
  const sync = (target: LibraryEntry, lead: LibraryEntry) =>
    save(
      list.map((e) => (e.id === target.id ? syncLook(e, lead, new Date().toISOString()) : e)),
      "Look matched to the main build",
      list,
    );

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <p className="eyebrow" role="status">
          {!user
            ? "Brands · kept in this browser"
            : cloud === "syncing"
              ? "Brands · saving to your account…"
              : cloud === "error"
                ? "Brands · not saved to your account — check your connection"
                : "Brands · saved to your account"}
        </p>
        <h1 className="mt-2 font-display text-5xl">Keep every build on one brand look</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          One brand can have a website and one or more apps. Builds here share the same colours,
          fonts and shapes, so everything you make looks like it belongs together. The first build
          is the
          <strong> main build</strong>; the others follow its look.
        </p>
        {ready &&
          !user &&
          (isHostedBuild() ? (
            <p className="mt-3 text-sm">
              Automatic brand synchronization is not configured here. Brand changes stay in this
              browser. Open{" "}
              <Link to="/library" className="underline underline-offset-2">
                My designs
              </Link>{" "}
              to save the full library online or download a backup, then restore it on another
              device.
            </p>
          ) : (
            <p className="mt-3 text-sm">
              <Link to="/auth" className="underline underline-offset-2">
                Sign in
              </Link>{" "}
              to save your brands to your account and open them on any device.
            </p>
          ))}
        {ready && brands.length === 0 && (
          <div className="mt-10">
            <p className="font-display text-2xl">No brands yet.</p>
            <p className="text-muted-foreground">
              Make a design first. It appears here under its brand name.
            </p>
            <Button asChild className="mt-4">
              <Link to="/">Make a design</Link>
            </Button>
          </div>
        )}
        <div className="mt-8 space-y-8">
          {brands.map((b) => (
            <section
              key={b.name}
              aria-labelledby={`brand-${b.lead.id}`}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id={`brand-${b.lead.id}`} className="font-display text-3xl">
                  {b.name}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => add(b.lead, "website")}
                    title="Start another website with this brand's look and words"
                  >
                    <Plus /> Add a website
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => add(b.lead, "app")}
                    title="Start an app with this brand's look and words"
                  >
                    <Plus /> Add an app
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {b.builds.length} build{b.builds.length === 1 ? "" : "s"} ·{" "}
                {b.builds.every((x) => x.sameLook)
                  ? "all share one look"
                  : "some builds no longer match the main look"}
              </p>
              <ol
                className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                aria-label={`${b.name} builds`}
              >
                {b.builds.map(({ entry, kind, sameLook }, i) => (
                  <li
                    key={entry.id}
                    className="overflow-hidden rounded-lg border border-border bg-background"
                  >
                    <div className="h-32 overflow-hidden border-b border-border" aria-hidden>
                      <DesignPreview t={entry.state.tokens} c={entry.state.content} compact />
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="eyebrow flex items-center gap-1.5">
                        {kind === "app" ? (
                          <AppWindow className="size-3.5" aria-hidden />
                        ) : (
                          <Globe className="size-3.5" aria-hidden />
                        )}
                        {kind === "app" ? "App" : "Website"} {i === 0 && "· main build"}
                      </p>
                      <h3 className="font-medium">{entry.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        Status: {STATUS[status[entry.id] ?? "ready"]}
                      </p>
                      <p
                        className="flex items-center gap-1 text-xs"
                        title="Whether this build uses the main build's colours, fonts and shapes"
                      >
                        <Link2 className="size-3.5" aria-hidden />
                        {i === 0
                          ? "Sets the look for this brand"
                          : sameLook
                            ? "Linked: same look as the main build"
                            : "Look differs from the main build"}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" onClick={() => open(entry)}>
                          Open
                        </Button>
                        {i > 0 && !sameLook && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sync(entry, b.lead)}
                            title="Copy the main build's colours, fonts and shapes; keep this build's words"
                          >
                            <RefreshCw /> Match main look
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
