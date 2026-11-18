import { focusLocalStorage, isHostedBuild } from "@/lib/browser-storage";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Award, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/useSession";
import { issueBadge } from "@/lib/badge.functions";
import type { Pick, Tokens } from "@/lib/design";
import { setShowcase } from "@/lib/northstar.functions";
import { TASTE_KEY, markPassed, parseTaste } from "@/lib/taste";
import type { BadgeReason } from "@/lib/badge";

type BadgeProps = { tokens: Tokens; picks?: Pick[]; brand?: string };
export function BadgePanel(props: BadgeProps) {
  if (!isHostedBuild()) return <ConnectedBadgePanel {...props} />;
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <h3 className="font-display text-2xl">Public verification badge</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Badge publishing and scheduled rechecks are not configured in this workspace. You can check
        a public page now and use the findings alongside your customer task tests. A measured page
        check does not issue a public badge.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/critic">Check a public page</Link>
      </Button>
    </section>
  );
}
function ConnectedBadgePanel({ tokens, picks = [], brand = "" }: BadgeProps) {
  const showcase = useServerFn(setShowcase);
  const [shown, setShown] = useState(false);
  const user = useUser();
  const issue = useServerFn(issueBadge);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id?: string; reasons: BadgeReason[] } | null>(null);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const r = await issue({
        data: { url, tokens: tokens as unknown as Record<string, unknown> },
      });
      setResult(r.issued ? { id: r.id, reasons: r.reasons } : { reasons: r.reasons });
      if (r.issued && picks.length) {
        try {
          focusLocalStorage.setItem(
            TASTE_KEY,
            JSON.stringify(
              markPassed(parseTaste(focusLocalStorage.getItem(TASTE_KEY)), picks, brand),
            ),
          );
        } catch {
          /* taste memory is optional */
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const code = result?.id
    ? `<a href="${origin}/badge/${result.id}"><img src="${origin}/api/public/badge/${result.id}" alt="Crafted with Focus" height="28"></a>`
    : "";
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-display text-2xl">
        <Award className="size-5" aria-hidden />
        Get a "Crafted with Focus" badge
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Once your site is live, Focus measures the page and up to 9 pages it links to. If every page
        carries this design's signed code, scores 80 or more, has no serious problems and uses all
        five Vision colors and fonts, you get a dated badge with a public proof page. Focus
        re-checks it every week.
      </p>
      {!user ? (
        <Button asChild variant="outline" className="mt-4">
          <Link to="/auth">Sign in to get a badge</Link>
        </Button>
      ) : (
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label className="sr-only" htmlFor="badge-url">
            Your live site address
          </label>
          <Input
            id="badge-url"
            className="min-w-0 flex-1"
            placeholder="https://yoursite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button type="submit" disabled={busy || url.trim().length < 4}>
            {busy ? "Checking every page (up to 10)…" : "Check and issue badge"}
          </Button>
        </form>
      )}
      <div role="status" className="mt-3 text-sm">
        {err && <p className="text-destructive">{err}</p>}
        {result && (
          <>
            <p className="font-semibold">
              {result.id ? "Badge issued." : "Not yet — fix these and check again:"}
            </p>
            <ul className="mt-2 space-y-1">
              {result.reasons.map((r) => (
                <li key={r.text} className="flex gap-2">
                  {r.ok ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <X className="size-4 shrink-0 text-destructive" aria-hidden />
                  )}
                  {r.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {result?.id && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">Paste this on your site:</p>
          <pre className="overflow-x-auto rounded-sm bg-muted p-3 text-xs">{code}</pre>
          <label className="flex min-h-6 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={shown}
              onChange={(e) => {
                if (!result.id) return;
                const on = e.target.checked;
                setShown(on);
                showcase({ data: { id: result.id, on } }).then(
                  () => toast.success(on ? "Listed in the showcase" : "Removed from the showcase"),
                  () => {
                    setShown(!on);
                    toast.error("Could not change the showcase setting.");
                  },
                );
              }}
            />
            Show this site in the public showcase while it keeps passing
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(code).then(
                  () => toast.success("Badge code copied"),
                  () => toast.error("Could not copy. Select the code and copy it by hand."),
                )
              }
            >
              Copy badge code
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/badge/$id" params={{ id: result.id }}>
                Open proof page
              </Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
