import { useEffect, useRef, useState } from "react";
import { waitMessage } from "@/lib/ux";
import { toast } from "sonner";

// Warns before leaving only while something would be lost.
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active]);
}

// Elapsed-time message for a running task.
export function useWait(busy: boolean, label: string) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!busy) {
      setMs(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => setMs(Date.now() - start), 500);
    return () => clearInterval(t);
  }, [busy]);
  return busy ? waitMessage(ms, label) : null;
}

// In-place "Copied ✓" for two seconds.
export function useCopied() {
  const [key, setKey] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lifetime = useRef({ mounted: false, epoch: 0 });
  const pending = useRef<symbol | null>(null);
  useEffect(() => {
    const current = lifetime.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.epoch++;
      if (t.current !== null) clearTimeout(t.current);
    };
  }, []);
  const copy = async (k: string, text: string) => {
    if (!lifetime.current.mounted) return false;
    // Clipboard writes cannot be cancelled. Do not let two writes race in this hook.
    if (pending.current !== null) {
      toast.error("A copy is still in progress. Wait for it to finish, then copy again.");
      return false;
    }
    const request = Symbol();
    pending.current = request;
    const epoch = lifetime.current.epoch;
    const current = () => lifetime.current.mounted && lifetime.current.epoch === epoch;
    if (t.current !== null) clearTimeout(t.current);
    t.current = null;
    setKey(null);
    try {
      await navigator.clipboard.writeText(text);
      if (!current()) return false;
      setKey(k);
      t.current = setTimeout(() => {
        if (current()) setKey(null);
        t.current = null;
      }, 2000);
      return true;
    } catch {
      if (!current()) return false;
      setKey(null);
      toast.error("Could not copy. Select the text and copy it manually, or download it.");
      return false;
    } finally {
      if (pending.current === request) pending.current = null;
    }
  };
  return { copied: key, copy };
}

// Lets a person stop waiting for a read-only request. Late answers from a cancelled request are ignored.
export function useCancellable() {
  const req = useRef(0);
  return {
    start: () => ++req.current,
    current: (id: number) => id === req.current,
    cancel: () => {
      req.current++;
    },
  };
}
