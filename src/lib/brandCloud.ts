import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fromRows, syncable, toRow, type BuildRow } from "./brandSync";
import type { LibraryEntry } from "./library";

export async function fetchBuilds(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from("brand_builds")
    .select("build_id,title,collection,favorite,state,created_at,updated_at");
  if (error) throw error;
  return fromRows((data ?? []) as BuildRow[]);
}

// Returns only after the account confirms the write.
export async function pushBuilds(userId: string, entries: LibraryEntry[]) {
  const rows = entries
    .filter(syncable)
    .map((e) => ({ ...toRow(e), state: e.state as unknown as Json, user_id: userId }));
  if (!rows.length) return;
  const { data, error } = await supabase
    .from("brand_builds")
    .upsert(rows, { onConflict: "user_id,build_id" })
    .select("build_id");
  if (error) throw error;
  if ((data ?? []).length !== rows.length) throw new Error("Not every build was saved");
}

export async function removeBuilds(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("brand_builds").delete().in("build_id", ids);
  if (error) throw error;
}
