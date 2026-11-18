import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/watchtower")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { checkWatchedSite } = await import("@/lib/watchtower.server");
        const { data, error } = await supabaseAdmin
          .from("watched_sites")
          .select("id")
          .eq("enabled", true)
          .lte("next_check", new Date().toISOString())
          .order("next_check")
          .limit(3);
        if (error) return new Response("Could not load due checks", { status: 500 });
        let checked = 0;
        for (const row of data ?? []) {
          try {
            await checkWatchedSite(row.id);
            checked++;
          } catch {
            /* recorded on the watched page; no immediate retries */
          }
        }
        // The same weekly job re-checks "Crafted with Focus" badges.
        const { recheckBadge } = await import("@/lib/badge.server");
        const { data: due } = await supabaseAdmin
          .from("badges")
          .select("id")
          .lte("next_check", new Date().toISOString())
          .order("next_check")
          .limit(3);
        for (const b of due ?? []) await recheckBadge(b.id);
        return Response.json({ checked, badges: due?.length ?? 0 });
      },
    },
  },
});
