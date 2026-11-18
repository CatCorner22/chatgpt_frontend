import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getVision from "./tools/get-vision";
import checkPage from "./tools/check-page";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "focus",
  title: "Focus",
  version: "0.1.0",
  instructions:
    "Focus design tools. Read the person's design Vision before building, follow it exactly, then measure the built page and fix what it reports before showing the result.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [getVision, checkPage],
});
