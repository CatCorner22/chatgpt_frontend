import { createFileRoute } from "@tanstack/react-router";
import { badgeLabel } from "@/lib/badge";

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

// Live badge image: always reflects the latest re-check, so a stale copy can't keep claiming a pass.
export const Route = createFileRoute("/api/public/badge/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { readPublicBadge } = await import("@/lib/badge.functions");
        const b = await readPublicBadge(params.id.replace(/\.svg$/, ""));
        const text = b ? badgeLabel(b.passing, b.checked_at) : "Focus badge not found";
        const ok = !!b?.passing;
        const w = 14 + text.length * 7;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="28" role="img" aria-label="${esc(text)}"><rect width="${w}" height="28" rx="4" fill="${ok ? "#1d1a16" : "#6b6258"}"/><text x="${w / 2}" y="18" fill="#ffffff" font-family="system-ui,sans-serif" font-size="12" text-anchor="middle">${esc(text)}</text></svg>`;
        return new Response(svg, {
          headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
