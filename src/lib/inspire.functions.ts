import { requireMeasuredAuth } from "./measured-auth";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { inspirationFrom } from "./inspire";

// Public, measured-only: reads a public page's look (no AI, no copy taken) through the safe fetcher.
export const inspireFromSite = createServerFn({ method: "POST" })
  .middleware([requireMeasuredAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { grabSiteSources } = await import("./watchtower.server");
    try {
      const { html, css } = await grabSiteSources(data.url);
      const host = new URL(/^https?:/i.test(data.url) ? data.url : `https://${data.url}`).hostname;
      return { ok: true as const, host, ...inspirationFrom(html, css) };
    } catch (e) {
      console.error("inspireFromSite", e);
      const msg = (e as Error).message.startsWith("This address")
        ? "That doesn't look like a public website address."
        : "We couldn't open that site. Some sites block outside visits; try another one you like.";
      return { ok: false as const, error: msg };
    }
  });
