import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { hasCloudBackend } from "@/lib/runtime-config";
import { socialHead } from "./-social-head";

type Details = { client?: { name?: string }; redirect_url?: string; redirect_to?: string } | null;
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: Details; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: Details; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: Details; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  head: () =>
    socialHead({
      title: "Connect an AI tool — Focus",
      description: "Approve read-only access to your Focus Visions for an AI tool.",
      robots: "noindex",
    }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    // Route loaders run before the hosted identity boundary mounts.
    if (!hasCloudBackend()) throw redirect({ to: "/auth" });
    if (!search.authorization_id)
      throw new Error(
        "This connection request is missing its code. Start connecting again from your AI tool.",
      );
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id");
    if (!authorizationId) throw new Error("Missing connection code.");
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-4xl">This connection request didn't work</h1>
        <p className="mt-3 text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <p className="mt-2 text-sm">
          It may have expired. Start connecting again from your AI tool.
        </p>
      </main>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"" | "approve" | "deny">("");
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "An AI tool";
  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy("");
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy("");
      setError("Focus didn't get a way back to your AI tool. Try connecting again.");
      return;
    }
    window.location.href = target;
  }
  return (
    <div className="paper min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-xl px-5 py-16">
        <p className="eyebrow">Connect an AI tool</p>
        <h1 className="mt-2 font-display text-4xl">Let {name} use Focus as you?</h1>
        <p className="mt-3 text-muted-foreground">
          It will be able to read your live Visions and measure public pages for you. It can't
          change or delete anything.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled={!!busy} onClick={() => void decide(true)}>
            {busy === "approve" ? "Connecting…" : `Allow ${name}`}
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => void decide(false)}>
            {busy === "deny" ? "Declining…" : "No thanks"}
          </Button>
        </div>
      </main>
    </div>
  );
}
