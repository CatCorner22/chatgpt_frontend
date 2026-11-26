import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_IMAGE_FRAMING,
  IMAGE_NARROW_BREAKPOINT,
  IMAGE_POSITIONS,
  IMAGE_POSITION_LABELS,
  normalizeImageFraming,
  type ImageFraming,
  type ImagePosition,
} from "@/lib/image-framing";

export type ImageFramingControlsProps = {
  value?: ImageFraming | undefined;
  onChange: (value: ImageFraming) => void;
  disabled?: boolean;
};

/** Framing is controlled by the page settings; image bytes and descriptions stay untouched. */
export function ImageFramingControls({
  value,
  onChange,
  disabled = false,
}: ImageFramingControlsProps) {
  const id = useId();
  const framing = normalizeImageFraming(value);
  const narrowOverride = framing.narrowPosition !== "same";
  const update = (patch: Partial<ImageFraming>) => {
    if (!disabled) onChange(normalizeImageFraming({ ...framing, ...patch }));
  };
  const selectClass =
    "block min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-60";
  const positions = IMAGE_POSITIONS.map((position) => (
    <option key={position} value={position}>
      {IMAGE_POSITION_LABELS[position]}
    </option>
  ));
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={`${id}-export-help`}
      className="min-w-0 space-y-4 border-t border-border pt-4"
    >
      <legend className="text-sm font-medium">Image framing</legend>
      <p id={`${id}-export-help`} className="text-sm leading-relaxed text-muted-foreground">
        The HTML and ZIP include the full image file and any embedded location data. To keep part of
        a photo or its location private, crop it or remove location data before uploading.
      </p>
      <fieldset aria-describedby={`${id}-fit-help`}>
        <legend className="mb-2 text-sm font-medium">How should the image fit?</legend>
        <div className="grid gap-2">
          {(
            [
              ["cover", "Fill the frame"],
              ["contain", "Show the whole image"],
            ] as const
          ).map(([fit, label]) => (
            <label
              key={fit}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${framing.fit === fit ? "border-foreground bg-secondary" : "border-border"}`}
            >
              <input
                type="radio"
                name={`${id}-fit`}
                value={fit}
                checked={framing.fit === fit}
                onChange={() => update({ fit })}
                className="size-4 shrink-0"
              />
              {label}
            </label>
          ))}
        </div>
        <p id={`${id}-fit-help`} className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {framing.fit === "contain"
            ? "The whole image is centered inside the frame. Space may remain around it against the frame’s background. Your fill positions are kept if you switch back."
            : "The image fills the frame. Choose the part to keep in view; some edges may still be cropped."}
        </p>
      </fieldset>
      {framing.fit === "cover" && (
        <>
          <div className="space-y-2">
            <label htmlFor={`${id}-position`} className="block text-sm font-medium">
              Image position
            </label>
            <select
              id={`${id}-position`}
              value={framing.position}
              className={selectClass}
              aria-describedby={`${id}-position-help`}
              onChange={(event) => update({ position: event.currentTarget.value as ImagePosition })}
            >
              {positions}
            </select>
            <p id={`${id}-position-help`} className="text-sm leading-relaxed text-muted-foreground">
              This position applies at every size unless you choose a different one below.
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={narrowOverride}
              className="size-4 shrink-0"
              onChange={(event) =>
                update({ narrowPosition: event.currentTarget.checked ? framing.position : "same" })
              }
            />
            Use a different position on small screens
          </label>
          {narrowOverride && (
            <div className="space-y-2">
              <label htmlFor={`${id}-narrow`} className="block text-sm font-medium">
                Small-screen image position
              </label>
              <select
                id={`${id}-narrow`}
                value={framing.narrowPosition}
                className={selectClass}
                onChange={(event) =>
                  update({ narrowPosition: event.currentTarget.value as ImagePosition })
                }
              >
                {positions}
              </select>
            </div>
          )}
        </>
      )}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 text-sm"
        onClick={() => {
          if (!disabled) onChange({ ...DEFAULT_IMAGE_FRAMING });
        }}
      >
        Reset image framing
      </Button>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          How image framing works
        </summary>
        <div className="space-y-2 pb-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            A position guides which part of the image stays in its frame. It does not edit or
            replace your image. A wide photograph and a tall portrait can need different framing.
          </p>
          <p>
            The small-screen setting applies to page layouts {IMAGE_NARROW_BREAKPOINT} pixels wide
            or less. Use the 320 px preview to inspect it, and 1024 px to inspect the wider layout.
            Fit uses the available preview space, so Fit can also show the small-screen layout.
          </p>
          <p>
            These settings change this authored page’s preview, working HTML and page ZIP. They do
            not restyle a customer’s existing app or website. Review the actual image at different
            widths before publishing.
          </p>
        </div>
      </details>
    </fieldset>
  );
}
