import { useState, type CSSProperties } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { PAGE_KINDS, PageType, type PageKind } from "@/components/PageTypes";
import type { Content, Tokens } from "@/lib/design";
import { signalText, APP_SCREENS, type AppScreen, type Experience } from "@/lib/appDesign";
import { AppPreview } from "@/components/AppPreview";

// Renders the owner's real content in a design built only from tokens.
// Inline styles are intentional: the preview's colors are user data, not app theme.
export function DesignPreview({
  t,
  c,
  compact = false,
  phone = false,
  bottomTabs = false,
}: {
  t: Tokens;
  c: Content;
  compact?: boolean;
  phone?: boolean;
  bottomTabs?: boolean;
}) {
  const gap = { airy: 1.6, balanced: 1, compact: 0.65 }[t.density];
  const s = (n: number) => `${Math.pow(t.scale, n)}em`;
  const vars: CSSProperties = {
    backgroundColor: t.bg,
    color: t.ink,
    fontFamily: `"${t.bodyFont}", sans-serif`,
    fontSize: compact ? 9 : 14,
    position: "relative",
    overflow: "hidden",
    backgroundImage:
      t.texture === "grid"
        ? `linear-gradient(${t.muted}22 1px, transparent 1px), linear-gradient(90deg, ${t.muted}22 1px, transparent 1px)`
        : t.texture === "glow"
          ? `radial-gradient(60% 50% at 80% 0%, ${t.accent}40, transparent 70%)`
          : t.texture === "grain"
            ? `radial-gradient(${t.ink}14 0.5px, transparent 0.6px)`
            : t.texture === "stars"
              ? `radial-gradient(circle at 22% 81%, ${t.ink} 1px, transparent 1.6px), radial-gradient(circle at 51% 44%, ${t.accent} 1px, transparent 1.6px), radial-gradient(circle at 83% 12%, ${t.ink} 1px, transparent 1.6px), radial-gradient(circle at 14% 52%, ${t.ink}b0 0.8px, transparent 1.4px), radial-gradient(circle at 69% 77%, ${t.accent}b0 0.8px, transparent 1.4px), radial-gradient(circle at 92% 36%, ${t.ink}b0 0.8px, transparent 1.4px), radial-gradient(ellipse 70% 80% at 50% -25%, ${t.accent}4d, transparent 70%)`
              : undefined,
    backgroundSize:
      t.texture === "grid" ? "2.4em 2.4em" : t.texture === "grain" ? "3px 3px" : undefined,
  };
  const h: CSSProperties = {
    fontFamily: `"${t.headingFont}", serif`,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : "none",
    letterSpacing: t.headingCase === "uppercase" ? "0.03em" : "-0.015em",
    lineHeight: 1.05,
    textWrap: "balance",
    margin: 0,
    fontWeight: 600,
  };
  const btn: CSSProperties = {
    display: "inline-block",
    padding: t.buttonStyle === "underline" ? "0.3em 0" : "0.85em 1.4em",
    fontWeight: 600,
    borderRadius: t.buttonStyle === "pill" ? 999 : t.buttonStyle === "underline" ? 0 : t.radius,
    background: t.buttonStyle === "solid" || t.buttonStyle === "pill" ? t.accent : "transparent",
    color: t.buttonStyle === "solid" || t.buttonStyle === "pill" ? t.accentInk : signalText(t),
    border: t.buttonStyle === "outline" ? `2px solid ${t.accent}` : "none",
    borderBottom: t.buttonStyle === "underline" ? `2px solid ${t.accent}` : undefined,
  };
  if (t.buttonFinish === "glow" && btn.background !== "transparent")
    btn.boxShadow = `0 0.4em 1.6em -0.3em ${t.accent}b3, 0 0 0 1px ${t.accent}`;
  if (t.buttonFinish === "gloss" && btn.background !== "transparent")
    btn.backgroundImage = "linear-gradient(to bottom, rgb(255 255 255 / 0.28), transparent 55%)";
  const glass = t.card === "glass";
  // Frosted boxes: translucent surface over a soft wash of the accent (and second colour).
  const card: CSSProperties = glass
    ? {
        background: `${t.surface}b8`,
        backdropFilter: "blur(14px) saturate(140%)",
        border: `1px solid ${t.ink}1f`,
        boxShadow: `0 0.6em 2em -1em ${t.ink}40`,
      }
    : { background: t.surface, border: `1px solid ${t.muted}25` };
  const pad = phone ? `${1.6 * gap}em ${1.2 * gap}em` : `${2.2 * gap}em ${2.4 * gap}em`;
  const heroText = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `${1.1 * gap}em`,
        maxWidth: t.heroLayout === "split" ? "none" : "34em",
      }}
    >
      <h1
        style={{
          ...h,
          fontSize: s(
            phone ? (t.heroLayout === "poster" ? 4.4 : 3.4) : t.heroLayout === "poster" ? 6 : 4.4,
          ),
        }}
      >
        {c.headline}
      </h1>
      <p style={{ margin: 0, color: t.muted, lineHeight: 1.55, fontSize: "1.05em" }}>{c.sub}</p>
      <div>
        <span style={btn}>{c.cta}</span>
      </div>
      {t.accent2 && (
        <span
          aria-hidden
          data-accent2
          style={{
            display: "block",
            height: 4,
            width: "4em",
            borderRadius: 2,
            background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
            margin: t.heroLayout === "stacked" ? "0 auto" : 0,
          }}
        />
      )}
    </div>
  );
  const art = (
    <div
      style={{
        ...card,
        borderRadius: t.radius,
        minHeight: "11em",
        padding: "1.4em",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      {c.quote ? (
        <p style={{ ...h, fontSize: s(2), fontStyle: "italic" }}>
          “{c.quote.replace(/^["“]+|["”]+$/g, "")}”
        </p>
      ) : (
        <div
          aria-hidden="true"
          style={{ width: "100%", minHeight: "9em", display: "grid", placeItems: "center" }}
        >
          <div
            style={{
              width: "7em",
              height: "7em",
              borderRadius: "50% 50% 4% 4%",
              border: `1.2em solid ${t.accent}`,
              opacity: 0.65,
            }}
          />
        </div>
      )}
    </div>
  );
  return (
    <div style={vars}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: `${1 * gap}em ${(phone ? 1.2 : 2.4) * gap}em`,
          borderBottom: `1px solid ${t.muted}30`,
        }}
      >
        <strong style={{ ...h, fontSize: s(1.5) }}>{c.brand}</strong>
        {phone ? (
          bottomTabs ? null : (
            <span style={{ color: t.ink, fontWeight: 600 }}>Menu</span>
          )
        ) : (
          <span style={{ color: t.muted }}>
            Work · About · <span style={{ color: signalText(t) }}>{c.cta}</span>
          </span>
        )}
      </div>
      <div style={{ padding: pad }}>
        {t.heroLayout === "split" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: phone ? "1fr" : "1.2fr 1fr",
              gap: `${2 * gap}em`,
              alignItems: "center",
            }}
          >
            {heroText}
            {art}
          </div>
        ) : t.heroLayout === "editorial" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: phone ? "1fr" : "1fr 2.2fr",
              gap: `${2 * gap}em`,
              borderTop: `3px solid ${t.ink}`,
              paddingTop: "1em",
            }}
          >
            <span
              style={{
                color: t.muted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.8em",
              }}
            >
              No. 01 — {c.brand}
            </span>
            {heroText}
          </div>
        ) : (
          <div
            style={{
              textAlign: t.heroLayout === "poster" ? "left" : "center",
              display: "flex",
              justifyContent: t.heroLayout === "poster" ? "flex-start" : "center",
            }}
          >
            {heroText}
          </div>
        )}
      </div>
      <div
        data-effects={
          [glass && "glass", t.buttonFinish, t.accent2 && "accent2"].filter(Boolean).join(" ") ||
          undefined
        }
        style={{
          backgroundImage: glass
            ? `radial-gradient(40% 70% at 20% 40%, ${t.accent}38, transparent 70%), radial-gradient(40% 70% at 80% 60%, ${t.accent2 ?? t.accent}38, transparent 70%)`
            : undefined,
          display: "grid",
          gridTemplateColumns: phone ? "1fr" : "repeat(3, 1fr)",
          gap: `${1.2 * gap}em`,
          padding: phone ? `0 ${1.2 * gap}em ${1.6 * gap}em` : `0 ${2.4 * gap}em ${2.4 * gap}em`,
        }}
      >
        {c.features.map((f, i) => (
          <div
            key={i}
            style={{
              ...card,
              borderRadius: t.radius,
              padding: `${1.2 * gap}em`,
              borderTop: t.accent2 ? `3px solid ${i % 2 ? t.accent2 : t.accent}` : card.border,
            }}
          >
            <div
              style={{
                color: signalText(t, t.surface),
                fontVariantNumeric: "tabular-nums",
                fontSize: "0.85em",
                marginBottom: "0.6em",
              }}
            >
              0{i + 1}
            </div>
            <h2 style={{ ...h, fontSize: s(1.4), marginBottom: "0.4em" }}>{f.title}</h2>
            <p style={{ margin: 0, color: t.muted, lineHeight: 1.5 }}>{f.body}</p>
          </div>
        ))}
      </div>
      {phone && bottomTabs && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            height: 56,
            alignItems: "center",
            textAlign: "center",
            background: t.surface,
            borderTop: `1px solid ${t.muted}40`,
            fontSize: "0.85em",
          }}
        >
          {["Home", "Work", "About", c.cta].map((x, k) => (
            <span
              key={x}
              style={{
                color: k === 0 ? signalText(t, t.surface) : t.muted,
                fontWeight: k === 0 ? 600 : 400,
                textDecoration: k === 0 ? "underline" : "none",
              }}
            >
              {x}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Desktop/phone and page-type switches so owners approve the system on more than one page.
export function PreviewFrame({
  t,
  c,
  phoneFirst = false,
  bottomTabs = false,
  experience = "website",
}: {
  t: Tokens;
  c: Content;
  phoneFirst?: boolean;
  bottomTabs?: boolean;
  experience?: Experience | undefined;
}) {
  const narrowScreen = useIsMobile();
  const [chosenPhone, setPhone] = useState<boolean | null>(null);
  const phone = chosenPhone ?? (phoneFirst || narrowScreen);
  const [kind, setKind] = useState<PageKind>("home");
  const [screen, setScreen] = useState<AppScreen>("dashboard");
  const body = (ph: boolean) =>
    experience === "app" ? (
      <AppPreview t={t} c={c} phone={ph} screen={screen} />
    ) : kind === "home" ? (
      <DesignPreview t={t} c={c} phone={ph} bottomTabs={bottomTabs} />
    ) : (
      <PageType kind={kind} t={t} c={c} phone={ph} />
    );
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-card p-1.5">
        <div role="group" aria-label="Page type" className="flex flex-wrap gap-1">
          {experience === "app"
            ? APP_SCREENS.map((k) => (
                <Button
                  key={k.id}
                  size="sm"
                  variant={screen === k.id ? "secondary" : "ghost"}
                  aria-pressed={screen === k.id}
                  onClick={() => setScreen(k.id)}
                >
                  {k.label}
                </Button>
              ))
            : PAGE_KINDS.map((k) => (
                <Button
                  key={k.id}
                  size="sm"
                  variant={kind === k.id ? "secondary" : "ghost"}
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                >
                  {k.label}
                </Button>
              ))}
        </div>
        <div role="group" aria-label="Preview size" className="flex gap-1">
          <Button
            size="sm"
            variant={phone ? "ghost" : "secondary"}
            aria-pressed={!phone}
            onClick={() => setPhone(false)}
          >
            Desktop
          </Button>
          <Button
            size="sm"
            variant={phone ? "secondary" : "ghost"}
            aria-pressed={phone}
            onClick={() => setPhone(true)}
          >
            Phone
          </Button>
        </div>
      </div>
      {phone ? (
        <div className="bg-muted p-4">
          <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[1.25rem] border-4 border-foreground/80 shadow-md">
            {body(true)}
          </div>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Desktop design preview"
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <div className="min-w-[680px]">{body(false)}</div>
        </div>
      )}
    </div>
  );
}
