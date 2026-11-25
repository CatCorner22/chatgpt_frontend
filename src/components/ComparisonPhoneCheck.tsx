import { useEffect, useState } from "react";
import { measureComparisonText, type ComparisonMeasurement } from "@/lib/comparison-measurement";

// Mount with the exact renderer HTML as the React key. A different export gets a fresh check.
export function ComparisonPhoneCheck({ html }: { html: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ComparisonMeasurement | null>(null);
  const [issue, setIssue] = useState("");

  useEffect(() => {
    if (!running) return;
    let active = true;
    const frame = document.createElement("iframe");
    frame.title = "320 px layout measurement";
    frame.inert = true;
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.sandbox.add("allow-same-origin");
    frame.referrerPolicy = "no-referrer";
    frame.style.cssText =
      "position:fixed;top:0;left:0;width:320px;height:700px;max-width:none;border:0;padding:0;opacity:0;pointer-events:none;z-index:-1";
    const fail = () => {
      if (!active) return;
      active = false;
      setIssue("This browser could not measure the page. Open the 320 px preview to inspect it.");
      setRunning(false);
    };
    const timer = window.setTimeout(fail, 10000);
    frame.onload = async () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.body.classList.contains("comparison")) return;
        await doc.fonts.ready;
        if (!active || frame.contentDocument !== doc) return;
        const measured = measureComparisonText(doc);
        active = false;
        setResult(measured);
        setRunning(false);
      } catch {
        fail();
      }
    };
    // Only the script-free Focus renderer is accepted here. Keep the visible preview isolated.
    const policy =
      "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; form-action 'none'; base-uri 'none'";
    if (html.includes("<head>")) {
      frame.srcdoc = html.replace(
        "<head>",
        '<head><meta http-equiv="Content-Security-Policy" content="' + policy + '">',
      );
      document.body.append(frame);
    } else {
      fail();
    }
    return () => {
      active = false;
      window.clearTimeout(timer);
      frame.onload = null;
      frame.remove();
    };
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
