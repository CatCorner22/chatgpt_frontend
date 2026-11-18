import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasCloudBackend } from "@/lib/runtime-config";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Focus" },
      { name: "description", content: "Set a new password for your Focus account." },
      { property: "og:title", content: "Choose a new password — Focus" },
      { property: "og:description", content: "Set a new password for your Focus account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [current, setCurrent] = useState("");
  const [needsCurrent, setNeedsCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw, ...(needsCurrent ? { current_password: current } : {}) });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/projects" });
    } catch (error) {
      if (error instanceof Error && /current password required/i.test(error.message)) {
        setNeedsCurrent(true);
        toast.error("Enter your current password to confirm this change.");
      } else toast.error(error instanceof Error ? error.message : "Couldn't update your password. Try again.");
    } finally { setBusy(false); }
  };
  if (!hasCloudBackend()) return (
    <main className="paper flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md">
        <h1 className="font-display text-4xl">No password needed here.</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">This installation keeps your designs in this browser. Account sync and password recovery are not connected.</p>
        <Button asChild className="mt-6"><Link to="/" search={{ view: "studio" }}>Open the studio</Link></Button>
      </div>
    </main>
  );
  return (
    <main className="paper flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-sm border border-border bg-card p-8">
        <h1 className="font-display text-4xl">Choose a new password</h1>
        {needsCurrent && <div><Label htmlFor="current-pw">Current password</Label><Input id="current-pw" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className="mt-1" /></div>}
        <div><Label htmlFor="pw">New password</Label><Input id="pw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="mt-1" /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </main>
  );
}
