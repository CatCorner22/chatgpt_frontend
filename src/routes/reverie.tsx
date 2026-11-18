import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ReverieArt } from "@/components/BrandArt";
import { Button } from "@/components/ui/button";
import { REVERIE } from "@/lib/reverie";

export const Route = createFileRoute("/reverie")({
  head: () => ({
    meta: [
      { title: "About Reverie — your guide to Focus" },
      {
        name: "description",
        content:
          "Meet Reverie, Focus's curious little guide, and discover the daydream behind her name.",
      },
    ],
  }),
  component: AboutReverie,
});

export function AboutReverie() {
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-5xl px-5 py-12 md:px-10 md:py-20">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:gap-14">
          <header>
            <p className="eyebrow">About me</p>
            <h1 className="mt-3 font-display text-5xl leading-tight sm:text-6xl">
              Hello, I'm {REVERIE.name}.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              A curious little cat with a sketchbook full of possibilities. I'm your guide to Focus,
              and I'm glad you're here.
            </p>
          </header>
          <div className="reverie-portrait mx-auto" aria-hidden="true">
            <ReverieArt pose="library" />
          </div>
        </div>

        <section
          aria-labelledby="reverie-name"
          className="mt-10 max-w-2xl border-t border-border pt-8"
        >
          <p className="text-sm text-muted-foreground">
            Reverie · pronounced {REVERIE.pronunciation}
          </p>
          <h2 id="reverie-name" className="mt-3 font-display text-3xl sm:text-4xl">
            My name means {REVERIE.meaning}.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            That quiet moment when your thoughts wander and an idea begins to take shape? That's a
            reverie. I like to think it's where good things start: a color you love, a clearer way
            to tell your story, or something you haven't quite found the words for yet.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            I love peaceful corners, good books, and making something useful feel a little more
            beautiful. You'll find me painting with Vision, looking ahead in Horizon, exploring with
            Telescope, and getting ready for the real world in Target.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            My part is to guide you through the choices. Yours is to decide what feels right for
            your project. Together, we'll make room for the daydream and take care with the details.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="min-h-11">
              <Link to="/welcome">Let me show you around</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/" search={{ view: "studio" }}>
                Explore the design studio
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
