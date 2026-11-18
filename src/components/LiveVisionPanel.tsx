import { focusLocalStorage, isHostedBuild } from "@/lib/browser-storage";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useSession";
import { publishVision, recordVision, setVisionLink } from "@/lib/northstar.functions";

const KEY = "focus:live-vision:v1";
const readOn = (): Record<string, string> => {
  try {
    const v = JSON.parse(focusLocalStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

/** Live Vision: a secret link AI tools read, kept up to date while it is on. */
type LiveVisionProps = { designId: string; title: string; vision: string };
export function LiveVisionPanel(props: LiveVisionProps) {
  if (!isHostedBuild()) return <ConnectedLiveVisionPanel {...props} />;
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <h3 className="font-display text-2xl">Live Vision link</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Live links are not configured in this workspace. Copy your Vision or download DESIGN.md to
        give your coding tool the current instructions. To share editable designs with a colleague,
        use Back up library in My designs and review its contents before sharing.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/library">Open My designs</Link>
      </Button>
    </section>
  );
}
function ConnectedLiveVisionPanel({ designId, title, vision }: LiveVisionProps) {
  const user = useUser();
  const publish = useServerFn(publishVision);
  const toggle = useServerFn(setVisionLink);
  const record = useServerFn(recordVision);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState<string | null>(null);
  useEffect(() => setToken(readOn()[designId] ?? null), [designId]);
  // Count each completed Vision once per signed-in person (anonymous on the owner page).
  const counted = useRef("");
  useEffect(() => {
    if (!user || counted.current === designId) return;
    counted.current = designId;
    void record({ data: { designId } }).catch(() => undefined);
  }, [user, designId, record]);
  // Keep the live copy current: re-send a moment after the Vision changes.
  useEffect(() => {
    if (!user || !token) return;
    const t = setTimeout(() => {
      publish({ data: { designId, title, vision } })
        .then((r) => setSynced(r.updated_at))
        .catch(() => setSynced(null));
    }, 1500);
    return () => clearTimeout(t);
  }, [user, token, designId, title, vision, publish]);
  const save = (next: string | null) => {
    const all = readOn();
    if (next) all[designId] = next;
    else delete all[designId];
    focusLocalStorage.setItem(KEY, JSON.stringify(all));
    setToken(next);
  };
  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await publish({ data: { designId, title, vision } });
      if (!r.enabled) await toggle({ data: { designId, enabled: true } });
      save(r.token);
      setSynced(r.updated_at);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      await toggle({ data: { designId, enabled: false } });
      save(null);
      toast("Live Vision turned off. The old link no longer works.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const link = token && typeof window !== "undefined" ? `${window.location.origin}/v/${token}` : "";
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-display text-2xl">
        <Radio className="size-5" aria-hidden />
        Live Vision link
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Give your AI tool one link instead of pasting. When you change this design, the link shows
        the new Vision, so every tool stays up to date. The link is secret; turn it off at any time.
      </p>
      {!user ? (
        <Button asChild variant="outline" className="mt-4">
          <Link to="/auth">Sign in to make a live link</Link>
        </Button>
      ) : !token ? (
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => void turnOn()}>
          {busy ? "Making your link…" : "Make a live Vision link"}
        </Button>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="break-all rounded-sm bg-muted p-2 font-mono text-xs">{link}</p>
          <p className="text-xs text-muted-foreground" role="status">
            {synced ? `Up to date · ${new Date(synced).toLocaleTimeString()}` : "Updating…"}
          </p>
          <p className="text-sm">
            Tell your tool: “Read my design Vision at this link before every change and follow it
            exactly.”
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(link).then(
                  () => toast.success("Link copied"),
                  () => toast.error("Could not copy. Select the link and copy it by hand."),
                )
              }
            >
              Copy link
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void turnOff()}>
              {busy ? "Turning off…" : "Turn off link"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
