import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fixMessage, fixPlan, type ReviewEvidence } from "@/lib/launch";

// Fix until it passes: one prioritised to-do list per review round, with a ready message per fix.
export function FixList({
  reviews,
  title,
  tool,
  busy,
  onRecheck,
}: {
  reviews: ReviewEvidence[];
  title: string;
  tool: string;
  busy: boolean;
  onRecheck?: (() => void) | undefined;
}) {
  const plan = fixPlan(reviews);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  if (!plan) return null;
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Fix message copied", { description: `Paste it into ${tool}.` });
    } catch {
      toast.error("Couldn't copy. Select the fix text and copy it yourself.");
    }
  };
  const applied = plan.still.filter((s) => done.has(s.key)).length;
  return (
    <section
      aria-labelledby="fix-title"
      className="space-y-3 rounded-md border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="fix-title" className="font-display text-2xl">
          Fix until it passes
        </h3>
        <span className="eyebrow">Check {plan.round}</span>
      </div>
      {plan.passed ? (
        <p role="status" className="rounded-sm bg-secondary p-3 font-medium">
          <Check className="mr-1 inline size-4" aria-hidden /> Everything measured now passes.
          Confirm the tasks below, then record your launch.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Work top to bottom. Send one fix at a time to {tool}, tick it, then check the page again.
          {applied > 0 && ` ${applied} of ${plan.still.length} marked as sent.`}
        </p>
      )}
      {plan.fixed.length > 0 && (
        <p className="text-sm" role="status">
          <strong>Fixed since the last check ({plan.fixed.length}):</strong> {plan.fixed.join(", ")}
        </p>
      )}
      {!plan.passed && (
        <>
          <h4 className="font-medium">Still needs attention ({plan.still.length})</h4>
          <ol className="space-y-2">
            {plan.still.map((s, n) => (
              <li
                key={s.key}
                className={`rounded-sm border border-border p-3 ${done.has(s.key) ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    aria-label={`I've sent fix ${n + 1} to ${tool}`}
                    checked={done.has(s.key)}
                    onChange={(e) =>
                      setDone((d) => {
                        const x = new Set(d);
                        if (e.target.checked) x.add(s.key);
                        else x.delete(s.key);
                        return x;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {n + 1}. {s.title}
                      {plan.fresh.includes(s.key) && (
                        <span className="ml-2 rounded-sm bg-accent px-1.5 text-xs text-accent-foreground">
                          New
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{s.fix}</p>
                    <p className="eyebrow mt-1">
                      {s.source === "prescription"
                        ? "Doesn't match your design"
                        : "Measured problem"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => void copy(s.key, fixMessage(tool, title, s))}
                >
                  <Copy /> {copied === s.key ? "Copied" : `Copy fix for ${tool}`}
                </Button>
              </li>
            ))}
          </ol>
        </>
      )}
      {onRecheck && (
        <Button
          onClick={onRecheck}
          disabled={busy}
          title="Review the same page again and compare with this check"
        >
          <RefreshCw /> {busy ? "Checking…" : "Check the page again"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Passing means every measured check holds. It isn't a full usability or accessibility audit.
      </p>
    </section>
  );
}
