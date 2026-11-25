import { useEffect, useRef, useState } from "react";
import {
  bookingPreferenceSchema,
  type BookingPreference,
} from "../../north-star-kit/blind-test/booking-preference";
import { useDraftExitSave } from "@/hooks/useDraftExitSave";
import { downloadBlob } from "@/lib/download-blob";
import type { ReviewSession } from "@/lib/review-room";
import { Button } from "./ui/button";

type Choice = BookingPreference["choice"];
type Props = {
  session: ReviewSession;
  primaryJson: string;
};

export function BookingPreferenceBallot({ session, primaryJson }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(false);
  const downloadedChoice = useRef<number | null>(null);
  useDraftExitSave(() => selectedIndex === null || downloadedChoice.current === selectedIndex);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const options: { label: string; answer: Choice }[] = [
    ...session.order.map((id) => ({
      label: session.packet.samples.find((sample) => sample.id === id)!.label,
      answer: { kind: "sample" as const, sampleId: id },
    })),
    { label: "No preference", answer: { kind: "no-preference" } },
    { label: "Could not compare", answer: { kind: "could-not-compare" } },
  ];

  async function download() {
    if (selectedIndex === null || busy) return;
    const choice = options[selectedIndex]!.answer;
    setBusy(true);
    setMessage("");
    try {
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(primaryJson));
      const ballot = bookingPreferenceSchema.parse({
        version: 1,
        kind: "booking-preference",
        benchmarkId: session.packet.benchmarkId,
        reviewerCode: session.reviewerCode.trim(),
        sampleIds: session.order,
        answersSha256: Array.from(new Uint8Array(bytes), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
        choice,
      });
      if (!active.current) return;
      downloadBlob(
        new Blob([JSON.stringify(ballot, null, 2)], { type: "application/json" }),
        "review-preference.json",
      );
      downloadedChoice.current = selectedIndex;
      setMessage("Return the preference file with the matching answers file.");
    } catch {
      if (active.current)
        setMessage(
          "The preference file could not be prepared. You can retry or finish with your answers file.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return (
    <section className="mt-8 border-t border-border pt-6">
      <fieldset disabled={busy}>
        <legend className="font-display text-xl">
          Which booking page would you choose to use again?
        </legend>
        <p className="mt-2 text-sm text-muted-foreground">
          Optional. Your preference downloads separately from your observations.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map(({ label }, index) => (
            <label
              key={index}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="booking-preference"
                checked={selectedIndex === index}
                onChange={() => {
                  setSelectedIndex(index);
                  setMessage("");
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        type="button"
        variant="outline"
        className="mt-4 min-h-11"
        disabled={selectedIndex === null || busy}
        onClick={download}
      >
        Download preference
      </Button>
      {message && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
