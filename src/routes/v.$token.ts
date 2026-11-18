import { createFileRoute } from "@tanstack/react-router";

// Live Vision for AI tools: plain Markdown behind a secret link the owner can turn off.
export const Route = createFileRoute("/v/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f]{36}$/.test(params.token)) return new Response("Not found", { status: 404 });
        const { publicClient } = await import("@/lib/northstar.functions");
        const { data } = await publicClient().rpc("get_vision", { _token: params.token });
        const row = data?.[0];
        if (!row)
          return new Response("This live Vision is turned off or does not exist.", { status: 404 });
        return new Response(
          `${row.vision}\n\n<!-- Live Vision from Focus · updated ${row.updated_at} -->\n`,
          {
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Robots-Tag": "noindex",
            },
          },
        );
      },
    },
  },
});
