import React, { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import Booking from "./Booking";

function ReservationCount() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult("");
    try {
      const response = await fetch("/api/practice-booking-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address.trim() }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Count unavailable");
      const { reservations } = await response.json();
      if (!Number.isSafeInteger(reservations) || reservations < 0) throw new Error("Invalid count");
      setResult("Saved reservations for this address: " + reservations + ".");
    } catch {
      setResult("The count is unavailable. Check the local preview and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details>
      <summary>Check saved reservations</summary>
      <form onSubmit={checkCount} aria-label="Reservation count">
        <p>
          After the task, an observer can check how many reservations the practice service saved.
        </p>
        <label htmlFor="count-address">Address used for the booking</label>{" "}
        <input
          id="count-address"
          type="email"
          required
          maxLength={100}
          pattern="[a-zA-Z0-9.+_\-]+@example\.test"
          autoComplete="off"
          readOnly={busy}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setResult("");
          }}
        />{" "}
        <button type="submit" disabled={busy}>
          Count reservations
        </button>
        <p role="status">{result}</p>
      </form>
    </details>
  );
}

export default function Rehearsal() {
  const [loseReply, setLoseReply] = useState(false);
  return (
    <>
      <Booking scenario={loseReply ? "lost-response" : "normal"} />
      <details>
        <summary>Practice conditions</summary>
        <p>Wheel basics has space. Glaze studio fills just before confirmation.</p>
        <label>
          <input
            type="checkbox"
            checked={loseReply}
            onChange={(event) => setLoseReply(event.target.checked)}
          />{" "}
          Lose the first confirmation for a new reservation
        </label>
        <p>All reservations stay in this local practice server until you stop it.</p>
        <ReservationCount />
      </details>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Rehearsal />);
