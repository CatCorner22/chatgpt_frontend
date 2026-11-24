import { focusLocalStorage, focusSessionStorage } from "@/lib/browser-storage";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Star, Folder, Download, Upload, ArrowRight, Copy, History } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { HostedLibraryPanel } from "@/components/HostedLibraryPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DesignPreview } from "@/components/DesignPreview";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  duplicateDesign,
  restoreVersion,
  readLibrarySnapshot,
  readLibraryRecoveries,
  LibraryRecoveryError,
  LibraryChangedError,
  LIBRARY_KEY,
  writeLibrary,
  undoLibraryChange,
  type LibraryEntry,
  resumeLabel,
} from "@/lib/library";
import { STUDIO_KEY } from "@/lib/projects";
import { useDesignFonts } from "@/lib/useDesignFonts";
import { downloadBlob } from "@/lib/exportPack";
import { ReverieArt } from "@/components/BrandArt";
import {
  createLibraryBackup,
  restoreLibraryBackup,
  MAX_LIBRARY_BACKUP_BYTES,
} from "@/lib/transfer";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Design library — Focus" },
      {
        name: "description",
        content:
          "Your browser's saved designs, organized into collections without replacing your work.",
      },
      { property: "og:title", content: "Design library — Focus" },
      { property: "og:description", content: "Keep, organize and revisit your designs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Library,
});

function Library() {
  const navigate = useNavigate();
  const [list, setList] = useState<LibraryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [recoveries, setRecoveries] = useState<{ key: string; raw: string }[]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [unprotectedRaw, setUnprotectedRaw] = useState<string | null>(null);
  const [readAttempt, setReadAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [opening, setOpening] = useState<LibraryEntry | null>(null);
  const [transferring, setTransferring] = useState<"backup" | "restore" | null>(null);
  const [transferError, setTransferError] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const transferInFlight = useRef(false);
  const librarySnapshot = useRef<string | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const backUp = async () => {
    if (transferInFlight.current) return;
    transferInFlight.current = true;
    setTransferring("backup");
    setTransferError("");
    setTransferStatus("");
    try {
      const latest = readLibrarySnapshot();
      setList(latest.entries);
      librarySnapshot.current = latest.raw;
      setRecoveries(readLibraryRecoveries());
      if (latest.needsRecovery)
        throw new Error(
          "Some saved library data could not be read. Download the preserved original data for recovery before creating a new library backup.",
        );
      const raw = await createLibraryBackup(latest.entries);
      downloadBlob(new Blob([raw], { type: "application/json" }), "focus-design-library.json");
      setTransferStatus(
        "Backup download started. It includes the images used by your designs and saved history. Keep this file to restore them in another browser.",
      );
    } catch (error) {
      setTransferError(
        error instanceof Error
          ? error.message
          : "The backup could not be prepared. Your designs are unchanged.",
      );
    } finally {
      transferInFlight.current = false;
      setTransferring(null);
    }
  };
  const restore = async (file: File) => {
    if (transferInFlight.current) return;
    transferInFlight.current = true;
    setTransferring("restore");
    setTransferError("");
    setTransferStatus("");
    try {
      if (file.size > MAX_LIBRARY_BACKUP_BYTES)
        throw new Error("Choose a library backup smaller than 20 MB.");
      const result = await restoreLibraryBackup(await file.text());
      setList(result.entries);
      librarySnapshot.current = focusLocalStorage.getItem(LIBRARY_KEY);
      if (result.designCount) {
        setLibraryError("");
        setUnprotectedRaw(null);
      }
      try {
        setRecoveries(readLibraryRecoveries());
      } catch {
        // A listing failure must not report a committed restore as failed.
      }
      setTransferStatus(
        !result.designCount
          ? "This backup contains no designs. Your library is unchanged."
          : result.added
            ? `Restored ${result.added} ${result.added === 1 ? "design" : "designs"} and retained ${result.imageCount} referenced ${result.imageCount === 1 ? "image" : "images"}. Existing designs were kept.${result.conflicts ? ` ${result.conflicts} ${result.conflicts === 1 ? "conflicting design was" : "conflicting designs were"} added as a separate copy.` : ""}`
            : result.journeysAdded
              ? `Recovered ${result.journeysAdded} Garden brief(s) and ${result.imagesAdded} missing images for your saved designs.`
              : result.imagesAdded
                ? `Recovered ${result.imagesAdded} missing image files. These designs were already in your library.`
                : "These designs and their images are already in your library. No duplicate designs were added.",
      );
    } catch (error) {
      if (error instanceof LibraryRecoveryError) {
        setLibraryError(error.message);
        setUnprotectedRaw(error.raw);
      }
      setTransferError(
        error instanceof Error
          ? error.message
          : "The backup could not be restored. Keep the file and try again.",
      );
    } finally {
      transferInFlight.current = false;
      setTransferring(null);
    }
  };
  useEffect(() => {
    setLibraryError("");
    setUnprotectedRaw(null);
    try {
      const snapshot = readLibrarySnapshot();
      setList(snapshot.entries);
      librarySnapshot.current = snapshot.raw;
    } catch (error) {
      setLibraryError(
        error instanceof LibraryRecoveryError
          ? error.message
          : "This browser is not allowing access to saved designs. Allow site storage, then try again.",
      );
      if (error instanceof LibraryRecoveryError) setUnprotectedRaw(error.raw);
    }
    try {
      setRecoveries(readLibraryRecoveries());
    } catch {
      // A blocked raw save remains downloadable even when storage listing is unavailable.
    }
    setReady(true);
  }, [readAttempt]);
  const downloadRecovery = (raw: string, filename: string) => {
    try {
      downloadBlob(new Blob([raw], { type: "text/plain;charset=utf-8" }), filename);
      setTransferStatus(
        "Recovery download started. Keep the original file for repair; it is not a complete library backup.",
      );
    } catch {
      setTransferError(
        "The recovery download could not start. Your saved data is still in this browser. Try again.",
      );
    }
  };
  useDesignFonts(list.map((e) => e.state.tokens));
  const edit = (id: string, changes: Partial<LibraryEntry>) => {
    const next = list.map((e) => (e.id === id ? { ...e, ...changes } : e));
    try {
      librarySnapshot.current = writeLibrary(next, focusLocalStorage, librarySnapshot.current);
      setList(next);
    } catch (error) {
      toast.error(
        error instanceof LibraryChangedError
          ? error.message
          : "Could not save that change. Your designs are unchanged.",
      );
      if (error instanceof LibraryChangedError) setReadAttempt((n) => n + 1);
    }
  };
  const replace = (next: LibraryEntry[], done: string, before: LibraryEntry[]) => {
    try {
      const committed = writeLibrary(next, focusLocalStorage, librarySnapshot.current);
      librarySnapshot.current = committed;
      setList(next);
      toast(done, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            try {
              if (!undoLibraryChange(before, committed)) {
                toast.error(
                  "Your library changed after that action. Undo was not applied; your current designs have been kept.",
                );
                return;
              }
              librarySnapshot.current = JSON.stringify({ version: 1, entries: before });
              setList(before);
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
      if (error instanceof LibraryChangedError) setReadAttempt((n) => n + 1);
    }
  };
  const [versionsOf, setVersionsOf] = useState<string | null>(null);
  const open = (e: LibraryEntry) => {
    try {
      focusSessionStorage.setItem("refraction:pending-rescue", JSON.stringify(e.state));
      void navigate({ to: "/", search: { view: "studio" } });
    } catch {
      toast.error("Could not open this design. Your current design is unchanged.");
    }
  };
  const filtered = list
    .filter(
      (e) =>
        (!favorites || e.favorite) &&
        (!collection || e.collection === collection) &&
        `${e.title} ${e.collection}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.updated.localeCompare(a.updated));
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <p className="eyebrow">Kept in this browser</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-5xl">Your saved designs</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!ready || !list.length || !!transferring}
              onClick={() => void backUp()}
            >
              <Download />
              {transferring === "backup" ? "Preparing backup…" : "Back up library"}
            </Button>
            <Button
              variant="outline"
              disabled={!ready || !!transferring}
              onClick={() => backupInput.current?.click()}
            >
              <Upload />
              {transferring === "restore" ? "Checking backup…" : "Restore backup"}
            </Button>
            <input
              ref={backupInput}
              type="file"
              accept=".json,application/json"
              aria-label="Library backup JSON file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restore(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          A backup keeps your designs, earlier versions, and their images together. Restoring adds
          designs to this browser; it keeps your existing work. If an older backup lacks image
          files, open it in the original browser where the images are still saved, then make a new
          backup there before transferring it.
        </p>
        <HostedLibraryPanel
          disabled={!ready || !!transferring}
          onRestored={() => setReadAttempt((n) => n + 1)}
        />
        {libraryError && (
          <section
            aria-label="Library recovery needed"
            className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
          >
            <p role="alert">{libraryError}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {unprotectedRaw !== null && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadRecovery(unprotectedRaw, "focus-original-library-recovery.txt")
                  }
                >
                  <Download />
                  Download original library data
                </Button>
              )}
              <Button variant="outline" onClick={() => setReadAttempt((n) => n + 1)}>
                Try reading library again
              </Button>
            </div>
          </section>
        )}
        {recoveries.length > 0 && (
          <section
            aria-labelledby="library-recovery-heading"
            className="mt-5 rounded-xl border border-border p-4"
          >
            <h2 id="library-recovery-heading" className="font-medium">
              Original library data preserved ({recoveries.length})
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Some saved library data could not be read. The original data is kept separately in
              this browser. Keep a downloaded copy if you need help recovering it. To resume from a
              working backup, choose Restore backup above, or continue with the readable designs
              below. Recovery files contain the original saved text, not image files or a repaired
              library.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {recoveries.map((copy, i) => (
                <Button
                  key={copy.key}
                  variant="outline"
                  onClick={() => downloadRecovery(copy.raw, `focus-library-recovery-${i + 1}.txt`)}
                >
                  <Download />
                  Download preserved library data {i + 1}
                </Button>
              ))}
            </div>
          </section>
        )}
        {transferError && (
          <p role="alert" className="mt-3 max-w-3xl text-sm text-destructive">
            {transferError}
          </p>
        )}
        {transferStatus && (
          <p role="status" className="mt-3 max-w-3xl text-sm leading-relaxed">
            {transferStatus}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Input
            aria-label="Search designs"
            placeholder="Find a design…"
            className="max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <Folder className="size-4" />
            <select
              aria-label="Collection filter"
              className="h-9 rounded-sm border border-input bg-background px-2"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              <option value="">All collections</option>
              {[...new Set(list.map((e) => e.collection).filter(Boolean))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <Button
            variant={favorites ? "secondary" : "outline"}
            aria-pressed={favorites}
            onClick={() => setFavorites(!favorites)}
          >
            <Star />
            Favorites
          </Button>
        </div>
        {!ready ? (
          <p className="mt-8">Loading your designs…</p>
        ) : !list.length ? (
          <div className="brand-library-empty mt-12">
            {!libraryError && !recoveries.length && <ReverieArt pose="library" />}
            <div>
              <h2 className="font-display text-3xl">
                {libraryError || recoveries.length
                  ? "No readable designs to show yet."
                  : "Your next design belongs here."}
              </h2>
              <Button asChild className="mt-5">
                <Link to="/" search={{ view: "studio" }}>
                  Make a design
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        ) : !filtered.length ? (
          <p className="mt-8">No designs match these filters.</p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <article
                key={e.id}
                className="min-w-0 overflow-hidden rounded-sm border border-border bg-card"
              >
                <div className="h-56 overflow-hidden">
                  <DesignPreview t={e.state.tokens} c={e.state.content} compact />
                </div>
                <div className="space-y-3 border-t border-border p-4">
                  <div className="flex gap-2">
                    <Input
                      aria-label={`Name for ${e.title}`}
                      defaultValue={e.title}
                      key={`${e.id}-${e.title}`}
                      onBlur={(x) => {
                        const title = x.target.value.trim().slice(0, 120);
                        if (title && title !== e.title) edit(e.id, { title });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${e.favorite ? "Unfavorite" : "Favorite"} ${e.title}`}
                      aria-pressed={e.favorite}
                      onClick={() => edit(e.id, { favorite: !e.favorite })}
                    >
                      <Star className={e.favorite ? "fill-accent text-accent" : ""} />
                    </Button>
                  </div>
                  <Input
                    aria-label={`Collection for ${e.title}`}
                    placeholder="Collection"
                    defaultValue={e.collection}
                    key={`${e.id}-${e.collection}`}
                    maxLength={60}
                    onBlur={(x) => {
                      if (x.target.value !== e.collection)
                        edit(e.id, { collection: x.target.value.trim() });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {resumeLabel(e.state).startsWith("Open")
                      ? "Vision ready"
                      : resumeLabel(e.state).replace("Continue at q", "Q")}{" "}
                    · {new Date(e.updated).toLocaleDateString()}
                  </p>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      try {
                        const current = JSON.parse(focusLocalStorage.getItem(STUDIO_KEY) ?? "null");
                        if (current?.tokens && current.libraryId !== e.id) setOpening(e);
                        else open(e);
                      } catch {
                        setOpening(e);
                      }
                    }}
                  >
                    {resumeLabel(e.state)}
                    <ArrowRight />
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        replace(
                          duplicateDesign(
                            list,
                            e.id,
                            crypto.randomUUID(),
                            new Date().toISOString(),
                          ),
                          `Made a copy of ${e.title}`,
                          list,
                        )
                      }
                    >
                      <Copy />
                      Make a copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={versionsOf === e.id}
                      disabled={!e.versions?.length}
                      onClick={() => setVersionsOf(versionsOf === e.id ? null : e.id)}
                    >
                      <History />
                      Earlier versions ({e.versions?.length ?? 0})
                    </Button>
                  </div>
                  {versionsOf === e.id && !!e.versions?.length && (
                    <ul className="space-y-2 border-t border-border pt-3">
                      {e.versions
                        .map((v, i) => ({ v, i }))
                        .reverse()
                        .map(({ v, i }) => (
                          <li key={`${v.at}-${i}`} className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 overflow-hidden rounded-sm border border-border">
                              {[v.state.tokens.bg, v.state.tokens.ink, v.state.tokens.accent].map(
                                (c) => (
                                  <span key={c} className="flex-1" style={{ background: c }} />
                                ),
                              )}
                            </span>
                            <span className="min-w-0 flex-1 text-sm">
                              {new Date(v.at).toLocaleString()} · {v.label}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                replace(
                                  restoreVersion(list, e.id, i, new Date().toISOString()),
                                  `Restored an earlier version of ${e.title}`,
                                  list,
                                )
                              }
                            >
                              Restore
                            </Button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-8 text-sm text-muted-foreground">
          Browser copies stay on this device. Account saves are separate.
        </p>
      </main>
      <ConfirmDialog
        open={!!opening}
        onOpenChange={(v) => !v && setOpening(null)}
        title="Switch designs?"
        body="Your current design stays in this library. The selected design will open on the Design page."
        confirmLabel="Open design"
        onConfirm={() => {
          if (opening) open(opening);
          setOpening(null);
        }}
      />
    </div>
  );
}
