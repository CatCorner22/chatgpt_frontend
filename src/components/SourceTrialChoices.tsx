import { useId, useState } from "react";
import { getAuthoredFontAvailability } from "@/lib/authored-font-availability";
import type { BookingComparisonChoice } from "@/lib/booking-comparison";
import type { SourceTrialOptions } from "@/lib/source-trial";

type ChoiceProps = {
  name: string;
  value: string;
  title: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChoose: () => void;
};

function Choice({ name, value, title, detail, checked, disabled, onChoose }: ChoiceProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex min-h-11 min-w-0 items-start gap-3 rounded-lg border p-3 ${checked ? "border-primary bg-background" : "border-border"} ${disabled ? "text-muted-foreground" : "cursor-pointer"}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-detail`}
        className="mt-0.5 size-4 shrink-0 accent-primary"
        onChange={onChoose}
      />
      <span className="min-w-0">
        <span id={`${id}-title`} className="block font-medium">
          {title}
        </span>
        <span id={`${id}-detail`} className="mt-1 block text-xs leading-relaxed">
          {detail}
        </span>
      </span>
    </label>
  );
}

function BookingPickerPreview({
  choices,
  layout,
}: {
  choices: BookingComparisonChoice[];
  layout: SourceTrialOptions["bookingLayout"];
}) {
  const id = useId();
  const [value, setValue] = useState(choices[0]!.value);
  const selected = choices.find((item) => item.value === value) ?? choices[0]!;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-lg border border-border bg-background p-4"
    >
      <h5 id={`${id}-title`} className="font-medium">
        Class picker preview
      </h5>
      {layout === "compact" ? (
        <label className="block">
          Class
          <select
            value={selected.value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1 block min-h-11 w-full rounded-md border border-input bg-background px-3"
          >
            {choices.map(({ value, label, time }) => (
              <option key={value} value={value}>
                {label} · {time}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <fieldset>
          <legend>Class</legend>
          <div className="mt-1 grid gap-2">
            {choices.map(({ value, label, time, total }) => (
              <label
                key={value}
                className="grid min-h-11 min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-input px-3 py-2 has-[:checked]:border-foreground focus-within:outline-2 focus-within:outline-offset-2"
              >
                <input
                  type="radio"
                  name={`${id}-class`}
                  value={value}
                  checked={selected.value === value}
                  onChange={() => setValue(value)}
                  className="mt-1 shrink-0 accent-primary"
                />
                <span className="min-w-0 break-words">
                  <strong className="block">{label}</strong>
                  <small>{time}</small>
                </span>
                <strong>{total}</strong>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p aria-live="polite" className="font-medium">
        Total including materials: {selected.total}
      </p>
      <p className="text-xs text-muted-foreground">
        These class details come from your selected file. Choosing a class here only changes the
        preview.
      </p>
    </section>
  );
}

type Props = {
  headingFont: string;
  bodyFont: string;
  options: SourceTrialOptions;
  onChange: (options: SourceTrialOptions) => void;
  booking: BookingComparisonChoice[] | null;
  gardenComparison: boolean;
};

export function SourceTrialChoices({
  headingFont,
  bodyFont,
  options,
  onChange,
  booking,
  gardenComparison,
}: Props) {
  const id = useId();
  const { missingFamilies } = getAuthoredFontAvailability(headingFont, bodyFont);
  const selectedFonts = [...new Set([headingFont, bodyFont])].join(" and ");
  return (
    <div className="space-y-5 text-sm">
      <fieldset className="space-y-2">
        <legend className="font-medium">Which fonts should this page use?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            name={`${id}-fonts`}
            value="preserve"
            title="Keep the page’s fonts"
            detail="Keep the type your visitors already see. The trial can still update colors and button corners."
            checked={options.typography === "preserve"}
            onChoose={() => onChange({ ...options, typography: "preserve" })}
          />
          <Choice
            name={`${id}-fonts`}
            value="portable"
            title="Use my design’s fonts"
            detail={
              missingFamilies.length
                ? `Focus has no portable copy of ${missingFamilies.join(" or ")}. Keep your page’s fonts here or ask your developer to supply licensed copies.`
                : `Include ${selectedFonts} and the licenses in the download. The bundled fonts cover Latin text. Other characters can use a fallback.`
            }
            disabled={!!missingFamilies.length}
            checked={options.typography === "portable"}
            onChoose={() => onChange({ ...options, typography: "portable" })}
          />
        </div>
      </fieldset>
      {booking ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img
              src="/brand/cat-handoff.png"
              width={56}
              height={51}
              loading="lazy"
              decoding="async"
              alt=""
              className="w-14 shrink-0"
            />
            <p>
              <strong>Reverie asks</strong>
              <br />
              Would it help visitors to see every class time and total before they choose?
            </p>
          </div>
          {gardenComparison && (
            <p>
              Your Garden brief calls for comparing options. Try both pickers with your class
              details.
            </p>
          )}
          <fieldset>
            <legend className="mb-2 font-medium">How should visitors choose a class?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice
                name={`${id}-layout`}
                value="compact"
                title="Keep the compact picker"
                detail="Takes less space. Visitors choose a class to see its total."
                checked={options.bookingLayout === "compact"}
                onChoose={() => onChange({ ...options, bookingLayout: "compact" })}
              />
              <Choice
                name={`${id}-layout`}
                value="compare"
                title="Compare times and totals"
                detail="Shows both prices and times together. It takes more room on a small screen."
                checked={options.bookingLayout === "compare"}
                onChoose={() => onChange({ ...options, bookingLayout: "compare" })}
              />
            </div>
          </fieldset>
          <BookingPickerPreview choices={booking} layout={options.bookingLayout} />
        </div>
      ) : (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-medium">
            Change how visitors compare options
          </summary>
          <p>
            {gardenComparison ? "Your Garden brief requests a comparison. " : ""}This file has no
            supported class picker. Ask your developer to map each choice to its price, time and
            booking action in the preview.{" "}
            <a href="#target-prompts-heading" className="underline">
              Open the handoff prompts
            </a>
            .
          </p>
        </details>
      )}
    </div>
  );
}
