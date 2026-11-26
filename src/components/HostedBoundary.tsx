import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  initializeBrowserOwner,
  isHostedBuild,
  lockBrowserOwner,
  resumeBrowserOwner,
} from "@/lib/browser-storage";

import { capturePreviewReturn } from "@/lib/preview-keyboard";

export type HostedSession = {
  user: { id: string; email: string | null } | null;
  storageAvailable: boolean;
  mode: "hosted" | "preview";
};
const HostedContext = createContext<HostedSession | null>(null);

export function useHostedSession(): HostedSession | null {
  return useContext(HostedContext);
}

function parseSession(value: unknown): HostedSession {
  if (!value || typeof value !== "object") throw new Error("Invalid session response");
  const data = value as Record<string, unknown>;
  if (
    typeof data["storageAvailable"] !== "boolean" ||
    !["hosted", "preview"].includes(String(data["mode"]))
  ) {
    throw new Error("Invalid session response");
  }
  if (data["mode"] === "preview") {
    if (!import.meta.env.DEV || data["user"] !== null || data["storageAvailable"] !== false) {
      throw new Error("Preview identity is unavailable in a deployed studio");
    }
    return { user: null, mode: "preview", storageAvailable: false };
  }
  const user = data["user"];
  if (user === null) return { user: null, mode: "hosted", storageAvailable: false };
  if (!user || typeof user !== "object") throw new Error("Invalid session response");
  const identity = user as Record<string, unknown>;
  if (
    typeof identity["id"] !== "string" ||
    !identity["id"] ||
    identity["id"].length > 1000 ||
    !(identity["email"] === null || typeof identity["email"] === "string")
  )
    throw new Error("Invalid session response");
  return {
    user: { id: identity["id"], email: identity["email"] },
    mode: "hosted",
    storageAvailable: data["storageAvailable"],
  };
}

async function readSession(response: Response): Promise<HostedSession> {
  const limit = 16_384;
  if (Number(response.headers.get("Content-Length")) > limit)
    throw new Error("Invalid session response");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing session response");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error("Invalid session response");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return parseSession(JSON.parse(new TextDecoder().decode(bytes)));
}

type BoundaryState = {
  kind: "checking" | "ready" | "unverified" | "blocked";
  session: HostedSession | null;
  message: string;
  signIn: boolean;
};

/** Hosted pages never mount against an unverified or mutable browser storage owner. */
export function HostedBoundary(props: { children: ReactNode; queryClient: QueryClient }) {
  return isHostedBuild() ? <VerifiedHostedBoundary {...props} /> : props.children;
}

function VerifiedHostedBoundary({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const [state, setState] = useState<BoundaryState>({
    kind: "checking",
    session: null,
    message: "",
    signIn: false,
  });
  const retry = useRef<() => void>(() => {});
  const pendingTab = useRef<ReturnType<typeof capturePreviewReturn>>(null);
  useLayoutEffect(() => {
    if (state.kind !== "checking" && pendingTab.current) {
      pendingTab.current.release();
      pendingTab.current = null;
    }
  }, [state]);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let owner: string | null = null;
    let terminal = false;
    let paused = false;
    let lastSession: HostedSession | null = null;
    let request: AbortController | undefined;
    let deadline: number | undefined;
    let previewPointerTurn: number | undefined;
    let previewFocusTimer: number | undefined;
    let awaitingPreviewReturn = false;
    let confirmForeground = false;

    let enteredFrame: HTMLIFrameElement | null = null;
    let returnTurn: number | undefined;
    function clearPreviewKeyboard() {
      enteredFrame = null;
      pendingTab.current?.forget();
    }

    function block(message: string, signIn = false) {
      clearPreviewKeyboard();
      terminal = true;
      lockBrowserOwner();
      void queryClient.cancelQueries();
      queryClient.clear();
      setState({ kind: "blocked", message, signIn, session: null });
    }

    function pause() {
      clearPreviewKeyboard();
      paused = true;
      lockBrowserOwner();
      void queryClient.cancelQueries();
      setState({
        kind: "unverified",
        session: lastSession,
        signIn: false,
        message:
          "We could not verify your account. Your open work has been kept. Check your connection, then retry to continue with the same account.",
      });
    }

    async function verify(explicitRetry = false, protect = false) {
      if (terminal || awaitingPreviewReturn || (paused && !explicitRetry)) return;
      if (protect || explicitRetry) {
        // Hidden children remain mounted to preserve drafts. Lock their storage
        // and export callbacks before a protective request can yield control.
        lockBrowserOwner();
        setState((previous) => ({ ...previous, kind: "checking" }));
      }
      const attempt = ++generation;
      request?.abort();
      window.clearTimeout(deadline);
      const controller = new AbortController();
      request = controller;
      const timeout = window.setTimeout(() => {
        if (!active || attempt !== generation) return;
        generation++;
        controller.abort();
        pause();
      }, 10_000);
      deadline = timeout;
      try {
        const response = await fetch("/api/hosted/session", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Session service unavailable");
        const session = await readSession(response);
        if (!active || attempt !== generation) return;
        if (session.mode === "hosted" && !session.user) {
          block("Sign in to open your private studio and saved designs.", true);
          return;
        }
        const nextOwner =
          session.mode === "preview" ? "preview:development" : `sites:${session.user!.id}`;
        if (owner !== null && owner !== nextOwner) {
          block("Your account changed. Reload to open the correct account's designs.");
          return;
        }
        if (confirmForeground && !(document.visibilityState === "visible" && document.hasFocus())) {
          // The owner may have left again while this check was in flight. Keep the
          // existing lock and recheck on their next return before showing the draft.
          awaitingPreviewReturn = true;
          observePreviewFocus();
          return;
        }
        if (owner === null) {
          try {
            initializeBrowserOwner(nextOwner);
          } catch {
            // A remounted boundary can meet an already initialized, now locked
            // document. Resume still requires that exact verified owner.
            resumeBrowserOwner(nextOwner);
          }
        } else resumeBrowserOwner(nextOwner);
        if (owner === nextOwner && pendingTab.current) pendingTab.current.verified = true;
        owner = nextOwner;
        confirmForeground = false;
        paused = false;
        lastSession = session;
        setState({ kind: "ready", session, message: "", signIn: false });
        // Some browsers retain frame focus while the verified subtree is hidden.
        // A second native window switch then produces no new parent blur to arm the monitor.
        window.clearTimeout(previewFocusTimer);
        previewFocusTimer = window.setTimeout(observePreviewFocus, 0);
      } catch {
        if (!active || attempt !== generation) return;
        pause();
      } finally {
        window.clearTimeout(timeout);
      }
    }

    function clearPreviewPointer() {
      window.clearTimeout(previewPointerTurn);
      previewPointerTurn = undefined;
    }
    function observePreviewFocus() {
      window.clearTimeout(previewFocusTimer);
      if (!active || terminal || paused) return;
      const foreground = document.visibilityState === "visible" && document.hasFocus();
      if (awaitingPreviewReturn) {
        if (foreground) {
          awaitingPreviewReturn = false;
          void verify(false, true);
        }
      } else {
        const frame = document.activeElement;
        const inPreview =
          frame instanceof HTMLIFrameElement && frame.hasAttribute("data-focus-authored-preview");
        // Keep observing a held foreground check even if hiding the frame moved focus to body.
        if (!inPreview && !confirmForeground) return;
        if (foreground) {
          if (inPreview) enteredFrame = frame;
        } else {
          // An OS window switch inside an opaque frame can emit no DOM event.
          // Discard any earlier account check and keep storage locked across the return.
          clearPreviewKeyboard();
          awaitingPreviewReturn = true;
          confirmForeground = true;
          generation++;
          request?.abort();
          window.clearTimeout(deadline);
          clearPreviewPointer();
          lockBrowserOwner();
          void queryClient.cancelQueries();
          setState((previous) => ({ ...previous, kind: "checking" }));
        }
      }
      previewFocusTimer = window.setTimeout(observePreviewFocus, 100);
    }
    function onWindowBlur() {
      clearPreviewKeyboard();
      const frame = document.activeElement;
      if (
        document.hasFocus() &&
        frame instanceof HTMLIFrameElement &&
        frame.hasAttribute("data-focus-authored-preview")
      )
        enteredFrame = frame;
      clearPreviewPointer();
      window.clearTimeout(previewFocusTimer);
      // Firefox assigns activeElement to the child after the parent's blur event.
      previewFocusTimer = window.setTimeout(observePreviewFocus, 0);
    }
    function trackPreviewExit(event: PointerEvent) {
      clearPreviewKeyboard();
      clearPreviewPointer();
      const frame = document.activeElement;
      if (
        event.isTrusted &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        frame instanceof HTMLIFrameElement &&
        frame.hasAttribute("data-focus-authored-preview")
      ) {
        // Browsers emit window focus during this click, before the editor gets pointerup.
        // Only this same-turn transfer originated in the already focused Studio.
        previewPointerTurn = window.setTimeout(clearPreviewPointer, 0);
      }
    }
    const checkVisible = () => {
      clearPreviewKeyboard();
      clearPreviewPointer();
      if (awaitingPreviewReturn) observePreviewFocus();
      else if (document.visibilityState === "visible") void verify(false, true);
    };
    const checkFocus = () => {
      if (awaitingPreviewReturn) {
        observePreviewFocus();
        return;
      }
      if (previewPointerTurn !== undefined) {
        clearPreviewPointer();
        return;
      }
      const frame = enteredFrame;
      enteredFrame = null;
      if (
        frame &&
        !pendingTab.current &&
        document.hasFocus() &&
        document.visibilityState === "visible"
      ) {
        const transfer = capturePreviewReturn(frame);
        if (transfer) {
          lockBrowserOwner();
          generation++;
          request?.abort();
          window.clearTimeout(deadline);
          pendingTab.current = transfer;
          // The next native focus event follows this window-focus event in the same turn.
          returnTurn = window.setTimeout(() => {
            transfer.seal();
            void verify(false, true);
          }, 0);
          return;
        }
      }
      void verify(false, true);
    };
    const checkRestored = (event: PageTransitionEvent) => {
      clearPreviewKeyboard();
      clearPreviewPointer();
      if (event.persisted) void verify(false, true);
    };
    retry.current = () => {
      void verify(true, true);
    };
    void verify();
    document.addEventListener("pointerdown", trackPreviewExit, true);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", checkFocus);
    window.addEventListener("pageshow", checkRestored);
    document.addEventListener("visibilitychange", checkVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void verify();
    }, 45_000);
    return () => {
      active = false;
      generation++;
      request?.abort();
      window.clearTimeout(deadline);
      window.clearInterval(interval);
      window.clearTimeout(previewFocusTimer);
      clearPreviewPointer();
      clearPreviewKeyboard();
      window.clearTimeout(returnTurn);
      pendingTab.current?.release();
      pendingTab.current = null;
      document.removeEventListener("pointerdown", trackPreviewExit, true);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", checkFocus);
      window.removeEventListener("pageshow", checkRestored);
      document.removeEventListener("visibilitychange", checkVisible);
    };
  }, [queryClient]);

  return (
    <>
      {state.kind !== "ready" && (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
          <div className="max-w-lg text-center">
            <p className="mb-5 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              FOCUS
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {state.kind === "checking" ? "Opening your studio" : "Your private studio"}
            </h1>
            <p role="status" className="mt-4 text-base text-muted-foreground">
              {state.kind === "checking"
                ? "Verifying your account before opening saved work…"
                : state.message}
            </p>
            {state.kind === "unverified" && (
              <button
                type="button"
                onClick={() => retry.current()}
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground"
              >
                Retry account verification
              </button>
            )}
            {state.kind === "blocked" && (
              <a
                href={state.signIn ? "/signin-with-chatgpt" : "/"}
                target="_top"
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground"
              >
                {state.signIn ? "Sign in with ChatGPT" : "Reload securely"}
              </a>
            )}
          </div>
        </main>
      )}
      {state.session && (
        <div
          data-focus-hosted-studio=""
          hidden={state.kind !== "ready"}
          inert={state.kind !== "ready"}
        >
          <HostedContext.Provider value={state.session}>
            {state.session.mode === "preview" && (
              <div
                role="status"
                className="border-b border-border bg-muted px-5 py-3 text-center text-sm text-muted-foreground"
              >
                Development preview. Designs stay in this preview browser; online saves require the
                hosted studio.
              </div>
            )}
            {children}
          </HostedContext.Provider>
        </div>
      )}
    </>
  );
}
