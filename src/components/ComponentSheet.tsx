import type { CSSProperties, ReactNode } from "react";
import { contrast, formatContrast, type Content, type Tokens } from "@/lib/design";

// Static appearance examples, not functional interaction or customer-app checks.
// Inline styles are intentional: these colors are user data, not app theme.
export function ComponentSheet({ t, c }: { t: Tokens; c: Content }) {
  const gap = { airy: 1.4, balanced: 1, compact: 0.7 }[t.density];
  const r = t.radius;
  const h: CSSProperties = {
    fontFamily: `"${t.headingFont}", serif`,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : "none",
    margin: 0,
    fontWeight: 600,
    lineHeight: 1.1,
  };
  const base: CSSProperties = {
    padding: `${0.75 * gap}em ${1.3 * gap}em`,
    fontWeight: 600,
    borderRadius: t.buttonStyle === "pill" ? 999 : r,
    font: "inherit",
    cursor: "default",
  };
  const primary: CSSProperties = {
    ...base,
    background: t.accent,
    color: t.accentInk,
    border: `2px solid ${t.accent}`,
  };
  const secondary: CSSProperties = {
    ...base,
    background: "transparent",
    color: t.ink,
    border: `2px solid ${t.muted}66`,
  };
  const field: CSSProperties = {
    width: "100%",
    padding: `${0.65 * gap}em 0.8em`,
    borderRadius: r,
    border: `1.5px solid ${t.muted}66`,
    background: t.bg,
    color: t.ink,
    font: "inherit",
  };
  const label: CSSProperties = {
    fontSize: "0.8em",
    fontWeight: 600,
    marginBottom: 4,
    display: "block",
  };
  const danger = "#b42318";
  const Row = ({ title, children }: { title: string; children: ReactNode }) => (
    <section
      style={{
        display: "grid",
        gap: `${0.7 * gap}em`,
        paddingBottom: `${1.4 * gap}em`,
        borderBottom: `1px solid ${t.muted}30`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.72em",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: t.muted,
        }}
      >
        {title}
      </p>
      {children}
    </section>
  );
  const ratio = formatContrast(contrast(t.accent, t.accentInk));
  return (
    <div
      style={{
        background: t.bg,
        color: t.ink,
        fontFamily: `"${t.bodyFont}", sans-serif`,
        fontSize: 14,
        padding: `${2 * gap}em`,
        display: "grid",
        gap: `${1.4 * gap}em`,
      }}
    >
      <p style={{ margin: 0, color: t.muted }}>
        Static appearance examples. No action here saves, publishes, or submits anything.
      </p>
      <Row title="Type scale">
        {[4, 3, 2, 1].map((n) => (
          <p key={n} style={{ ...h, fontSize: `${Math.pow(t.scale, n).toFixed(2)}em` }}>
            {n === 4 ? c.brand : c.headline.split(" ").slice(0, 5).join(" ")}
          </p>
        ))}
        <p style={{ margin: 0, lineHeight: 1.6, maxWidth: "38em" }}>{c.sub}</p>
        <p style={{ margin: 0, color: t.muted, fontSize: "0.85em" }}>
          Small print and captions use the muted color.
        </p>
      </Row>
      <Row title={`Buttons · label contrast ${ratio}:1`}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6em", alignItems: "center" }}>
          <button type="button" style={primary}>
            {c.cta}
          </button>
          <button type="button" style={{ ...primary, filter: "brightness(0.9)" }}>
            Hover
          </button>
          <button
            type="button"
            style={{ ...primary, outline: `3px solid ${t.ink}`, outlineOffset: 2 }}
          >
            Keyboard focus
          </button>
          <button type="button" disabled style={{ ...primary, opacity: 0.45 }}>
            Disabled
          </button>
          <button type="button" style={secondary}>
            Secondary
          </button>
          <button
            type="button"
            style={{
              ...base,
              background: "transparent",
              border: "none",
              color: t.accent,
              textDecoration: "underline",
            }}
          >
            Text link
          </button>
        </div>
      </Row>
      <Row title="Form fields">
        <div
          style={{
            display: "grid",
            gap: "0.9em",
            gridTemplateColumns: "repeat(auto-fit, minmax(14em, 1fr))",
          }}
        >
          <div>
            <span style={label}>Email</span>
            <div style={field}>you@example.com</div>
          </div>
          <div>
            <span style={label}>Focused</span>
            <div style={{ ...field, borderColor: t.accent, boxShadow: `0 0 0 3px ${t.accent}33` }}>
              Typing…
            </div>
          </div>
          <div>
            <span style={label}>With error</span>
            <div style={{ ...field, borderColor: danger }}>not-an-email</div>
            <span style={{ color: danger, fontSize: "0.8em" }}>
              Enter an email like name@site.com
            </span>
          </div>
        </div>
      </Row>
      <Row title="Cards">
        <div
          style={{
            display: "grid",
            gap: "0.9em",
            gridTemplateColumns: "repeat(auto-fit, minmax(12em, 1fr))",
          }}
        >
          {c.features.slice(0, 3).map((f) => (
            <div
              key={f.title}
              style={{
                background: t.surface,
                borderRadius: r,
                padding: `${1.1 * gap}em`,
                border: `1px solid ${t.muted}30`,
              }}
            >
              <p style={{ ...h, fontSize: "1.15em" }}>{f.title}</p>
              <p style={{ margin: "0.4em 0 0", color: t.muted, lineHeight: 1.5 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </Row>
      <Row title="Feedback">
        <div style={{ display: "grid", gap: "0.6em" }}>
          <div
            style={{
              borderRadius: r,
              padding: "0.8em 1em",
              background: t.surface,
              borderLeft: "4px solid #2e7d4f",
            }}
          >
            Example success: the request was completed.
          </div>
          <div
            style={{
              borderRadius: r,
              padding: "0.8em 1em",
              background: t.surface,
              borderLeft: `4px solid ${danger}`,
            }}
          >
            Example error: the request could not be completed. Try again.
          </div>
          <div style={{ display: "flex", gap: "0.5em", alignItems: "center", color: t.muted }}>
            <span
              style={{
                width: "8em",
                height: "0.7em",
                borderRadius: 99,
                background: `${t.muted}30`,
              }}
            />
            <span
              style={{
                width: "5em",
                height: "0.7em",
                borderRadius: 99,
                background: `${t.muted}30`,
              }}
            />{" "}
            Loading placeholder
          </div>
          <div
            style={{
              border: `1.5px dashed ${t.muted}66`,
              borderRadius: r,
              padding: "1.2em",
              textAlign: "center",
              color: t.muted,
            }}
          >
            Nothing here yet. <span style={{ color: t.accent, fontWeight: 600 }}>{c.cta}</span>
          </div>
        </div>
      </Row>
      <Row title="Navigation">
        <div style={{ display: "flex", gap: "1.4em", alignItems: "center" }}>
          <span style={{ ...h, fontSize: "1.1em" }}>{c.brand}</span>
          <span style={{ borderBottom: `2px solid ${t.accent}`, paddingBottom: 2 }}>Home</span>
          <span style={{ color: t.muted }}>Work</span>
          <span style={{ color: t.muted }}>About</span>
        </div>
      </Row>
    </div>
  );
}
