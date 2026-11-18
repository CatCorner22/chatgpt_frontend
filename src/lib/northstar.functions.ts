import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const designIdSchema = z.string().regex(/^f-[0-9a-f]{10}$/);

export function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: key.startsWith("sb_") ? (u, i) => { const h = new Headers(i?.headers); if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(u, { ...i, headers: h }); } : fetch },
  });
}

// Live Vision: the owner's latest Vision text behind a secret link that AI tools can read.
export const publishVision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { designId: string; title: string; vision: string }) =>
    z.object({ designId: designIdSchema, title: z.string().max(120), vision: z.string().min(20).max(60000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("vision_links")
      .upsert({ user_id: context.userId, design_id: data.designId, title: data.title, vision: data.vision, updated_at: new Date().toISOString() }, { onConflict: "user_id,design_id" })
      .select("token,enabled,updated_at")
      .single();
    if (error || !row) throw new Error("Could not update your live Vision.");
    return row;
  });
export const setVisionLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { designId: string; enabled: boolean }) => z.object({ designId: designIdSchema, enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("vision_links").update({ enabled: data.enabled }).eq("design_id", data.designId).select("token,enabled").single();
    if (error || !row) throw new Error("Could not change the live Vision link.");
    return row;
  });

// North Star count: one anonymous row per completed Vision (repeat opens don't count twice).
export const recordVision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { designId: string }) => z.object({ designId: designIdSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("vision_events").upsert({ user_id: context.userId, design_id: data.designId }, { onConflict: "user_id,design_id", ignoreDuplicates: true });
    return { ok: true };
  });
export const ownerCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("owner_counts");
    if (error) return null; // not an admin
    return data as { weeks: { week: string; visions: number }[]; badges: number; passing: number; lost: number };
  });

export const setShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; on: boolean }) => z.object({ id: z.string().uuid(), on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("badges").update({ showcase: data.on }).eq("id", data.id).select("showcase").single();
    if (error || !row) throw new Error("Could not change the showcase setting.");
    return row;
  });
export const listShowcase = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().rpc("list_showcase");
  return data ?? [];
});

// Whole-site check: the page plus up to 9 same-site pages, measured only, in a shared time budget.
export const checkSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => z.object({ url: z.string().min(4).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { safeUrl, analyzePage, sameSiteLinks, siteDrift } = await import("./critic");
    const { grabSiteSources } = await import("./watchtower.server");
    const u = safeUrl(data.url);
    if (!u) throw new Error("Enter a public website address, like example.com.");
    const first = await grabSiteSources(u.toString());
    const urls = [u.toString(), ...sameSiteLinks(first.html, u.toString(), 9)];
    const started = Date.now();
    const pages: { url: string; score: number; fonts: string[]; colors: string[]; fails: number; error?: string }[] = [];
    for (const url of urls) {
      if (Date.now() - started > 25000) break;
      try {
        const src = url === urls[0] ? first : await grabSiteSources(url);
        const r = analyzePage(src.html, src.css);
        pages.push({ url, score: r.score, fonts: r.facts.fonts, colors: r.facts.colors, fails: r.findings.filter((f) => !f.ok && !f.possible).length });
      } catch {
        pages.push({ url, score: 0, fonts: [], colors: [], fails: 0, error: "Could not open this page." });
      }
    }
    const ok = pages.filter((p) => !p.error);
    return { pages, drift: siteDrift(ok), skipped: urls.length - pages.length };
  });
