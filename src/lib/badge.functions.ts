import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { watchAddress } from "./watchtower";

export const issueBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; tokens: unknown }) =>
    z
      .object({ url: z.string().min(4).max(500), tokens: z.record(z.string(), z.unknown()) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { evaluateBadge } = await import("./badge.server");
    const url = watchAddress(data.url);
    const e = await evaluateBadge(url, data.tokens);
    if (!e.passing) return { issued: false as const, reasons: e.reasons };
    const now = new Date().toISOString();
    // Only the verified server result may create evidence; browser writes are revoked.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("badges")
      .insert({
        user_id: context.userId,
        url,
        title: e.title,
        design_id: e.id,
        tokens: e.tokens as never,
        passing: true,
        score: e.check.score,
        reasons: e.reasons,
        history: [{ at: now, passing: true, score: e.check.score }],
        checked_at: now,
      })
      .select("id")
      .single();
    if (error || !row)
      throw new Error("The page passed, but the badge could not be saved. Try again.");
    return { issued: true as const, id: row.id, reasons: e.reasons };
  });

export const listBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("badges")
      .select("id,url,title,passing,score,checked_at,issued_at,error")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load your badges.");
    return data;
  });

export const removeBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: gone, error } = await context.supabase
      .from("badges")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error || !gone?.length) throw new Error("Could not remove this badge.");
    return { ok: true };
  });

export type PublicBadge = {
  url: string;
  title: string;
  design_id: string;
  passing: boolean;
  score: number | null;
  reasons: { ok: boolean; text: string }[];
  history: { at: string; passing: boolean; score: number | null }[];
  issued_at: string;
  checked_at: string | null;
};
export async function readPublicBadge(id: string): Promise<PublicBadge | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
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
  const { data } = await sb.rpc("get_badge", { _id: id });
  return (data?.[0] as unknown as PublicBadge) ?? null;
}
export const getPublicBadge = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => readPublicBadge(data.id));
