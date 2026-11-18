import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { DesignPreview } from "@/components/DesignPreview";
import { matchDirections } from "@/lib/matcher";
import { inspireFromSite } from "@/lib/inspire.functions";
import { useDesignFonts } from "@/lib/useDesignFonts";
import type { GalleryItem } from "@/lib/gallery";
import type { Tokens } from "@/lib/design";
import { useUser } from "@/hooks/useSession";
import { useHostedSession } from "@/components/HostedBoundary";
import { Link } from "@tanstack/react-router";

export type OpenMode = "exam" | "rx";
const SAMPLE = {
  headline: "Say what you do in one clear sentence.",
  sub: "Sample words for the preview. Replace them with your own business's words.",
  cta: "Get started",
  features: [
    { title: "First service", body: "Sample service description - replace with yours." },
    { title: "Second service", body: "Sample service description - replace with yours." },
    { title: "Third service", body: "Sample service description - replace with yours." },
  ],
  quote: "Sample quote - use a real customer's words, never invented ones.",
};

// Faster start: describe the business -> three matched designs -> fine-tune or go straight to the Vision.
export function QuickStart({ onOpen }: { onOpen: (g: GalleryItem, mode: OpenMode) => void }) {
  const user = useUser();
  const hosted = useHostedSession();
  const canReadSite = hosted ? Boolean(hosted.user) : Boolean(user);
  const [text, setText] = useState("");
  const matches = useMemo(() => matchDirections(text), [text]);
  const [site, setSite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<{ host: string; tokens: Tokens; notes: string[] } | null>(
    null,
  );
  const inspire = useServerFn(inspireFromSite);
  useDesignFonts([...matches.map((m) => m.item.direction.tokens), found?.tokens]);

  const read = async () => {
    if (!canReadSite || busy) return;
    setBusy(true);
    setErr(null);
    setFound(null);
    try {
      const r = await inspire({ data: { url: site } });
      if (r.ok) setFound({ host: r.host, tokens: r.tokens, notes: r.notes });
      else setErr(r.error);
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Something went wrong reading that site. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const siteItem = (f: NonNullable<typeof found>): GalleryItem => ({
    id: `site-${f.host}`,
    inspiration: f.host,
    brief: `A look inspired by ${f.host}. ${text}`.trim(),
    direction: {
      name: `Inspired by ${f.host}`,
      mood: "Colours and type read from a site you admire.",
      why: f.notes.join(" "),
      tokens: f.tokens,
    },
    content: { brand: "Your business", ...SAMPLE },
  });

  return (
    <section aria-labelledby="quick-title" className="mx-auto max-w-7xl px-5 pb-16 md:px-10">
      <p className="eyebrow">Faster start</p>
      <h2 id="quick-title" className="mt-2 font-display text-3xl md:text-4xl">
        Find your look in a minute
      </h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-xl border border-border p-5">
          <label htmlFor="quick-text" className="font-medium">
            What's your business?
          </label>
          <p className="text-sm text-muted-foreground">
            A few words is enough. We suggest the three designs that fit best.
          </p>
          <input
            id="quick-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. tattoo studio, family dentist, coffee shop"
            className="mt-3 min-h-11 w-full rounded-md border border-border bg-card px-3"
          />
          {text.trim().length > 2 && matches.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No close match yet. Try another word, like what you sell or who visits.
            </p>
          )}
          <ul className="mt-4 grid gap-4" aria-label="Best matching designs">
            {matches.map((m) => (
              <li
                key={m.item.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="h-36 overflow-hidden border-b border-border" aria-hidden>
                  <DesignPreview t={m.item.direction.tokens} c={m.item.content} compact />
                </div>
                <div className="p-4">
                  <h3 className="font-display text-xl">{m.item.direction.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Fits because it suits: {m.because.slice(0, 4).join(", ")}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onOpen(m.item, "rx")}>
                      Use it now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onOpen(m.item, "exam")}>
                      Fine-tune it first
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-xl border border-border p-5">
          <label htmlFor="quick-site" className="font-medium">
            Start from a site you admire
          </label>
          <p className="text-sm text-muted-foreground">
            We read its colours and fonts only. Their words, logo and photos are never copied.
          </p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (canReadSite && site.trim().length > 2 && !busy) void read();
            }}
          >
            <input
              id="quick-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="e.g. aesop.com"
              inputMode="url"
              className="min-h-11 flex-1 rounded-md border border-border bg-card px-3"
            />
            <Button type="submit" disabled={!canReadSite || busy || site.trim().length < 3}>
              {busy ? "Reading…" : "Read its look"}
            </Button>
          </form>
          {!canReadSite && (
            <p className="mt-3 text-sm text-muted-foreground">
              {hosted?.mode === "preview" ? (
                "Public website checks need sign-in on the hosted app. Describe your business to use the local design library here."
              ) : (
                <Link to="/auth" search={{ next: "/" }} className="underline">
                  Sign in to read a site’s look
                </Link>
              )}
            </p>
          )}
          {err && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {err}
            </p>
          )}
          {found && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
              <div className="h-44 overflow-hidden border-b border-border" aria-hidden>
                <DesignPreview t={found.tokens} c={{ brand: "Your business", ...SAMPLE }} compact />
              </div>
              <div className="p-4">
                <h3 className="font-display text-xl">Inspired by {found.host}</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {found.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onOpen(siteItem(found), "exam")}>
                    Fine-tune this look
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onOpen(siteItem(found), "rx")}>
                    Use it now
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
