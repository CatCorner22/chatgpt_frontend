import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHostedSession } from "@/components/HostedBoundary";
import { focusLocalStorage } from "@/lib/browser-storage";
import { readLibrarySnapshot } from "@/lib/library";
import { gardenJourneyKey } from "@/lib/garden-journey";
import { createLibraryBackup, restoreLibraryBackup } from "@/lib/transfer";
import { HostedClientError, readOnlineLibrary, saveOnlineLibrary } from "@/lib/hosted-client";

type OnlineCopy = { raw: string; etag: string };
const problem = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The online library could not be reached. Your browser designs are unchanged.";

export function HostedLibraryPanel({
  onRestored,
  disabled = false,
}: {
  onRestored: () => void;
  disabled?: boolean;
}) {
  const session = useHostedSession();
  const userId = session?.user?.id;
  const available = !!userId && !!session?.storageAvailable;
  const [remote, setRemote] = useState<OnlineCopy | null | undefined>(undefined);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<"check" | "save" | "restore" | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [identityChanged, setIdentityChanged] = useState(false);
  const operation = useRef<AbortController | null>(null);

  const reportError = (error: unknown) => {
    setError(problem(error));
    if (
      error instanceof HostedClientError &&
      ["unauthenticated", "account_changed"].includes(error.code)
    )
      setIdentityChanged(true);
  };
  const check = useCallback(async () => {
    if (!userId || !available || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy("check");
    setError("");
    setStatus("");
    setRemote(undefined);
    setReviewed(false);
    try {
      const copy = await readOnlineLibrary(userId, controller.signal);
      if (!controller.signal.aborted) setRemote(copy);
    } catch (error) {
      if (!controller.signal.aborted) reportError(error);
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(null);
      }
    }
  }, [userId, available]);
  useEffect(() => {
    setIdentityChanged(false);
    void check();
    return () => {
      operation.current?.abort();
      operation.current = null;
    };
  }, [check]);

  const save = async () => {
    if (
      !userId ||
      !available ||
      identityChanged ||
      disabled ||
      operation.current ||
      remote === undefined ||
      (remote !== null && !reviewed)
    )
      return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const snapshot = readLibrarySnapshot(focusLocalStorage);
      if (snapshot.needsRecovery)
        throw new Error(
          "Some browser library data needs recovery. Download the preserved original data before saving an online copy.",
        );
      if (!snapshot.entries.length)
        throw new Error(
          "There are no saved designs in this browser yet. Create a design in the studio first; the online copy has not changed.",
        );
      const briefSnapshots = snapshot.entries.map(({ id }) => {
        const key = gardenJourneyKey(id);
        return [key, focusLocalStorage.getItem(key)] as const;
      });
      const raw = await createLibraryBackup(snapshot.entries, focusLocalStorage);
      if (controller.signal.aborted) return;
      const etag = await saveOnlineLibrary(userId, raw, remote?.etag ?? null, controller.signal);
      if (controller.signal.aborted) return;
      setRemote({ raw, etag });
      setReviewed(true);
      let changed = true;
      try {
        changed =
          readLibrarySnapshot(focusLocalStorage).raw !== snapshot.raw ||
          briefSnapshots.some(([key, value]) => focusLocalStorage.getItem(key) !== value);
      } catch {
        /* The submitted copy was saved; unreadable later work is not acknowledged. */
      }
      setStatus(
        `Saved ${snapshot.entries.length} ${snapshot.entries.length === 1 ? "design" : "designs"} online with their images, Garden briefs, and saved history.${changed ? " Your browser library changed during the save; save again to include those later changes." : " This is a copy of your saved library, not an unfinished studio draft."}`,
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        reportError(error);
        // A failed request can have reached the server. Re-read and restore before another write.
        if (error instanceof HostedClientError || error instanceof TypeError) {
          setRemote(undefined);
          setReviewed(false);
        }
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(null);
      }
    }
  };
  const restore = async () => {
    if (!available || identityChanged || disabled || operation.current || !remote) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy("restore");
    setError("");
    setStatus("");
    try {
      const result = await restoreLibraryBackup(remote.raw, focusLocalStorage);
      if (controller.signal.aborted) return;
      setReviewed(true);
      setStatus(
        result.added
          ? `Restored ${result.added} ${result.added === 1 ? "design" : "designs"} and ${result.imageCount} referenced images. Your existing browser designs were kept.${result.conflicts ? " Different versions were kept as separate copies." : ""}`
          : result.journeysAdded
            ? `Recovered ${result.journeysAdded} Garden brief(s) and ${result.imagesAdded} missing images for your saved designs.`
            : result.imagesAdded
              ? `Recovered ${result.imagesAdded} missing images. Existing designs were kept.`
              : "The online designs are already in this browser. Your existing work was kept.",
      );
      onRestored();
    } catch (error) {
      if (!controller.signal.aborted) reportError(error);
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(null);
      }
    }
  };

  if (!session) return null;
  return (
    <section
      aria-labelledby="online-library-title"
      className="mt-6 rounded-xl border border-border bg-card p-5"
    >
      <p className="eyebrow">Across your devices</p>
      <h2 id="online-library-title" className="mt-2 font-display text-2xl">
        Your online library
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Save a private copy of the designs in My designs, including their images, Garden briefs, and
        saved history. On another device, restore this copy to continue. Your unfinished studio
        draft and other browser settings stay in this browser.
      </p>
      {session.user ? (
        <p className="mt-2 break-words text-sm">
          Signed in as {session.user.email || "your ChatGPT account"}.
        </p>
      ) : (
        <p className="mt-3 text-sm">
          Sign in with ChatGPT to use your online library.{" "}
          <a href="/signin-with-chatgpt" target="_top" className="underline">
            Sign in
          </a>
        </p>
      )}
      {session.user && !session.storageAvailable && (
        <p role="status" className="mt-3 text-sm">
          Online storage is unavailable. You can keep designing here and use Back up library to keep
          a portable copy.
        </p>
      )}
      {available && (
        <>
          {remote === null && (
            <p className="mt-3 text-sm">
              You have no online library yet. Save your first copy when your designs are ready.
            </p>
          )}
          {remote && !reviewed && (
            <p className="mt-3 text-sm">
              An online copy is available. Restore it first to keep its designs alongside your
              browser work before saving an updated copy.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => void save()}
              disabled={
                disabled ||
                !!busy ||
                identityChanged ||
                remote === undefined ||
                (!!remote && !reviewed)
              }
            >
              <Cloud size={16} />
              {busy === "save" ? "Saving library…" : "Save library online"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void restore()}
              disabled={disabled || !!busy || identityChanged || !remote}
            >
              <Download size={16} />
              {busy === "restore" ? "Restoring library…" : "Restore online library"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void check()}
              disabled={disabled || !!busy || identityChanged}
            >
              <RefreshCw size={16} />
              {busy === "check" ? "Checking online library…" : "Check online library"}
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/40 p-3 text-sm">
          {error}
        </p>
      )}
      {identityChanged && (
        <a className="mt-3 inline-block underline" href="/auth">
          Reload and verify your account
        </a>
      )}
      {status && (
        <p role="status" className="mt-4 text-sm">
          {status}
        </p>
      )}
    </section>
  );
}
