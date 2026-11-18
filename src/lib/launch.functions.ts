import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { launchDetailsSchema, canLaunch } from "./launch";

export const saveProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; title: string; fingerprint: string; details: unknown }) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(120),
        fingerprint: z.string().max(3000),
        details: launchDetailsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.details.status === "launched" && !canLaunch(data.details))
      throw new Error("Complete the review and task checks before recording a launch.");
    const { data: prior, error: readError } = await context.supabase
      .from("design_progress")
      .select("id")
      .eq("design_id", data.id)
      .maybeSingle();
    if (readError) throw new Error("Could not read your launch record.");
    const payload = { title: data.title, fingerprint: data.fingerprint, details: data.details };
    const result = prior
      ? await context.supabase
          .from("design_progress")
          .update(payload)
          .eq("id", prior.id)
          .select("id")
          .maybeSingle()
      : await context.supabase
          .from("design_progress")
          .insert({ ...payload, user_id: context.userId, design_id: data.id })
          .select("id")
          .single();
    if (result.error || !result.data)
      throw new Error("Could not save the account record. Your browser copy is unchanged.");
    return result.data;
  });
export const listProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("design_progress")
      .select("*")
      .order("completed_at", { ascending: false });
    if (error) throw new Error("Could not load your launch records.");
    return data;
  });
