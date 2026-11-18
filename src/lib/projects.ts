import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const STUDIO_KEY = "refraction:v1";

// Saves the studio state to the signed-in user's account; RLS limits rows to the owner.
export async function saveProject(id: string | null, title: string, state: unknown) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to save to your account.");
  const payload = { title: title.slice(0, 120) || "Untitled design", state: state as Json };
  if (id) {
    const { data, error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        "Could not save. The project may have been deleted; save it as a new design.",
      );
    return id;
  }
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...payload, user_id: u.user.id })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not save. Please try again.");
  return data.id;
}

// Creates a frozen, public-by-link copy of a finished design. Signed-in only to limit abuse.
export async function createShare(title: string, snapshot: unknown) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to create a share link.");
  const { data, error } = await supabase
    .from("shares")
    .insert({
      user_id: u.user.id,
      title: title.slice(0, 120) || "Untitled design",
      snapshot: snapshot as Json,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create link. Please try again.");
  return `${window.location.origin}/s/${data.id}`;
}
