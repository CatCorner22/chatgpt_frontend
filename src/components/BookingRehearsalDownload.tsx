import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-blob";

export function BookingRehearsalDownload() {
  const mounted = useRef(false);
  const loading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function download() {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    setStatus("");
    try {
      const { buildBookingRehearsal } = await import("@/lib/booking-rehearsal");
      const archive = await buildBookingRehearsal();
      if (!mounted.current) return;
      downloadBlob(archive, "focus-booking-rehearsal.zip");
      setStatus("Download started. Open START-HERE.md inside the river-kiln folder.");
    } catch {
      if (mounted.current) setStatus("The practice project could not be downloaded. Try again.");
    } finally {
      loading.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer font-medium">Practice with a pottery booking app</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p>
          Give a colleague a working React project to redesign, book a practice class, and undo the
          change on their own computer. The ZIP includes the project and a step-by-step guide.
        </p>
        <p className="text-muted-foreground">
          Use Node 22.12 or newer, npm, and Git. Reservations use made-up details and stay on that
          computer.
        </p>
        <Button type="button" variant="outline" onClick={download} disabled={busy}>
          {busy ? "Preparing practice project…" : "Download booking practice ZIP"}
        </Button>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </details>
  );
}
