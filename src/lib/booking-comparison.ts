import practiceComponent from "../../examples/booking-rehearsal/src/Booking.tsx?raw";
import {
  hasHiddenSourceText,
  requireTrial,
  SOURCE_TRIAL_LIMITS,
  trialMarker,
} from "./source-trial-model";

export type BookingComparisonChoice = {
  value: string;
  label: string;
  time: string;
  total: string;
};

// Recognize the owned form, including its state and submit handler. These are the
// only customer-editable slots for this treatment. Other forms need guided edits.
const optionLine =
  /^ {10}<option value="(wheel|glaze)">([^<>{}·\r\n]{1,100}) · ([^<>{}·\r\n]{1,40})<\/option>$/gm;
const quotedTotals =
  /\{session === "wheel" \? "(\$(?:0|[1-9]\d{0,5})(?:\.\d{2})?)" : "(\$(?:0|[1-9]\d{0,5})(?:\.\d{2})?)"\}/;
const pickerStart = '        <label htmlFor="session">Class</label>';
const pickerEnd = "        </strong>";
const declaration = "export default function Booking(";

function formShape(source: string) {
  return source
    .replace(optionLine, '<option value="$1">…</option>')
    .replace(quotedTotals, "{…}")
    .replace(/(<h1 className=\{styles\.heading\}>)[^<>{}\r\n]+(<\/h1>)/, "$1…$2")
    .replace(/(<p className=\{styles\.body\}>\n {10})[^<>{}\r\n]+(\n {8}<\/p>)/, "$1…$2");
}

const recognizedShape = formShape(practiceComponent.replace(/\r\n/g, "\n"));

/** Read literal display data without evaluating any part of the uploaded project. */
export function inspectBookingComparison(
  componentSource: string,
): BookingComparisonChoice[] | null {
  if (
    typeof componentSource !== "string" ||
    componentSource.length > SOURCE_TRIAL_LIMITS.componentBytes ||
    hasHiddenSourceText(componentSource)
  )
    return null;
  const source = componentSource.replace(/\r\n/g, "\n");
  if (formShape(source) !== recognizedShape) return null;
  const rows = [...source.matchAll(optionLine)];
  const prices = quotedTotals.exec(source);
  if (rows.length !== 2 || !prices) return null;
  const choices: BookingComparisonChoice[] = [];
  for (const [index, row] of rows.entries()) {
    const [, value, label, time] = row;
    const total = prices[index + 1];
    if (
      !value ||
      !label ||
      !time ||
      !total ||
      [label, time].some(
        (text) => text.trim() !== text || /&(?:#|[a-zA-Z][a-zA-Z0-9]*;)/.test(text),
      )
    )
      return null;
    choices.push({ value, label, time, total });
  }
  return choices;
}

/** Source hashes and inverse patches cover both edits alongside the rest of the trial. */
export function applyBookingComparison(componentSource: string, marker: string, textColor: string) {
  requireTrial(trialMarker.test(marker), "Select a valid page scope for the booking comparison.");
  requireTrial(
    /^#[a-f\d]{6}$/i.test(textColor),
    "The booking comparison needs a readable text color.",
  );
  const unscoped = componentSource.replace(
    `className={styles.page + " ${marker}"}`,
    "className={styles.page}",
  );
  const choices = inspectBookingComparison(unscoped);
  requireTrial(
    choices,
    "This page needs a developer-guided class comparison. Its picker, prices or booking logic differ from the supported form.",
  );

  const eol = componentSource.includes("\r\n") ? "\r\n" : "\n";
  const literal = JSON.stringify;
  const records = choices.map(({ value, label, time, total }) => {
    return `  { value: ${literal(value)}, label: ${literal(label)}, time: ${literal(time)}, total: ${literal(total)} },`;
  });
  const data = ["const focusClassChoices = [", ...records, "];", "", ""].join(eol);
  const controls = `        <fieldset id="session" data-focus-booking-choices="" disabled={pending}>
          <legend>Class</legend>
          {focusClassChoices.map((choice) => (
            <label key={choice.value}>
              <input
                type="radio"
                name="session"
                value={choice.value}
                checked={session === choice.value}
                onChange={(event) => {
                  setSession(event.target.value);
                  edit();
                }}
              />
              <span><b>{choice.label}</b><small>{choice.time}</small></span>
              <b>{choice.total}</b>
            </label>
          ))}
        </fieldset>
        <strong className={styles.price} aria-live="polite">
          Total including materials: {focusClassChoices.find((choice) => choice.value === session)?.total}
        </strong>`.replace(/\n/g, eol);
  const start = componentSource.indexOf(pickerStart);
  const end = componentSource.indexOf(pickerEnd, start) + pickerEnd.length;
  const component =
    componentSource.slice(0, start).replace(declaration, () => data + declaration) +
    controls +
    componentSource.slice(end);

  const scope = `:global(.${marker}) [data-focus-booking-choices]`;
  const stylesheetAddition = `
${scope} {
  min-inline-size: 0;
  color: ${textColor};
  margin: 0;
  padding: 0;
  border: 0;
}
${scope} legend {
  padding: 0;
  font-weight: 600;
}
${scope} label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: .65rem;
  min-block-size: 44px;
  margin-block: .4rem;
  padding: .5rem .65rem;
  border: 1px solid currentColor;
  border-radius: .45rem;
  overflow-wrap: anywhere;
}
${scope} label:has(:checked) {
  box-shadow: inset 0 0 0 1px currentColor;
}
${scope} label:focus-within {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
${scope} small {
  display: block;
}
`.replace(/\n/g, eol);
  return { component, stylesheetAddition };
}
