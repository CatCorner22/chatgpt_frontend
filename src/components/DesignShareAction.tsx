import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { isHostedBuild } from "@/lib/browser-storage";

/** Sharing options must match the configured service, even for a signed-in Sites visitor. */
export function DesignShareAction({
  signedIn,
  busy,
  sharing,
  onShare,
}: {
  signedIn: boolean;
  busy: boolean;
  sharing: boolean;
  onShare: () => void;
}) {
  if (isHostedBuild())
    return (
      <div className="max-w-md text-sm">
        <p className="text-muted-foreground">
          Public share links are not configured here. Use Back up library in My designs to share
          editable work; review the backup's contents before sending it.
        </p>
        <Link to="/library" className="mt-2 inline-flex min-h-11 items-center underline">
          Open My designs
        </Link>
      </div>
    );
  return signedIn ? (
    <Button variant="outline" disabled={busy} onClick={onShare}>
      {sharing ? "Creating your share link…" : "Copy share link"}
    </Button>
  ) : (
    <Button variant="outline" asChild>
      <Link to="/auth">Sign in to share</Link>
    </Button>
  );
}
