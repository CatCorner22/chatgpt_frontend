import React, { useRef, useState, type FormEvent } from "react";
import styles from "./Booking.module.css";

export default function Booking({ scenario }: { scenario: "normal" | "lost-response" }) {
  const [session, setSession] = useState("wheel");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ identity: string; key: string } | null>(null);

  function edit() {
    setComplete(false);
    setMessage("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || complete) return;
    const identity = session + "/" + email.trim().toLowerCase();
    if (attempt.current?.identity !== identity)
      attempt.current = { identity, key: crypto.randomUUID() };
    inFlight.current = true;
    setPending(true);
    setMessage("Checking availability…");
    try {
      const response = await fetch("/api/practice-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, email: email.trim(), key: attempt.current.key, scenario }),
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok || typeof result.number !== "string" || typeof result.total !== "number") {
        setMessage(
          typeof result.message === "string"
            ? result.message
            : "Confirmation unavailable. Submit again to check your reservation.",
        );
        return;
      }
      setMessage(
        "Booking confirmed. Reference " + result.number + " · Total $" + result.total + ".",
      );
      setComplete(true);
    } catch {
      setMessage(
        "Confirmation unavailable. Your details are here. Submit again to check your reservation.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <header>
        <span className={styles.studio}>River Kiln · Pottery studio</span>
        <h1 className={styles.heading}>Find your place at the wheel.</h1>
        <p className={styles.body}>
          Choose a class for a Saturday in the studio. Clay, tools, and firing are included.
        </p>
      </header>
      <form className={styles.form} aria-label="Practice booking" onSubmit={submit}>
        <label htmlFor="session">Class</label>
        <select
          className={styles.field}
          id="session"
          value={session}
          disabled={pending}
          onChange={(event) => {
            setSession(event.target.value);
            edit();
          }}
        >
          <option value="wheel">Wheel basics · 10 am</option>
          <option value="glaze">Glaze studio · 2 pm</option>
        </select>
        <strong className={styles.price} aria-live="polite">
          Total including materials: {session === "wheel" ? "$48" : "$56"}
        </strong>
        <label htmlFor="email">Practice email</label>
        <small id="email-hint">Use a made-up address ending in @example.test.</small>
        <input
          className={styles.field}
          id="email"
          name="email"
          type="email"
          required
          maxLength={100}
          pattern="[a-zA-Z0-9.+_\-]+@example\.test"
          aria-describedby="email-hint"
          autoComplete="off"
          value={email}
          readOnly={pending}
          onChange={(event) => {
            setEmail(event.target.value);
            edit();
          }}
        />
        <button
          className={styles.action}
          type="submit"
          aria-disabled={pending || complete}
          aria-busy={pending}
        >
          Reserve a place
        </button>
        <div className={styles.feedback} role="status" aria-live="polite">
          {message}
        </div>
      </form>
    </main>
  );
}
