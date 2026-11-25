import { focusLocalStorage } from "@/lib/browser-storage";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STUDIO_KEY } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { scheduleUndoable } from "@/lib/ux";
import { socialHead } from "../-social-head";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () =>
    socialHead({
      title: "My projects — Focus",
      description: "Your saved designs and Visions.",
    }),
  component: Projects,
});

function Projects() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, updated_at, state")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("profiles")
        .select("name, business_name")
        .eq("id", u.user!.id)
        .maybeSingle();
      return {
        id: u.user!.id,
        email: u.user!.email ?? "",
        name: data?.name ?? "",
        business_name: data?.business_name ?? "",
      };
    },
  });
  const [name, setName] = useState("");
  const [biz, setBiz] = useState("");
  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name);
      setBiz(profile.data.business_name);
    }
  }, [profile.data]);

  const open = (p: { id: string; state: unknown }) => {
    focusLocalStorage.setItem(
      STUDIO_KEY,
      JSON.stringify({ ...(p.state as object), projectId: p.id }),
    );
    navigate({ to: "/", search: { view: "studio" } });
  };
  const [hidden, setHidden] = useState<string[]>([]);
  const [asking, setAsking] = useState<{ id: string; title: string } | null>(null);
  // Hide now, delete on the server only after the Undo window, so closing the tab keeps the project.
  const remove = (id: string, title: string) => {
    setHidden((h) => [...h, id]);
    const job = scheduleUndoable(async () => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) {
        setHidden((h) => h.filter((x) => x !== id));
        toast.error("Could not delete. Your project is still here — try again.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["projects"] });
    }, 8000);
    toast(`Deleted “${title}”`, {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => {
          if (job.cancel()) setHidden((h) => h.filter((x) => x !== id));
        },
      },
    });
  };
  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").upsert({
      id: profile.data!.id,
      name: name.trim().slice(0, 100),
      business_name: biz.trim().slice(0, 120),
    });
    if (error) {
      toast.error("Could not save your details.");
      return;
    }
    toast.success("Details saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="paper min-h-screen">
      <AppHeader>
        <span />
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </AppHeader>
      <ConfirmDialog
        open={!!asking}
        onOpenChange={(o) => !o && setAsking(null)}
        title={`Delete “${asking?.title ?? ""}”?`}
        body="It disappears from your projects. You'll have 8 seconds to undo."
        confirmLabel={`Delete ${asking?.title ?? ""}`}
        cancelLabel="Keep it"
        onConfirm={() => {
          if (asking) remove(asking.id, asking.title);
          setAsking(null);
        }}
      />
      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-[1fr_18rem] md:px-10">
        <section>
          <p className="eyebrow">Saved designs</p>
          <h1 className="mt-2 font-display text-5xl">My projects</h1>
          {projects.isLoading && (
            <p className="mt-6 text-muted-foreground">Loading your projects…</p>
          )}
          {projects.error && (
            <p className="mt-6 text-destructive">
              Could not load your projects. Refresh to try again.
            </p>
          )}
          {projects.data?.filter((p) => !hidden.includes(p.id)).length === 0 && (
            <div className="mt-8 rounded-sm border border-dashed border-border p-8">
              <p>No saved designs yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Designs you save appear here, so you can open them on any device. Make one on the
                Design page and press “Save to my account”.
              </p>
              <Button asChild className="mt-4">
                <Link to="/" search={{ view: "studio" }}>
                  Start a design
                </Link>
              </Button>
            </div>
          )}
          <ul className="mt-6 space-y-3">
            {projects.data
              ?.filter((p) => !hidden.includes(p.id))
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-sm border border-border bg-card p-4"
                >
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Saved {new Date(p.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => open(p)}>
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAsking({ id: p.id, title: p.title })}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
        <aside className="h-fit space-y-3 rounded-sm border border-border bg-card p-5">
          <p className="eyebrow">Your details</p>
          <p className="text-sm text-muted-foreground">{profile.data?.email}</p>
          <div>
            <Label htmlFor="n">Name</Label>
            <Input
              id="n"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="b">Business name</Label>
            <Input
              id="b"
              value={biz}
              onChange={(e) => setBiz(e.target.value)}
              maxLength={120}
              className="mt-1"
            />
          </div>
          <Button size="sm" onClick={saveProfile} disabled={!profile.data}>
            Save details
          </Button>
        </aside>
      </main>
    </div>
  );
}
