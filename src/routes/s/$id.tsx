import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DesignPreview } from "@/components/DesignPreview";
import { AppHeader } from "@/components/AppHeader";
import { normalizeTokens, tokensCss, type Content, type Tokens } from "@/lib/design";
import { useDesignFonts } from "@/lib/useDesignFonts";
import { socialHead } from "../-social-head";

const getShare = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d.id)) throw new Error("bad id");
    return d;
  })
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: key.startsWith("sb_")
          ? (u, i) => {
              const h = new Headers(i?.headers);
              if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(u, { ...i, headers: h });
            }
          : fetch,
      },
    });
    // Lookup by exact link id only; the table itself is not publicly listable.
    const { data: rows } = await sb.rpc("get_share", { _id: data.id });
    const row = (rows?.[0] ?? null) as { title: string; snapshot: unknown } | null;
    if (!row) return null;
    const snap = row.snapshot as { tokens?: Tokens; content?: Content; direction?: string };
    if (!snap?.tokens || !snap?.content) return null;
    return {
      title: row.title,
      direction: snap.direction ?? "",
      tokens: normalizeTokens(snap.tokens),
      content: snap.content,
    };
  });

export const Route = createFileRoute("/s/$id")({
  loader: async ({ params }) => {
    const r = await getShare({ data: { id: params.id } }).catch(() => null);
    if (!r) throw notFound();
    return r;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.title} — design by Focus` : "Shared design — Focus";
    const d = loaderData
      ? `${loaderData.content.headline} · A design direction made with Focus.`
      : "A design shared from Focus.";
    return socialHead({
      title: t,
      description: d,
      card: "summary_large_image",
    });
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="font-display text-4xl">This link doesn't open a design.</h1>
      <p className="mt-3 text-muted-foreground">It may have been removed by its owner.</p>
      <Link to="/" className="mt-6 inline-block underline">
        Start your own
      </Link>
    </main>
  ),
  component: SharePage,
});

function SharePage() {
  const s = Route.useLoaderData();
  useDesignFonts([s.tokens]);
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:px-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <p className="eyebrow">Shared design</p>
          <h1 className="font-display text-5xl leading-none">{s.title}</h1>
          {s.direction && <p className="text-muted-foreground">Direction: {s.direction}</p>}
          <p className="eyebrow">Design values</p>
          <pre className="overflow-auto rounded-sm border border-border bg-card p-4 font-mono text-xs">
            {tokensCss(s.tokens)}
          </pre>
          <Link to="/" className="inline-block underline">
            Make your own with Focus
          </Link>
        </div>
        <section className="h-fit overflow-hidden rounded-sm border border-border shadow-sm">
          <DesignPreview t={s.tokens} c={s.content} />
        </section>
      </main>
    </div>
  );
}
