import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_vision",
  title: "Get my design Vision",
  description: "Return the signed-in person's latest Focus design Vision (Markdown). Without a design code, lists their designs.",
  inputSchema: { design_id: z.string().regex(/^f-[0-9a-f]{10}$/).optional().describe("Focus design code, like f-92f8bbf524.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ design_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to Focus first.");
    const sb = supabaseForUser(ctx);
    if (!design_id) {
      const { data, error } = await sb.from("vision_links").select("design_id,title,updated_at").order("updated_at", { ascending: false }).limit(50);
      if (error) throw new ToolError("Could not load your designs.");
      const designs = (data ?? []).map((d) => ({ design_id: d.design_id, title: d.title, updated_at: d.updated_at }));
      return {
        content: [{ type: "text", text: designs.length ? designs.map((d) => `${d.design_id} — ${d.title}`).join("\n") : "No live Visions yet. In Focus, open a Vision and choose \"Make a live Vision link\"." }],
        structuredContent: { designs },
      };
    }
    const { data, error } = await sb.from("vision_links").select("title,vision,updated_at").eq("design_id", design_id).maybeSingle();
    if (error || !data) throw new ToolError("No live Vision with that design code in your account.");
    return { content: [{ type: "text", text: data.vision }], structuredContent: { title: data.title, updated_at: data.updated_at } };
  },
});
