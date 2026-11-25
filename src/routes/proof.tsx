import { focusLocalStorage } from "@/lib/browser-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DesignPreview } from "@/components/DesignPreview";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { analyzePage } from "@/lib/critic";
import { normalizeTokens, type Content, type Tokens } from "@/lib/design";
import { STUDIO_KEY } from "@/lib/projects";
import { GENERIC_AI_PAGE, wrapPreview } from "@/lib/proof";
import { socialHead } from "./-social-head";

export const Route = createFileRoute("/proof")({
  head: () =>
    socialHead({
      title: "Proof — Focus vs. generic AI pages",
      description:
        "The same site check measures a typical AI-generated landing page and a Focus design side by side. See exactly what changes.",
      ogDescription:
        "Side-by-side measured comparison: generic AI landing page vs. a Focus Vision.",
      card: "summary_large_image",
    }),
  component: Proof,
});

const SAMPLE_T = normalizeTokens({
  bg: "#f6f1e7",
  surface: "#ece4d4",
  ink: "#1d1a16",
  muted: "#5f574b",
  accent: "#b4441f",
  accentInk: "#ffffff",
  headingFont: "Fraunces",
  bodyFont: "Karla",
  headingCase: "normal",
  scale: 1.25,
  radius: 6,
  density: "balanced",
  heroLayout: "split",
  buttonStyle: "solid",
  texture: "none",
} as Tokens);
const SAMPLE_C: Content = {
  brand: "Kiln & Co",
  headline: "Make something with your hands this week",
  sub: "Six-week wheel classes and small-batch tableware from a neighborhood studio in Portland.",
  cta: "Book a class",
  features: [
    {
      title: "Wheel classes",
      body: "Six evenings, eight students, one patient teacher. Clay and firing included.",
    },
    {
      title: "The shop",
      body: "Mugs, bowls and plates made here, fired in our own kiln, sold in small batches.",
    },
    {
      title: "Open studio",
      body: "Members get a shelf, a wheel and the kiln schedule, three nights a week.",
    },
  ],
  quote: "Best Tuesday night of my week, every week.",
};

function Proof() {
  const [mine, setMine] = useState<{ t: Tokens; c: Content; own: boolean }>({
    t: SAMPLE_T,
    c: SAMPLE_C,
    own: false,
  });
  useEffect(() => {
    try {
      const raw = JSON.parse(focusLocalStorage.getItem(STUDIO_KEY) ?? "null");
      if (raw?.tokens && raw?.content)
        setMine({ t: normalizeTokens(raw.tokens), c: raw.content, own: true });
    } catch {
      /* use sample */
    }
  }, []);
  const generic = analyzePage(GENERIC_AI_PAGE, "");
  const html = wrapPreview(
    renderToStaticMarkup(<DesignPreview t={mine.t} c={mine.c} />),
    mine.c.brand,
    [mine.t.headingFont, mine.t.bodyFont],
  );
  const ours = analyzePage(html, "");
  const rows = generic.findings.map((g) => ({ g, o: ours.findings.find((x) => x.id === g.id)! }));
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 md:px-10">
        {!mine.own && (
          <p className="mb-6 rounded-sm border border-accent/50 bg-accent/10 p-3 text-sm">
            This compares a sample design.{" "}
            <Link to="/" search={{ view: "studio" }} className="underline">
              Make your own
            </Link>{" "}
            and it will appear here instead.
          </p>
        )}
        <p className="eyebrow">Before &amp; after</p>
        <h1 className="mt-2 font-display text-5xl leading-none">
          Compare a generic AI page with a Focus page
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Focus checks a typical AI-generated landing page and{" "}
          {mine.own ? "your Focus design" : "a sample Focus design"} with the exact same rules.
          Measurements prove the floor — taste is still yours to judge.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 border-b border-border pb-6">
          <div>
            <p className="eyebrow">Generic AI page</p>
            <p className="font-display text-7xl leading-none">{generic.score}</p>
          </div>
          <div>
            <p className="eyebrow">{mine.own ? `Your design · ${mine.c.brand}` : "Focus sample"}</p>
            <p className="font-display text-7xl leading-none text-primary">{ours.score}</p>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {rows.map(({ g, o }) => (
            <li key={g.id} className="grid grid-cols-[6rem_1fr_1fr] gap-3 py-3 text-sm">
              <span className="text-muted-foreground">{g.area}</span>
              <span className={g.ok ? "" : "text-destructive"}>
                {g.ok ? "✓" : "✗"} {g.detail}
              </span>
              <span className={o.ok ? "" : "text-destructive"}>
                {o.ok ? "✓" : "✗"} {o.detail}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <figure>
            <figcaption className="eyebrow mb-2">Generic AI page</figcaption>
            <iframe
              title="Generic AI page"
              srcDoc={GENERIC_AI_PAGE}
              sandbox=""
              className="h-80 w-full rounded-sm border border-border bg-card"
            />
          </figure>
          <figure>
            <figcaption className="eyebrow mb-2">
              {mine.own ? "Your design" : "Focus sample"}
            </figcaption>
            <div className="h-80 overflow-hidden rounded-sm border border-border">
              <DesignPreview t={mine.t} c={mine.c} compact />
            </div>
          </figure>
        </div>
        <Button asChild className="mt-8">
          <Link to="/" search={{ view: "studio" }}>
            Make your own
          </Link>
        </Button>
      </main>
    </div>
  );
}
