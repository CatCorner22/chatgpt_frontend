import { useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signalText } from "@/lib/appDesign";
import { contrast, normalizeTokens, type Tokens } from "@/lib/design";
import { fontStack } from "@/lib/fonts";

function readableInk(preferred: string, ground: string): string {
  if (contrast(preferred, ground) >= 4.5) return preferred;
  return contrast("#000000", ground) >= 4.5 ? "#000000" : "#ffffff";
}

type ExampleState = "empty" | "loading" | "error";

/** An isolated, ephemeral exercise. It does not change the authored page or its exports. */
export function InteractionLab({ tokens }: { tokens: Tokens }) {
  const t = normalizeTokens(tokens);
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [activations, setActivations] = useState(0);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [example, setExample] = useState<ExampleState>("empty");
  const ink = readableInk(t.ink, t.bg);
  const muted = readableInk(t.muted, t.bg);
  const surfaceInk = readableInk(t.ink, t.surface);
  const accentText = signalText(t);
  const filled = t.buttonStyle === "solid" || t.buttonStyle === "pill";
  const colorsAdjusted =
    ink !== t.ink ||
    muted !== t.muted ||
    surfaceInk !== t.ink ||
    accentText !== t.accent ||
    (filled && readableInk(t.accentInk, t.accent) !== t.accentInk);
  const underlined = t.buttonStyle === "underline";
  const gap = { airy: 24, balanced: 18, compact: 14 }[t.density];
  const control: CSSProperties = {
    minHeight: 44,
    minWidth: 44,
    padding: "10px 16px",
    borderRadius: t.buttonStyle === "pill" ? 999 : t.buttonStyle === "underline" ? 0 : t.radius,
    fontFamily: "inherit",
    fontSize: "inherit",
    fontWeight: 600,
    lineHeight: 1.4,
    cursor: "pointer",
    textDecoration: underlined ? "underline" : "none",
    textUnderlineOffset: "0.2em",
  };
  const primary: CSSProperties = {
    ...control,
    color: filled ? readableInk(t.accentInk, t.accent) : accentText,
    background: filled ? t.accent : "transparent",
    border: `2px solid ${underlined ? "transparent" : filled && contrast(t.accent, t.bg) >= 3 ? t.accent : accentText}`,
  };
  const secondary: CSSProperties = {
    ...control,
    color: ink,
    background: t.bg,
    border: `2px solid ${underlined ? "transparent" : ink}`,
  };
  const sectionStyle: CSSProperties = { display: "grid", gap: 12, minWidth: 0 };
  const rowStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  };
  const headingStyle: CSSProperties = {
    margin: 0,
    fontFamily: fontStack(t.headingFont),
    textTransform: t.headingCase === "uppercase" ? "uppercase" : "none",
    fontSize: `${t.scale}rem`,
    lineHeight: 1.3,
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = emailRef.current;
    if (!input) return;
    setSubmitted(false);
    if (!input.validity.valid) {
      setError(
        input.validity.valueMissing
          ? "Enter an email address to try the demo."
          : "Enter an email address like name@example.com.",
      );
      input.focus();
      return;
    }
    setError("");
    setSubmitted(true);
  }

  return (
    <section
      data-interaction-lab
      aria-labelledby={`${id}-title`}
      style={
        {
          "--interaction-focus": accentText,
          background: t.bg,
          color: ink,
          fontFamily: fontStack(t.bodyFont),
          fontSize: 16,
          lineHeight: 1.6,
          borderRadius: t.radius,
          padding: gap,
          display: "grid",
          gap: gap * 1.5,
        } as CSSProperties
      }
    >
      <style>{`
        [data-interaction-lab] .interaction-control:focus-visible {
          outline: 3px solid var(--interaction-focus);
          outline-offset: 3px;
        }
        [data-interaction-lab] button.interaction-control:hover:not(:disabled) {
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-underline-offset: 0.2em;
          box-shadow: inset 0 0 0 1px currentColor;
        }
      `}</style>
      <header style={sectionStyle}>
        <p style={{ margin: 0, color: muted }}>Local component exercise</p>
        <h3 id={`${id}-title`} style={{ ...headingStyle, fontSize: `${t.scale * t.scale}rem` }}>
          Interaction lab
        </h3>
        <p style={{ margin: 0, maxWidth: "65ch" }}>
          Try buttons, a form, and feedback with your current design. This exercise does not test
          your customer app or add components to your exports.
        </p>
        <p style={{ margin: 0, color: muted }}>
          Use Tab to move between controls, Enter or Space to activate buttons, and Escape to close
          optional help.
        </p>
        {colorsAdjusted && (
          <p style={{ margin: 0, color: ink }}>
            This exercise adjusts some text colors for readability. It does not change your saved
            design or validate the colors in your customer app.
          </p>
        )}
      </header>

      <section aria-labelledby={`${id}-buttons`} style={sectionStyle}>
        <h4 id={`${id}-buttons`} style={headingStyle}>
          Buttons
        </h4>
        <div style={rowStyle}>
          <button
            type="button"
            className="interaction-control"
            style={primary}
            onClick={() => setActivations((count) => count + 1)}
          >
            Try primary button
          </button>
          <button
            type="button"
            className="interaction-control"
            style={secondary}
            onClick={() => setActivations(0)}
          >
            Reset button count
          </button>
          <button
            type="button"
            disabled
            className="interaction-control"
            style={{
              ...secondary,
              color: muted,
              border: `2px dashed ${muted}`,
              cursor: "not-allowed",
            }}
            onClick={() => setActivations((count) => count + 1)}
          >
            Unavailable action
          </button>
        </div>
        <p role="status" aria-live="polite" style={{ margin: 0 }}>
          {activations === 0
            ? "No demo button activations yet."
            : `Primary button activated ${activations} ${activations === 1 ? "time" : "times"} in this exercise.`}
        </p>
        <p style={{ margin: 0, color: muted }}>
          The unavailable action is disabled and cannot be activated.
        </p>
      </section>

      <section aria-labelledby={`${id}-form-title`} style={sectionStyle}>
        <h4 id={`${id}-form-title`} style={headingStyle}>
          Form feedback
        </h4>
        <form
          noValidate
          onSubmit={submit}
          aria-labelledby={`${id}-form-title`}
          style={sectionStyle}
        >
          <label htmlFor={`${id}-email`} style={{ fontWeight: 600 }}>
            Demo email address (required)
          </label>
          <p id={`${id}-email-hint`} style={{ margin: 0, color: muted }}>
            Use a sample address such as name@example.com. Submit an empty or invalid address to see
            the error. Nothing is sent or saved.
          </p>
          <input
            ref={emailRef}
            id={`${id}-email`}
            name="demo-email"
            type="email"
            required
            autoComplete="off"
            spellCheck={false}
            className="interaction-control"
            value={email}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-email-hint${error ? ` ${id}-email-error` : ""}`}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
              setSubmitted(false);
            }}
            style={{
              ...secondary,
              border: `2px solid ${ink}`,
              borderRadius: t.radius,
              textDecoration: "none",
              fontWeight: 400,
              cursor: "text",
              width: "100%",
              maxWidth: 440,
              boxSizing: "border-box",
            }}
          />
          {error && (
            <p id={`${id}-email-error`} role="alert" style={{ margin: 0, fontWeight: 600 }}>
              {error}
            </p>
          )}
          <div>
            <button type="submit" className="interaction-control" style={primary}>
              Try demo form
            </button>
          </div>
          <p role="status" aria-live="polite" style={{ margin: 0 }}>
            {submitted
              ? "Demo only; nothing was sent. The sample address has a valid email format."
              : ""}
          </p>
        </form>
      </section>

      <section aria-labelledby={`${id}-help-title`} style={sectionStyle}>
        <h4 id={`${id}-help-title`} style={headingStyle}>
          Optional help
        </h4>
        <p style={{ margin: 0 }}>
          Hover over or focus this button to read a small extra tip. All instructions needed for
          this exercise stay visible on the page.
        </p>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="interaction-control"
                style={{ ...secondary, justifySelf: "start" }}
              >
                Show optional tip
              </button>
            </TooltipTrigger>
            <TooltipContent
              style={{
                background: t.surface,
                color: surfaceInk,
                fontFamily: fontStack(t.bodyFont),
                fontSize: 14,
                lineHeight: 1.5,
                maxWidth: 280,
                border: `1px solid ${surfaceInk}`,
              }}
            >
              A useful tooltip adds a short explanation without hiding an essential instruction.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </section>

      <details style={sectionStyle}>
        <summary
          className="interaction-control"
          style={{ minHeight: 44, cursor: "pointer", paddingBlock: 10, fontWeight: 600 }}
        >
          Explore loading, error, and empty states
        </summary>
        <fieldset style={{ border: 0, margin: "12px 0", padding: 0 }}>
          <legend style={{ marginBottom: 8 }}>Choose an example state</legend>
          <div style={rowStyle}>
            {(["empty", "loading", "error"] as const).map((state) => (
              <label
                key={state}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 44,
                  paddingInline: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name={`${id}-example`}
                  value={state}
                  checked={example === state}
                  onChange={() => setExample(state)}
                  className="interaction-control"
                  style={{ accentColor: accentText, width: 20, height: 20 }}
                />
                {state === "empty" ? "Empty" : state === "loading" ? "Loading" : "Error"}
              </label>
            ))}
          </div>
        </fieldset>
        <div
          style={{
            background: t.surface,
            color: surfaceInk,
            border: `1px solid ${surfaceInk}`,
            borderRadius: t.radius,
            padding: 16,
          }}
        >
          <p role="status" aria-live="polite" style={{ margin: 0 }}>
            {example === "empty" &&
              "Empty example: no sample items yet. Choose another state to inspect its feedback."}
            {example === "loading" &&
              "Loading example: waiting for sample items. No request is running; change the selection when you are ready."}
            {example === "error" &&
              "Error example: sample items could not load. No real request failed; choose Loading to inspect a retry state."}
          </p>
          {example === "loading" && (
            <div aria-hidden="true" style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {["75%", "50%"].map((width) => (
                <span
                  key={width}
                  style={{
                    width,
                    height: 10,
                    background: surfaceInk,
                    opacity: 0.15,
                    borderRadius: t.radius,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
