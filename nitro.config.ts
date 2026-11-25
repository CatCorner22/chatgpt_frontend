import { defineNitroConfig } from "nitro/config";

const compatibilityDate = "2026-11-22";

export default defineNitroConfig({
  compatibilityDate,
  // Keep the Worker's calendar date exact even when the build machine is west of UTC.
  cloudflare: { wrangler: { compatibility_date: compatibilityDate } },
});
