import { useState, type ChangeEvent, type FormEvent } from "react";
import styles from "./Booking.module.css";

export type BookingProps = {
  requestBooking: (email: string) => Promise<void>;
};

/** Owned proof fixture: the injected request is controlled by its tests, never a live service. */
export default function Booking({ requestBooking }: BookingProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function changeEmail(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    setStatus("idle");
    setMessage("");
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
    if (!field.validity.valid) {
      setStatus("invalid");
      setMessage("Enter a valid email address to book your lesson.");
      field.focus();
      return;
    }
    const submittedEmail = email;
    setStatus("pending");
    setMessage("Your booking request is in progress.");
    try {
      await requestBooking(submittedEmail);
      setStatus("success");
      setMessage(`Booking confirmed for ${submittedEmail}.`);
    } catch {
      setStatus("failed");
      setMessage("Booking could not be completed. Your email is kept; please try again.");
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Book a pottery lesson</h1>
      <p className={styles.body}>Make a little room for clay and a calm afternoon.</p>
      <form aria-label="Lesson booking" noValidate onSubmit={submitBooking}>
        <label htmlFor="booking-email">Email address</label>
        <input
          id="booking-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={changeEmail}
          disabled={status === "pending"}
          aria-invalid={status === "invalid"}
          aria-describedby="booking-feedback"
        />
        <button className={styles.action} type="submit" disabled={status === "pending"}>
          Book lesson
        </button>
        <div id="booking-feedback" role="status" aria-live="polite">
          {message}
        </div>
      </form>
    </main>
  );
}
