import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasCloudBackend } from "@/lib/runtime-config";
import { useHostedSession } from "@/components/HostedBoundary";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Focus" },
      { name: "description", content: "Sign in to save your design projects and Visions." },
      { property: "og:title", content: "Sign in — Focus" },
      {
        property: "og:description",
        content: "Save your design projects and Visions across devices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Optional return path (used when an AI tool asks to connect to Focus).
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  component: AuthPage,
});

function AuthPage() {
  const hosted = useHostedSession();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const navigate = useNavigate();
  const { next: rawNext } = Route.useSearch();
  const next = oauthReturnPath(rawNext);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (next !== "/") window.location.assign(next);
        else navigate({ to: "/projects" });
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: new URL(next, window.location.origin).href,
            data: { name: name.trim(), business_name: business.trim() },
          },
        });
        if (error) throw error;
        setSent("Check your email and click the link to confirm your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      const m = (err as Error).message;
      setErr(
        /invalid login/i.test(m)
          ? "That email and password don't match. Check for typos, or reset your password below."
          : /registered/i.test(m)
            ? "That email already has an account. Sign in instead."
            : m,
      );
    } finally {
      setBusy(false);
    }
  };

  if (hosted) {
    return (
      <main className="paper flex min-h-screen items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg">
          <Link to="/" className="font-display text-2xl">
            Focus<span className="text-accent">.</span>
          </Link>
          <p className="eyebrow mt-8">Your private workspace</p>
          <h1 className="mt-3 font-display text-4xl">
            {hosted.user ? "Make yourself at home." : "Sign in to your studio."}
          </h1>
          {hosted.user ? (
            <p className="mt-4 break-words">
              Signed in as {hosted.user.email || "your ChatGPT account"}.
            </p>
          ) : (
            <p className="mt-4 leading-relaxed">
              Use your ChatGPT account to open your personal workspace. You do not need a separate
              Focus password.
            </p>
          )}
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Create a design, add your words and image, and download a working page or an
            existing-site pack. Your work stays in your browser as you edit.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {hosted.storageAvailable
              ? "To continue on another device, open My designs and choose Save library online. Restore online library on the other device brings back those saved designs, images and history. Unfinished studio drafts and other browser settings are not included."
              : "Online storage is unavailable right now. Use My designs → Back up library to keep your saved designs and images, then restore that file in another browser."}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The design studio, measured public-site checks, quality tools, library and customer
            downloads are available. Paid AI generation is paused. Public share links, live Vision
            publishing, account profiles, synced progress and scheduled monitoring need a separate
            connected backend and are not configured here.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            {hosted.user ? (
              <>
                <Button asChild>
                  <Link to="/" search={{ view: "studio" }}>
                    Open the studio
                  </Link>
                </Button>
                <Link to="/library" className="text-sm underline">
                  My designs
                </Link>
                <a href="/signout-with-chatgpt" target="_top" className="text-sm underline">
                  Sign out
                </a>
              </>
            ) : (
              <Button asChild>
                <a href="/signin-with-chatgpt" target="_top">
                  Sign in with ChatGPT
                </a>
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (!hasCloudBackend()) {
    return (
      <main className="paper flex min-h-screen items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="font-display text-2xl">
            Focus<span className="text-accent">.</span>
          </Link>
          <p className="eyebrow mt-8">Your personal studio</p>
          <h1 className="mt-3 font-display text-4xl">Make yourself at home.</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            This studio saves your designs in this browser. You can choose a direction, refine it,
            and download your design without an account.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Account sync is not connected in this installation.
          </p>
          <Button asChild className="mt-7">
            <Link to="/" search={{ view: "studio" }}>
              Open the studio
            </Link>
          </Button>
          <Link to="/library" className="ml-5 inline-flex min-h-11 items-center text-sm underline">
            Saved designs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="paper flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-sm border border-border bg-card p-8 shadow-sm">
        <Link to="/" className="font-display text-2xl">
          Focus<span className="text-accent">.</span>
        </Link>
        <h1 className="mt-6 font-display text-4xl">
          {mode === "in"
            ? "Welcome back"
            : mode === "up"
              ? "Create your account"
              : "Reset your password"}
        </h1>
        {sent ? (
          <p className="mt-6 text-muted-foreground">{sent}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "up" && (
              <p className="text-sm text-muted-foreground">
                By creating an account, you agree to the{" "}
                <Link to="/terms" className="underline">
                  terms of use
                </Link>{" "}
                and acknowledge the{" "}
                <Link to="/privacy" className="underline">
                  privacy policy
                </Link>
                .
              </p>
            )}
            {mode === "up" && (
              <>
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="biz">Business name</Label>
                  <Input
                    id="biz"
                    value={business}
                    onChange={(e) => setBusiness(e.target.value)}
                    maxLength={120}
                    className="mt-1"
                    placeholder="Shown on reports you share"
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pw">Password</Label>
                  <button
                    type="button"
                    className="min-h-6 text-xs underline"
                    onClick={() => setShow((v) => !v)}
                    aria-pressed={show}
                  >
                    {show ? "Hide" : "Show"} password
                  </button>
                </div>
                <Input
                  id="pw"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  className="mt-1"
                  aria-describedby="pw-rule"
                />
                {mode === "up" && (
                  <p
                    id="pw-rule"
                    className={`mt-1 text-xs ${password.length >= 8 ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {password.length >= 8 ? "✓ " : ""}At least 8 characters
                  </p>
                )}
              </div>
            )}
            {err && (
              <p role="alert" className="rounded-sm border border-destructive p-3 text-sm">
                {err}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy
                ? mode === "in"
                  ? "Signing in…"
                  : mode === "up"
                    ? "Creating your account…"
                    : "Sending the link…"
                : mode === "in"
                  ? "Sign in"
                  : mode === "up"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>
        )}
        <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
          {mode !== "in" && (
            <button
              type="button"
              className="min-h-6 underline"
              onClick={() => {
                setMode("in");
                setSent("");
                setErr("");
              }}
            >
              I have an account
            </button>
          )}
          {mode !== "up" && (
            <button
              type="button"
              className="min-h-6 underline"
              onClick={() => {
                setMode("up");
                setSent("");
                setErr("");
              }}
            >
              Create an account
            </button>
          )}
          {mode === "in" && (
            <button
              type="button"
              className="min-h-6 underline"
              onClick={() => {
                setMode("forgot");
                setSent("");
                setErr("");
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
