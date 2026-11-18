import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { critiqueShot } from "@/lib/critic.functions";
import { fitterBrief } from "@/lib/critic";
import type { Tokens } from "@/lib/design";
import { useCancellable, useCopied, useWait } from "@/hooks/useUx";
import { WaitLine } from "@/components/WaitLine";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import type { ReviewEvidence } from "@/lib/launch";

type R = Awaited<ReturnType<typeof critiqueShot>>;

export const rxSummary = (t: Tokens) =>
  `Background ${t.bg}; surfaces ${t.surface}; text ${t.ink}; accent ${t.accent} used for the main button; heading font ${t.headingFont} (${t.headingCase === "uppercase" ? "uppercase" : "sentence case"}); body font ${t.bodyFont}; corners ${t.radius}px; buttons ${t.buttonStyle}; first screen layout ${t.heroLayout}; spacing ${t.density}; special touch ${t.texture}.`;

// Shrinks the screenshot in the browser so uploads stay small and fast.
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const context = c.getContext("2d");
  if (!context) {
    img.close();
    throw new Error("Could not process the screenshot.");
  }
  context.drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return c.toDataURL("image/jpeg", 0.85);
}

export function ShotReview({
  rx,
  onReviewed,
}: {
  rx: Tokens | null;
  onReviewed?: (review: ReviewEvidence) => void;
}) {
  const run = useServerFn(critiqueShot);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [r, setR] = useState<R | null>(null);
  const [preview, setPreview] = useState("");
  const last = useRef("");
  const wait = useWait(busy, "Looking at your screenshot");
  const { copied, copy } = useCopied();
  const job = useCancellable();
  const review = async (image: string) => {
    const id = job.start();
    setBusy(true);
    setErr("");
    try {
      const result = await run({ data: { image, ...(rx ? { rx: rxSummary(rx) } : {}) } });
      if (!job.current(id)) return; // cancelled
      setR(result);
      const mismatches = result.prescription.filter((p) => !p.followed).map((p) => p.item);
      onReviewed?.({
        kind: "screenshot",
        target: "Uploaded app or website screen",
        at: new Date().toISOString(),
        score: null,
        summary: result.verdict,
        checks: result.prescription.map((p) => ({
          name: p.item,
          ok: p.followed,
          detail: p.note,
          fix: p.followed ? "" : `Match the Vision: ${p.item}`,
        })),
        prescription: result.prescription.map((p) => ({ name: p.item, ok: p.followed })),
        priorities: result.priorities,
        repair: fitterBrief("uploaded screen", [], mismatches, result.priorities),
      });
    } catch (x) {
      if (job.current(id)) setErr((x as Error).message);
    } finally {
      if (job.current(id)) setBusy(false);
    }
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      toast.error("Choose a PNG, JPG or WebP screenshot.");
      return;
    }
    try {
      const d = await shrink(f);
      last.current = d;
      setPreview(d);
      setR(null);
      await review(d);
    } catch {
      toast.error("Couldn't read that image. Try another screenshot.");
    }
  };
  const missed = r?.prescription.filter((p) => !p.followed).map((p) => p.item) ?? [];
  const brief = r ? fitterBrief("your screenshot", [], missed, r.priorities) : "";
  return (
    <section className="mt-8 rounded-sm border border-border bg-card p-5" aria-labelledby="shot-h">
      <p id="shot-h" className="font-semibold">
        No address yet? Upload a screenshot
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Great for pages an AI builder just made in its preview.
        {rx ? " We'll also check it against your saved Vision." : ""} The image isn't stored.
      </p>
      <label className="mt-3 inline-flex max-w-full">
        <span className="sr-only">Screenshot file</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => void pick(e.target.files?.[0])}
          className="w-full min-w-0 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-sm file:border file:border-border file:bg-background file:px-4 file:font-medium"
        />
      </label>
      {busy && wait?.canCancel ? (
        <WaitLine
          wait={wait}
          onCancel={() => {
            job.cancel();
            setBusy(false);
          }}
        />
      ) : (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {busy ? (wait?.text ?? "Starting…") : ""}
        </p>
      )}
      {err && (
        <div role="alert" className="mt-3 rounded-sm border border-destructive p-3 text-sm">
          <p>{err}</p>
          {last.current && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void review(last.current)}
            >
              Try again
            </Button>
          )}
        </div>
      )}
      {r && (
        <div className="mt-5 grid gap-5 md:grid-cols-[12rem_1fr]">
          {preview && (
            <img
              src={preview}
              alt="Your uploaded screenshot"
              className="max-h-64 w-full rounded-sm border border-border object-cover object-top md:max-h-none"
            />
          )}
          <div className="min-w-0 space-y-4">
            <p className="eyebrow">Art director's opinion (AI)</p>
            <p className="font-display text-xl leading-snug md:text-2xl">{r.verdict}</p>
            <ol className="space-y-3">
              {r.priorities.map((p, i) => (
                <li key={i} className="rounded-sm border border-border p-3">
                  <p className="font-semibold">
                    {i + 1}. {p.title.replace(/^\d+[.)]\s*/, "")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.why}</p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Fix: </span>
                    {p.fix}
                  </p>
                </li>
              ))}
            </ol>
            {r.strengths.length > 0 && (
              <div>
                <p className="eyebrow">Keep</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {r.strengths.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.prescription.length > 0 && (
              <div>
                <p className="eyebrow">
                  Followed your Vision? ({r.prescription.filter((p) => p.followed).length} of{" "}
                  {r.prescription.length})
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {r.prescription.map((p, i) => (
                    <li key={i} className={p.followed ? "" : "text-destructive"}>
                      {p.followed ? "✓" : "✗"} {p.item} —{" "}
                      <span className="text-muted-foreground">{p.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A screenshot can't be measured like a live page, so this is judgment, not measurement.
              For measured checks, review the page's address once it's online.
            </p>
            <Button className="min-w-44" onClick={() => void copy("shot", brief)}>
              {copied === "shot" ? "Copied ✓" : "Copy repair brief"}
            </Button>
            <AdvisorPanel
              target="Uploaded app or website screenshot"
              summary={r.verdict}
              priorities={r.priorities}
              brief={brief}
              measured={false}
            />
          </div>
        </div>
      )}
    </section>
  );
}
