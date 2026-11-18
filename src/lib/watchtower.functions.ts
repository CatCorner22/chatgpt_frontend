import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { watchAddress } from "./watchtower";

export const listWatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watched_sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load your watched pages.");
    return data;
  });
export const addWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; label: string }) =>
    z.object({ url: z.string().max(500), label: z.string().max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("watched_sites")
      .insert({ user_id: context.userId, url: watchAddress(data.url), label: data.label.trim() })
      .select("id")
      .single();
    if (error || !saved)
      throw new Error("Could not add this page. It may already be on your list.");
    return saved;
  });
export const changeWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("watched_sites")
      .update({ enabled: data.enabled })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error || !saved) throw new Error("Could not update this watch.");
    return saved;
  });
export const checkWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("watched_sites")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Watched page not found.");
    const { checkWatchedSite } = await import("./watchtower.server");
    return checkWatchedSite(row.id, context.userId);
  });
