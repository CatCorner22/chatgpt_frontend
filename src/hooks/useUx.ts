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
  useEffect(
    () => () => {
      if (t.current) clearTimeout(t.current);
    },
    [],
  );
  const copy = async (k: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setKey(null);
      toast.error("Could not copy. Select the text and copy it manually, or download it.");
      return false;
    }
    setKey(k);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setKey(null), 2000);
    return true;
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
