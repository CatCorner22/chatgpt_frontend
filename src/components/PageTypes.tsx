import type { CSSProperties } from "react";
import type { Content, Tokens } from "@/lib/design";
import { signalText } from "@/lib/appDesign";

// Extra page types (pricing, form, article) built only from tokens, so owners can approve
// the design system on more than a home page. Inline styles: preview colors are user data.
export type PageKind = "home" | "pricing" | "form" | "article";
export const PAGE_KINDS: { id: PageKind; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "pricing", label: "Pricing" },
  { id: "form", label: "Form" },
  { id: "article", label: "Article" },
];

function kit(t: Tokens, phone: boolean) {
  const gap = { airy: 1.6, balanced: 1, compact: 0.65 }[t.density];
  const s = (n: number) => `${Math.pow(t.scale, n)}em`;
  const h: CSSProperties = {
    fontFamily: `"${t.headingFont}", serif`,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : "none",
    letterSpacing: t.headingCase === "uppercase" ? "0.03em" : "-0.015em",
    lineHeight: 1.1,
    margin: 0,
    fontWeight: 600,
    textWrap: "balance",
  };
  const filled = t.buttonStyle === "solid" || t.buttonStyle === "pill";
  const btn: CSSProperties = {
    display: "inline-block",
    textAlign: "center",
    padding: t.buttonStyle === "underline" ? "0.3em 0" : "0.85em 1.4em",
    fontWeight: 600,
    borderRadius: t.buttonStyle === "pill" ? 999 : t.radius,
    background: filled ? t.accent : "transparent",
    color: filled ? t.accentInk : signalText(t),
    border: t.buttonStyle === "outline" ? `2px solid ${t.accent}` : "none",
    borderBottom: t.buttonStyle === "underline" ? `2px solid ${t.accent}` : undefined,
  };
  const card: CSSProperties = {
    background: t.surface,
    borderRadius: t.radius,
    border: `1px solid ${t.muted}30`,
    padding: `${1.4 * gap}em`,
  };
  const page: CSSProperties = {
    backgroundColor: t.bg,
    color: t.ink,
    fontFamily: `"${t.bodyFont}", sans-serif`,
    fontSize: 14,
    padding: phone ? `${1.6 * gap}em ${1.2 * gap}em` : `${2.4 * gap}em ${2.6 * gap}em`,
  };
  return { gap, s, h, btn, card, page };
}

export function PageType({
  kind,
  t,
  c,
  phone = false,
}: {
  kind: Exclude<PageKind, "home">;
  t: Tokens;
  c: Content;
  phone?: boolean;
}) {
  const { gap, s, h, btn, card, page } = kit(t, phone);
  const muted = { color: t.muted, margin: 0, lineHeight: 1.55 };
  if (kind === "pricing") {
    const tiers = ["Starter", "Standard", "Complete"];
    return (
      <div style={page}>
        <p
          style={{
            ...muted,
            fontSize: "0.8em",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {c.brand} · Plans
        </p>
        <h1 style={{ ...h, fontSize: s(4), margin: `0.3em 0 0.4em` }}>Pick the plan that fits</h1>
        <p style={{ ...muted, maxWidth: "34em" }}>
          Sample layout — the real prices are yours to set.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: phone ? "1fr" : "repeat(3, 1fr)",
            gap: `${1.2 * gap}em`,
            marginTop: `${2 * gap}em`,
          }}
        >
          {tiers.map((name, i) => (
            <div
              key={name}
              style={{
                ...card,
                outline: i === 1 ? `2px solid ${t.accent}` : undefined,
                display: "flex",
                flexDirection: "column",
                gap: `${0.8 * gap}em`,
              }}
            >
              {i === 1 && (
                <span
                  style={{ color: signalText(t, t.surface), fontSize: "0.8em", fontWeight: 600 }}
                >
                  Most chosen
                </span>
              )}
              <h2 style={{ ...h, fontSize: s(2) }}>{name}</h2>
              <p style={{ ...h, fontSize: s(2.6), fontVariantNumeric: "tabular-nums" }}>$—</p>
              <ul style={{ ...muted, paddingLeft: "1.1em" }}>
                {c.features.slice(0, i + 1).map((f) => (
                  <li key={f.title}>{f.title}</li>
                ))}
              </ul>
              <span style={{ ...btn, marginTop: "auto" }}>{c.cta}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "form") {
    const field: CSSProperties = {
      display: "block",
      width: "100%",
      boxSizing: "border-box",
      marginTop: "0.4em",
      padding: "0.75em 0.9em",
      borderRadius: Math.min(t.radius, 12),
      border: `1.5px solid ${t.muted}80`,
      background: t.bg,
      color: t.ink,
      font: "inherit",
    };
    return (
      <div style={page}>
        <div
          style={{
            ...card,
            maxWidth: "30em",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: `${1 * gap}em`,
          }}
        >
          <h1 style={{ ...h, fontSize: s(3) }}>Get in touch with {c.brand}</h1>
          <p style={muted}>
            Form layout preview. Add your actual response policy before publishing.
          </p>
          <label style={{ fontWeight: 600 }}>
            Your name<span style={{ ...field, color: t.muted, fontWeight: 400 }}>Jordan Lee</span>
          </label>
          <label style={{ fontWeight: 600 }}>
            Email
            <span style={{ ...field, borderColor: "#c62828", fontWeight: 400 }}>jordan@</span>
            <span
              style={{
                display: "block",
                color: t.ink,
                fontWeight: 400,
                fontSize: "0.85em",
                marginTop: "0.35em",
              }}
            >
              ⚠ Add the part after @, like jordan@mail.com
            </span>
          </label>
          <label style={{ fontWeight: 600 }}>
            Message
            <span style={{ ...field, minHeight: "5em", color: t.muted, fontWeight: 400 }}>
              How can we help?
            </span>
          </label>
          <span style={btn}>{c.cta}</span>
        </div>
      </div>
    );
  }
  return (
    <div style={page}>
      <article style={{ maxWidth: "36em", margin: "0 auto" }}>
        <p
          style={{
            ...muted,
            fontSize: "0.8em",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {c.brand} Journal · 4 min read
        </p>
        <h1 style={{ ...h, fontSize: s(4), margin: "0.3em 0 0.5em" }}>{c.headline}</h1>
        <p style={{ ...muted, fontSize: "1.15em", marginBottom: `${1.2 * gap}em` }}>{c.sub}</p>
        {c.features.map((f) => (
          <section key={f.title} style={{ marginBottom: `${1.2 * gap}em` }}>
            <h2 style={{ ...h, fontSize: s(1.8), marginBottom: "0.4em" }}>{f.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.7, fontSize: "1.05em" }}>{f.body}</p>
          </section>
        ))}
        {c.quote && (
          <blockquote
            style={{
              ...h,
              margin: `${1.4 * gap}em 0`,
              paddingLeft: "1em",
              borderLeft: `3px solid ${t.accent}`,
              fontStyle: "italic",
              fontSize: s(1.6),
            }}
          >
            {c.quote.replace(/^["“]+|["”]+$/g, "")}
          </blockquote>
        )}
        <span style={btn}>{c.cta}</span>
      </article>
    </div>
  );
}
