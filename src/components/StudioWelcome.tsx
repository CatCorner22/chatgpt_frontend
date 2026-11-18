import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  Check,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { GALLERY, type GalleryItem } from "@/lib/gallery";
import { DesignPreview } from "@/components/DesignPreview";
import { Gallery } from "@/components/Gallery";
import { useDesignFonts } from "@/lib/useDesignFonts";
import type { ReactNode } from "react";
import type { Integration } from "@/lib/design";
import { IntegrationChoice } from "./IntegrationChoice";
import { ReverieArt } from "@/components/BrandArt";
import { useHostedSession } from "@/components/HostedBoundary";
import { REVERIE } from "@/lib/reverie";

const featured = ["purr-and-paper", "midnight-muse", "wildflower-hour"]
  .map((id) => GALLERY.find((g) => g.id === id)!)
  .filter(Boolean);
const palettes = [
  { name: "Garden", bg: "#e8ecdf", ink: "#263e32", accent: "#a9b78e" },
  { name: "Terracotta", bg: "#f0e3d7", ink: "#5a352d", accent: "#bd8b71" },
  { name: "Ink", bg: "#e5e9ee", ink: "#253949", accent: "#9caec1" },
];

export function StudioWelcome({
  brief,
  onBrief,
  onStart,
  busy,
  error,
  resume,
  settings,
  quick,
  onQuick,
  experience,
  onExperience,
  integration,
  onIntegration,
}: {
  brief: string;
  onBrief: (text: string) => void;
  onStart: () => void;
  busy: boolean;
  error: string;
  resume?: ReactNode;
  settings?: ReactNode;
  quick: boolean;
  onQuick: (value: boolean) => void;
  experience: string;
  onExperience: (value: "website" | "app") => void;
  integration: Integration;
  onIntegration: (value: Integration) => void;
} & { onOpen?: never }) {
  const [palette, setPalette] = useState(0);
  const hosted = useHostedSession();
  const p = palettes[palette]!;
  return (
    <main id="main-content" className="studio-welcome">
      <aside className="welcome-tour-invitation" aria-labelledby="welcome-tour-heading">
        <ReverieArt pose="library" />
        <div>
          <h2 id="welcome-tour-heading" className="font-display text-xl">
            Welcome to Focus. Meet Reverie.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{REVERIE.introduction}</p>
        </div>
        <Link to="/welcome" className="welcome-tour-link">
          Take the welcome tour <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </aside>
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-intro">
          <div className="studio-kicker">
            <span /> A little clarity. A lot of possibility.
          </div>
          <h1 id="welcome-title">
            Good design.
            <br />
            Your <em>point of view.</em>
          </h1>
          <p className="welcome-description">
            Turn what you have in mind into a design that feels like you. Explore a direction, make
            it yours, and take it anywhere.
          </p>
          <a href="#start-design" className="welcome-primary">
            Find my direction <ArrowRight size={18} />
          </a>
          <a href="#design-library" className="welcome-secondary">
            Explore the collection <ArrowDown size={15} />
          </a>
          <div className="welcome-note">
            <Check size={15} /> {hosted ? "Your private workspace" : "No account needed"}{" "}
            <span>·</span> Saved in your browser
          </div>
        </div>
        <div className="welcome-art">
          <div className="specimen-chrome">
            <span className="specimen-dots">
              <i />
              <i />
              <i />
            </span>
            <span>Your next great idea</span>
            <span>↗</span>
          </div>
          <div className="welcome-specimen" style={{ background: p.bg, color: p.ink }}>
            <div className="specimen-nav">
              <strong>form & field</strong>
              <span>Objects for everyday living</span>
            </div>
            <div className="specimen-body">
              <div>
                <span className="specimen-eyebrow">LESS, BUT WITH MEANING</span>
                <h2>
                  A slower
                  <br />
                  kind of living.
                </h2>
                <p>
                  Thoughtful objects. Natural materials.
                  <br />A little more room to just be.
                </p>
                <span className="specimen-link">
                  Discover the collection <ArrowUpRight size={14} />
                </span>
              </div>
              <div className="specimen-sculpture" aria-hidden="true">
                <div className="sculpture-shadow" />
                <div className="sculpture-circle" style={{ background: p.accent }} />
                <div className="sculpture-vase" style={{ color: p.accent }} />
                <div className="sculpture-stem" />
                <div className="sculpture-leaf leaf-one" style={{ background: p.ink }} />
                <div className="sculpture-leaf leaf-two" style={{ background: p.ink }} />
              </div>
            </div>
            <div className="specimen-bottom">
              <span>A concept, made yours.</span>
              <span>01 / 03</span>
            </div>
          </div>
          <div className="specimen-controls">
            <div>
              <span className="palette-label">Try a different mood</span>
              <div className="palette-options">
                {palettes.map((x, i) => (
                  <button
                    key={x.name}
                    type="button"
                    onClick={() => setPalette(i)}
                    aria-label={`${x.name} preview palette`}
                    aria-pressed={palette === i}
                    style={{ background: x.ink }}
                  >
                    <span className="sr-only">{x.name}</span>
                    {palette === i && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
            <span className="specimen-caption">
              Small choices.
              <br />
              <strong>A whole different feeling.</strong>
            </span>
          </div>
        </div>
      </section>
      <div className="studio-workflow" aria-label="How Focus works">
        <span>
          <b>01</b> Find your direction
        </span>
        <ArrowRight size={15} />
        <span>
          <b>02</b> Make it your own
        </span>
        <ArrowRight size={15} />
        <span>
          <b>03</b> Build with confidence
        </span>
      </div>
      <section id="start-design" className="start-design" aria-labelledby="start-title">
        <div>
          <p className="eyebrow">A blank page, with a head start</p>
          <h2 id="start-title">
            What are you
            <br />
            bringing to life?
          </h2>
          <p>
            Tell us a little about your project. We’ll match it with three looks from the
            collection.
          </p>
          <div className="local-method">
            <Sparkles size={18} />
            <span>
              Curated designs. Instant suggestions.
              <br />
              No AI credits required.
            </span>
          </div>
        </div>
        <div className="brief-workspace">
          {resume}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (brief.trim().length >= 10 && !busy) onStart();
            }}
          >
            <div className="mb-5">
              <IntegrationChoice value={integration} onChange={onIntegration} />
            </div>
            <div className="brief-label-row">
              <label htmlFor="brief">Your idea, in your words</label>
              <div className="experience-switch" aria-label="Project type">
                {(["website", "app"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={experience === kind}
                    onClick={() => onExperience(kind)}
                  >
                    {kind === "website" ? "Website" : "App"}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="brief"
              value={brief}
              onChange={(e) => onBrief(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="A neighborhood ceramics studio. Thoughtful, a little earthy, and full of things made by hand."
              required
              minLength={10}
            />
            <div className="brief-examples">
              <span>Try an idea</span>
              {[
                "An independent architecture studio with a calm, editorial feel.",
                "A neighborhood coffee shop with a warm, welcoming feel.",
                "A personal finance app that makes money feel less complicated.",
              ].map((ex, i) => (
                <button type="button" key={ex} onClick={() => onBrief(ex)}>
                  {["Architecture", "Coffee shop", "Finance app"][i]} <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
            <details className="brief-settings">
              <summary>
                <SlidersHorizontal size={15} /> Fine-tune your starting point
              </summary>
              <fieldset className="question-length">
                <legend>How much would you like to customize?</legend>
                <label>
                  <input
                    type="radio"
                    name="length"
                    checked={quick}
                    onChange={() => onQuick(true)}
                  />{" "}
                  Quick start · 3 choices
                </label>
                <label>
                  <input
                    type="radio"
                    name="length"
                    checked={!quick}
                    onChange={() => onQuick(false)}
                  />{" "}
                  All the details · 8 choices
                </label>
              </fieldset>
              {settings}
            </details>
            <div className="brief-submit-row">
              <span>
                {brief.trim().length < 10
                  ? "A short sentence is all it takes."
                  : "Your words stay yours."}
              </span>
              <button
                type="submit"
                className="welcome-primary"
                disabled={busy || brief.trim().length < 10}
              >
                {busy ? "Finding your directions…" : "Find my direction"}
                <ArrowRight size={17} />
              </button>
            </div>
            {error && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}

export function StarterCollection({ onOpen }: { onOpen: (g: GalleryItem) => void }) {
  const [expanded, setExpanded] = useState(false);
  useDesignFonts(featured.map((g) => g.direction.tokens));
  return (
    <section id="design-library" className="starter-collection" aria-labelledby="collection-title">
      <div className="collection-heading">
        <div>
          <p className="eyebrow">A considered collection</p>
          <h2 id="collection-title">Start somewhere good.</h2>
          <p>
            Cats, cinematic romance, quiet gardens, and a little mystery. Yours to make your own.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="collection-browse"
          aria-expanded={expanded}
        >
          {expanded ? "Show featured designs" : `Browse all ${GALLERY.length} designs`}
          <ArrowRight size={16} />
        </button>
      </div>
      {!expanded ? (
        <div className="featured-designs">
          {featured.map((g, i) => (
            <button type="button" key={g.id} onClick={() => onOpen(g)} className="featured-design">
              <div className="featured-preview" aria-hidden="true">
                <DesignPreview t={g.direction.tokens} c={g.content} compact />
              </div>
              <div className="featured-meta">
                <div>
                  <span>
                    {["CATS & COZY PAGES", "LITERARY & MYSTERIOUS", "PEACEFUL & BOTANICAL"][i]}
                  </span>
                  <h3>{g.direction.name}</h3>
                </div>
                <ArrowUpRight size={21} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Gallery onPick={onOpen} />
      )}
      <div className="quality-callout">
        <Asterisk className="quality-mark" size={46} aria-hidden="true" />
        <div>
          <h3>Beautiful is a beginning.</h3>
          <p>
            Check the details that help a design work for people. See what was measured and what
            still needs a person.
          </p>
        </div>
        <Link to="/quality" className="collection-browse">
          Open quality workbench <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
