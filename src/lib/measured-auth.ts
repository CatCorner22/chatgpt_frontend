import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getBrowserOwnerId } from "./browser-storage";

/** Sites dispatch owns the authenticated header; the browser header only detects account changes. */
const requireHostedMeasuredAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const owner = getBrowserOwnerId();
    if (!owner) throw new Error("Sign in to check a public website.");
    const result = await next({ headers: { "X-Focus-User": owner } });
    if (getBrowserOwnerId() !== owner)
      throw new Error("Your account changed. Reload before checking another page.");
    return result;
  })
  .server(async ({ next }) => {
    const request = getRequest();
    const userId = request.headers.get("oai-authenticated-user-id");
    if (!userId || userId.length > 1024) throw new Error("Sign in to check a public website.");
    if (request.headers.get("x-focus-user") !== userId)
      throw new Error("Your account changed. Reload before checking another page.");
    if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin)
      throw new Error("Start this check from this Focus site.");
    return next({ context: { userId } });
  });

// Measured tools need identity, not a database session. Other cloud features retain their
// existing Supabase middleware; this does not provide a substitute Supabase credential.
export const requireMeasuredAuth =
  import.meta.env["VITE_FOCUS_HOSTED"] === "true" ? requireHostedMeasuredAuth : requireSupabaseAuth;
