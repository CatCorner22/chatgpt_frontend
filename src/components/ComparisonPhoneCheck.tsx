import { useEffect, useState } from "react";
import { measureAuthoredViewport } from "@/lib/authored-viewport";
import { measureComparisonText, type ComparisonMeasurement } from "@/lib/comparison-measurement";

// Mount with the exact renderer HTML as the React key. A different export gets a fresh check.
export function ComparisonPhoneCheck({ html }: { html: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ComparisonMeasurement | null>(null);
  const [issue, setIssue] = useState("");

  useEffect(() => {
    if (!running) return;
    return measureAuthoredViewport(
      html,
      320,
      700,
      measureComparisonText,
      (measured) => {
        setResult(measured);
        setRunning(false);
      },
      () => {
        setIssue("This browser could not measure the page. Open the 320 px preview to inspect it.");
        setRunning(false);
      },
    );
  }, [html, running]);

  return (
    <section aria-label="Phone layout check" className="mt-4 text-sm">
      <button
        type="button"
        className="garden-text-action"
        disabled={running}
        onClick={() => {
          setIssue("");
          setResult(null);
          setRunning(true);
        }}
      >
        Check at 320 px
      </button>
      <div role="status" aria-live="polite" className="mt-1 text-muted-foreground">
        {running && "Checking this page at 320 px…"}
        {issue}
        {result && (
          <>
            <p>
              {result.fits
                ? "The page fits horizontally at 320 px."
                : "The page scrolls sideways at 320 px."}{" "}
              {result.options.length
                ? `${result.options.filter((option) => option.fits).length} of ${result.options.length} options fit across the screen as you scroll down.`
                : "Add your offers to check how each one fits."}
            </p>
            {result.options.length > 0 && (
              <ul className="mt-1 list-inside list-disc">
                {result.options.map((option, index) => (
                  <li key={index}>
                    {option.name} ·{" "}
                    {option.fits
                      ? option.priceText.length
                        ? `Price text fits: ${option.priceText.join(" · ")}`
                        : "Text fits"
                      : "Inspect the text in the phone preview"}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
