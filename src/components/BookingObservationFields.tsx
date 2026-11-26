import { emptyBookingDraft, type BookingDraft } from "@/lib/review-room";

const field = "mt-1 block min-h-11 w-full rounded-md border border-input bg-card px-3 text-base";

export function BookingObservationFields({
  draft = emptyBookingDraft(),
  onChange,
}: {
  draft: BookingDraft | undefined;
  onChange: (draft: BookingDraft) => void;
}) {
  function change<K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) {
    onChange({ ...draft, [key]: value });
  }
  return (
    <fieldset className="mt-6 space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 font-semibold">Your booking observations</legend>
      <p className="text-sm text-muted-foreground">
        Only record what you observed. An empty answer stays unmeasured.
      </p>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <label>
          Class you first submitted
          <select
            className={field}
            value={draft.firstClass ?? ""}
            onChange={(e) =>
              change("firstClass", (e.target.value || null) as BookingDraft["firstClass"])
            }
          >
            <option value="">Unknown</option>
            <option value="wheel">Wheel basics</option>
            <option value="glaze">Glaze studio</option>
            <option value="no-submission">I never submitted</option>
          </select>
        </label>
        <label>
          First submission result
          <select
            className={field}
            value={draft.firstResponse ?? ""}
            onChange={(e) =>
              change("firstResponse", (e.target.value || null) as BookingDraft["firstResponse"])
            }
          >
            <option value="">Unknown</option>
            <option value="lost-confirmation">The confirmation was lost</option>
            <option value="confirmed">I saw a booking confirmation</option>
            <option value="blocked">An input or availability issue blocked me</option>
            <option value="no-submission">I never submitted</option>
          </select>
        </label>
        <label>
          Price you stated before submitting (USD)
          <input
            className={field}
            type="text"
            inputMode="decimal"
            maxLength={120}
            value={draft.statedDollars}
            onChange={(e) => change("statedDollars", e.target.value)}
          />
        </label>
        <label>
          Did someone help you?
          <select
            className={field}
            value={draft.helpUsed === null ? "" : draft.helpUsed ? "yes" : "no"}
            onChange={(e) =>
              change("helpUsed", e.target.value === "" ? null : e.target.value === "yes")
            }
          >
            <option value="">Unknown</option>
            <option value="no">No help</option>
            <option value="yes">Someone helped</option>
          </select>
        </label>
        <label>
          Time until you finished or stopped (seconds)
          <input
            className={field}
            type="text"
            inputMode="numeric"
            maxLength={120}
            value={draft.elapsedSeconds}
            onChange={(e) => change("elapsedSeconds", e.target.value)}
          />
        </label>
        <label>
          What happened after the lost confirmation?
          <select
            className={field}
            value={draft.recovery ?? ""}
            onChange={(e) =>
              change("recovery", (e.target.value || null) as BookingDraft["recovery"])
            }
          >
            <option value="">Unknown</option>
            <option value="recovered">I retrieved the confirmation</option>
            <option value="blocked">I was unable to recover it</option>
            <option value="not-seen">I never saw a lost confirmation</option>
          </select>
        </label>
        <label>
          Saved reservations for this practice address
          <input
            className={field}
            type="text"
            inputMode="numeric"
            maxLength={120}
            value={draft.savedReservations}
            aria-describedby="booking-count-help"
            onChange={(e) => change("savedReservations", e.target.value)}
          />
        </label>
      </div>
      <p id="booking-count-help" className="text-xs leading-relaxed text-muted-foreground">
        To check the count, open Practice conditions in the sample, then Check saved reservations.
        Enter the fresh address used for this sample and choose Count reservations. Leave this blank
        if you only saw a confirmation.
      </p>
    </fieldset>
  );
}
