import { useEffect, useState } from "react";
import { bookingProtocol } from "../../north-star-kit/blind-test/reviewer";
import {
  MAX_REVIEW_PACKET_BYTES,
  parseReviewerPacket,
  type ReviewerPacket,
} from "@/lib/review-room";
import { Button } from "./ui/button";
import { ReviewWorkspace } from "./ReviewWorkspace";

/** Open only the two local practice pages for the study supplied by the launcher. */
async function loadPacket(signal: AbortSignal) {
  const response = await fetch("/packet.json", {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal,
  });
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_REVIEW_PACKET_BYTES)
    throw new Error("Packet unavailable");
  const packet = parseReviewerPacket(await response.text());
  const origins = packet.samples.map(({ assetRef }) => new URL(assetRef));
  if (
    packet.tasks.length !== 1 ||
    packet.tasks[0]?.observationProtocol !== bookingProtocol ||
    packet.samples.length !== 2 ||
    packet.samples.some((sample) => sample.kind !== "interactive") ||
    origins.some(
      (url) =>
        url.hostname !== "127.0.0.1" ||
        url.protocol !== "http:" ||
        !url.port ||
        url.origin === window.location.origin,
    ) ||
    origins[0]!.origin === origins[1]!.origin
  )
    throw new Error("Invalid local booking pair");
  return packet;
}

export function PreparedBookingRoom() {
  const [packet, setPacket] = useState<ReviewerPacket | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadPacket(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setPacket(value);
      },
      () => {
        if (!controller.signal.aborted) setFailed(true);
      },
    );
    return () => controller.abort();
  }, [attempt]);

  if (packet) return <ReviewWorkspace preparedPacket={packet} />;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-3xl">Booking review</h1>
      {failed ? (
        <>
          <p role="alert" className="my-4">
            The booking study could not open. Keep the local launcher running and retry.
          </p>
          <Button
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </Button>
        </>
      ) : (
        <p role="status" className="mt-4">
          Opening the two-page study…
        </p>
      )}
    </main>
  );
}
