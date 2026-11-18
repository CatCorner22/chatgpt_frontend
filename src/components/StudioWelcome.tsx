import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Asterisk, SlidersHorizontal, Sparkles } from "lucide-react";
import { GALLERY, type GalleryItem } from "@/lib/gallery";
import { DesignPreview } from "@/components/DesignPreview";
import { Gallery } from "@/components/Gallery";
import { useDesignFonts } from "@/lib/useDesignFonts";
import type { ReactNode } from "react";
import type { Integration } from "@/lib/design";
import { IntegrationChoice } from "./IntegrationChoice";
import { ReverieArt } from "@/components/BrandArt";

const featured = ["purr-and-paper", "midnight-muse", "wildflower-hour"]
  .map((id) => GALLERY.find((g) => g.id === id)!)
  .filter(Boolean);

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
  return (
    <main id="main-content" className="studio-welcome studio-welcome--calm">
      <section id="start-design" className="start-design" aria-labelledby="start-title">
        <div>
          <p className="eyebrow">Vision · your design direction</p>
          <h1 id="start-title">What should this page help people do?</h1>
          <p>
            Tell me who it is for, what they need, and the feeling you have in mind. We’ll find
            three starting points from the collection.
          </p>
          <ReverieArt pose="library" />
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
