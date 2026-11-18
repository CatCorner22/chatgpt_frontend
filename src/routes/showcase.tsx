import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { listShowcase } from "@/lib/northstar.functions";

export const Route = createFileRoute("/showcase")({
  loader: () => listShowcase().catch(() => []),
  head: () => ({
    meta: [
      { title: "Showcase — sites Crafted with Focus" },
      {
        name: "description",
        content:
          "Live sites that hold a passing Crafted with Focus badge, re-checked every week. Sites leave automatically if they stop passing.",
      },
      { property: "og:title", content: "Showcase — sites Crafted with Focus" },
      {
        property: "og:description",
        content:
          "Live sites built from a Focus design that keep passing their weekly measured check.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Showcase,
});

function Showcase() {
  const rows = Route.useLoaderData();
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 py-12 md:px-10">
        <p className="eyebrow">Showcase · re-checked every week</p>
        <h1 className="mt-2 font-display text-5xl">Sites that passed their Focus check</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Every site here carries a signed Focus design code and passed the same measured check this
          week. A site leaves the list automatically if it stops passing. Owners choose whether to
          be listed.
        </p>
        {!rows.length ? (
          <div className="mt-10">
            <h2 className="font-display text-3xl">The first sites are on their way.</h2>
            <p className="mt-2 text-muted-foreground">
              Make a design, build it, and get your badge to be listed here.
            </p>
            <Link to="/" className="mt-4 inline-block underline">
              Start a design
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-sm border border-border bg-card p-4">
                <p className="font-medium">{r.title || new URL(r.url).hostname}</p>
                <a
                  className="break-all text-sm underline"
                  href={r.url}
                  target="_blank"
                  rel="noopener nofollow"
                >
                  {r.url}
                </a>
                <p className="mt-2 text-sm text-muted-foreground">
                  Quality score {r.score ?? "—"} · checked{" "}
                  {r.checked_at ? new Date(r.checked_at).toLocaleDateString() : "—"}
                </p>
                <Link
                  to="/badge/$id"
                  params={{ id: r.id }}
                  className="mt-2 inline-block text-sm underline"
                >
                  See the proof
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
