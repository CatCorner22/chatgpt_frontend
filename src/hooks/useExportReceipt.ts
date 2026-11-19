import { useLayoutEffect, useRef, useState } from "react";
import { getBrowserOwnerId } from "@/lib/browser-storage";

type ExportRequest = { generation: number; request: number; owner: string | null };
export type PendingExportReceipt = { filename: string; confirm: () => void };

/** A browser download attempt is not evidence of receipt. Keep confirmation local to
 * one committed snapshot, session, request and mounted lifetime, including A→B→A edits. */
export function useExportReceipt(snapshot: string, sessionOwner: string | null) {
  const lifetime = useRef({ mounted: false, generation: 0, request: 0 });
  const [pending, setPending] = useState<PendingExportReceipt | null>(null);

  useLayoutEffect(() => {
    const current = lifetime.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.generation++;
      current.request++;
    };
  }, []);
  useLayoutEffect(() => {
    lifetime.current.generation++;
    lifetime.current.request++;
    setPending(null);
  }, [snapshot, sessionOwner]);

  const begin = (): ExportRequest => {
    const request = ++lifetime.current.request;
    setPending(null);
    return {
      request,
      generation: lifetime.current.generation,
      owner: getBrowserOwnerId(),
    };
  };
  const isCurrent = (request: ExportRequest) => {
    if (
      !lifetime.current.mounted ||
      request.generation !== lifetime.current.generation ||
      request.request !== lifetime.current.request
    )
      return false;
    try {
      return request.owner === getBrowserOwnerId();
    } catch {
      return false;
    }
  };
  const offer = (request: ExportRequest, filename: string, onConfirmed: () => void) => {
    if (!isCurrent(request)) return;
    const offered: PendingExportReceipt = {
      filename,
      confirm: () => {
        const current = isCurrent(request);
        // Consume before calling out so even a retained click handler cannot credit twice.
        if (current) lifetime.current.request++;
        if (lifetime.current.mounted) setPending((latest) => (latest === offered ? null : latest));
        if (current) onConfirmed();
      },
    };
    setPending(offered);
  };
  return { pending, begin, isCurrent, offer };
}
