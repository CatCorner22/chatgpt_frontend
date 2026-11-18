import { useMemo, useState } from "react";
import { DesignPreview } from "@/components/DesignPreview";
import { GALLERY, GALLERY_GROUPS, type GalleryItem } from "@/lib/gallery";
import { useDesignFonts } from "@/lib/useDesignFonts";

// Ready-made designs a visitor can start from instead of writing a brief.
export function Gallery({ onPick }: { onPick: (g: GalleryItem) => void }) {
  const [group, setGroup] = useState<string>("All");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return GALLERY.filter(
      (g) =>
        (group === "All" || g.group === group) &&
        (!term ||
          [g.direction.name, g.direction.mood, g.bestFor ?? "", g.inspiration]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [group, q]);
  const visible = shown.slice(0, 60);
  useDesignFonts(visible.map((g) => g.direction.tokens));
  return (
    <section aria-labelledby="gallery-title" className="mx-auto max-w-7xl px-5 pb-20 md:px-10">
      <p className="eyebrow">Or start from a finished design</p>
      <h2 id="gallery-title" className="mt-2 font-display text-3xl md:text-4xl">
        Inspiration gallery
      </h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        {GALLERY.length} finished designs, including your original Directions. Open one to fine-tune
        it, change the words, and take its Vision.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {["All", ...GALLERY_GROUPS].map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${group === g ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}
          >
            {g}
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: tattoo, clinic, neon…"
          aria-label="Search designs"
          className="min-h-11 flex-1 rounded-full border border-border bg-card px-4 text-sm sm:max-w-xs"
        />
      </div>
      {shown.length === 0 && (
        <p className="mt-8 text-muted-foreground">No designs match. Try another word.</p>
      )}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((g) => (
          <button
            key={g.id}
            onClick={() => onPick(g)}
            aria-label={`Open ${g.direction.name}: ${g.direction.mood}`}
            className="lens group overflow-hidden rounded-md border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
          >
            <div className="h-60 overflow-hidden border-b border-border" aria-hidden>
              <DesignPreview t={g.direction.tokens} c={g.content} compact />
            </div>
            <div className="p-5">
              <p className="eyebrow">{g.group}</p>
              <h3 className="mt-1 font-display text-2xl">{g.direction.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{g.direction.mood}</p>
              {g.bestFor ? (
                <p className="mt-2 text-xs">
                  <strong>Best for:</strong> {g.bestFor}
                </p>
              ) : (
                <p className="mt-2 text-xs">Inspired by {g.inspiration}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
