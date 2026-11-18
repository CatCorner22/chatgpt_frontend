import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/useSession";
import { critiqueUrl } from "@/lib/critic.functions";
import { compareToPrescription, fitterBrief, safeUrl } from "@/lib/critic";
import {
  TASKS,
  addEvidence,
  evidenceChange,
  launchBlocker,
  launchFingerprint,
  markLaunched,
  readProgress,
  repairPack,
  upsertProgress,
  writeProgress,
  type ProgressRecord,
  type ReviewEvidence,
} from "@/lib/launch";
import { saveProgress } from "@/lib/launch.functions";
import type { Tokens } from "@/lib/design";
import { FixList } from "@/components/FixList";
import { ShotReview } from "@/components/ShotReview";
import { downloadBlob } from "@/lib/exportPack";

export function LaunchPanel({
  id,
  title,
  tokens,
  tool,
  artifact,
}: {
  id: string;
  title: string;
  tokens: Tokens;
  tool: string;
  artifact?: unknown;
}) {
  const [record, setRecord] = useState<ProgressRecord | null>(null);
  const [url, setUrl] = useState("");
  const currentPageUrl = useRef(url);
  currentPageUrl.current = url;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountSaved, setAccountSaved] = useState(false);
  const user = useUser();
  const review = useServerFn(critiqueUrl);
  const save = useServerFn(saveProgress);
  const fingerprint = launchFingerprint(tokens, artifact);
  const currentBuild = useRef({ id, fingerprint });
  currentBuild.current = { id, fingerprint };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setBusy(false);
    setAccountSaved(false);
    try {
      const next = upsertProgress(
        readProgress(),
        id,
        title,
        tokens,
        new Date().toISOString(),
        artifact,
      );
      writeProgress(next);
      const current = next.find((r) => r.id === id);
      setRecord(current ?? null);
      setUrl(current?.details.url ?? "");
      setError("");
    } catch {
      setError("Could not remember launch progress. Your design is unchanged.");
    }
  }, [id, title, fingerprint]);
  const persist = (next: ProgressRecord) => {
    // A request started for an earlier build must never restore its old confirmations.
    if (
      !mounted.current ||
      next.id !== currentBuild.current.id ||
      next.fingerprint !== currentBuild.current.fingerprint
    )
      return;
    try {
      const all = readProgress();
      writeProgress(
        all.some((r) => r.id === id) ? all.map((r) => (r.id === id ? next : r)) : [...all, next],
      );
      setRecord(next);
      setAccountSaved(false);
    } catch {
      setError("Could not save this progress. Download the review before leaving.");
    }
  };
  const keepReview = (evidence: ReviewEvidence) => {
    if (record) persist({ ...record, details: addEvidence(record.details, evidence) });
  };
  const checkPage = async () => {
    const target = safeUrl(url);
    if (!record || !target) return;
    setBusy(true);
    setError("");
    try {
      const r = await review({ data: { url: target.toString() } });
      if (
        !mounted.current ||
        record.id !== currentBuild.current.id ||
        record.fingerprint !== currentBuild.current.fingerprint ||
        safeUrl(currentPageUrl.current)?.href !== target.href
      )
        return;
      const cmp = compareToPrescription(r.facts, tokens);
      const evidence: ReviewEvidence = {
        kind: "page",
        target: target.toString(),
        at: new Date().toISOString(),
        score: r.score,
        summary: r.review?.verdict ?? "Measured page-code checks only; visual opinion unavailable.",
        checks: r.findings.map((f) => ({
          name: f.id,
          ok: f.ok,
          detail: f.detail,
          fix: f.fix,
          ...(f.possible ? { possible: true } : {}),
        })),
        prescription: cmp.items,
        priorities: r.review?.priorities ?? [],
        repair: fitterBrief(
          r.host,
          r.findings,
          cmp.items.filter((c) => !c.ok).map((c) => c.name),
          r.review?.priorities ?? [],
        ),
      };
      persist({
        ...record,
        details: { ...addEvidence(record.details, evidence), url: target.toString() },
      });
    } catch (e) {
      if (
        mounted.current &&
        record.id === currentBuild.current.id &&
        record.fingerprint === currentBuild.current.fingerprint &&
        safeUrl(currentPageUrl.current)?.href === target.href
      )
        setError(e instanceof Error ? e.message : "Could not review this page.");
    } finally {
      if (
        mounted.current &&
        record.id === currentBuild.current.id &&
        record.fingerprint === currentBuild.current.fingerprint
      )
        setBusy(false);
    }
  };
  if (!record || record.id !== id || record.fingerprint !== fingerprint)
    return (
      <section className="border-t border-border pt-6">
        <p role="status">{error || "Preparing launch progress…"}</p>
      </section>
    );
  const latest = record.details.reviews.at(-1);
  const change = evidenceChange(record.details.reviews);
  const blocker =
    record.details.status === "launched"
      ? null
      : busy
        ? "Wait for the current page review or save to finish before recording a launch."
        : url !== record.details.url
          ? "Finish updating the address, then review that page and confirm the tasks."
          : launchBlocker(record.details);
  return (
    <section className="space-y-4 border-t border-border pt-6" aria-labelledby="launch-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="launch-title" className="font-display text-3xl">
          Build → review → launch
        </h2>
        <Button asChild variant="link">
          <Link to="/progress">
            Horizon
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <ol className="flex flex-wrap gap-3 text-sm" aria-label="Launch progress">
        {["ready", "built", "reviewed", "launched"].map((stage, n) => (
          <li
            key={stage}
            className={
              stage === record.details.status
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            }
          >
            {n + 1}.{" "}
            {stage === "ready"
              ? `Ready for ${tool}`
              : stage === "built"
                ? "Built"
                : stage === "reviewed"
                  ? "Reviewed"
                  : "Launched"}
          </li>
        ))}
      </ol>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          persist({ ...record, details: { ...record.details, status: "built", launchedAt: null } })
        }
      >
        I have built the design
      </Button>
      <label className="block text-sm">
        Built page address
        <Input
          aria-label="Built page address"
          className="mt-1"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setAccountSaved(false);
          }}
          onBlur={() => {
            if (url !== record.details.url)
              persist({
                ...record,
                details: { ...record.details, url, tasks: [], launchedAt: null, status: "built" },
              });
          }}
          placeholder="https://your-site.com/page"
        />
      </label>
      <Button disabled={busy || !safeUrl(url)} onClick={() => void checkPage()}>
        {busy ? "Reviewing your result…" : "Review built page"}
      </Button>
      <ShotReview key={fingerprint} rx={tokens} onReviewed={keepReview} />
      {latest && (
        <div className="space-y-3 border-y border-border py-4">
          <p className="eyebrow">
            {latest.kind === "page"
              ? `Measured floor: ${latest.score}/100 · visual summary is AI opinion`
              : "Screenshot AI opinion · no measured score"}
          </p>
          <p>{latest.summary}</p>
          <p className="text-xs text-muted-foreground">
            {latest.target} · {new Date(latest.at).toLocaleString()}
          </p>
          {change && (
            <p className="text-sm">
              {change.resolved} resolved · {change.newIssues} new issues
              {change.scoreDelta !== null
                ? ` · score change ${change.scoreDelta >= 0 ? "+" : ""}${change.scoreDelta}`
                : ""}
            </p>
          )}
          <FixList
            key={latest.at}
            reviews={record.details.reviews}
            title={title}
            tool={tool}
            busy={busy}
            onRecheck={
              latest.kind === "page" && safeUrl(latest.target) ? () => void checkPage() : undefined
            }
          />
          {latest.checks.some((check) => check.possible && !check.ok) && (
            <div className="space-y-2 text-sm">
              <p className="font-medium">Possible issues to review with the owner</p>
              <p className="text-muted-foreground">
                These are suggestions to inspect, not confirmed failures or automatic passes.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {latest.checks
                  .filter((check) => check.possible && !check.ok)
                  .map((check) => (
                    <li key={check.name}>
                      {check.detail} {check.fix}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <ul className="text-sm" aria-label="Matches your design">
            {latest.prescription.map((c) => (
              <li key={c.name}>
                {c.ok ? "✓" : "✗"} {c.name}
              </li>
            ))}
          </ul>
          {latest.priorities.length > 0 && (
            <p className="font-medium">Art director's suggestions (AI opinion)</p>
          )}
          <ol className="space-y-2 text-sm">
            {latest.priorities.map((p, n) => (
              <li key={n}>
                <strong>
                  {n + 1}. {p.title}
                </strong>
                <p>{p.fix}</p>
              </li>
            ))}
          </ol>
          <Button
            variant="outline"
            onClick={() => {
              try {
                downloadBlob(
                  new Blob([repairPack(title, latest)], { type: "text/markdown" }),
                  "result-repair.md",
                );
              } catch {
                toast.error("Could not download this repair.");
              }
            }}
          >
            <Download />
            Download result repair
          </Button>
          <details>
            <summary className="cursor-pointer text-sm">
              Earlier review attempts ({record.details.reviews.length})
            </summary>
            <ul className="mt-2 text-sm">
              {record.details.reviews.map((r, n) => (
                <li key={n}>
                  {new Date(r.at).toLocaleString()} · {r.kind} ·{" "}
                  {r.score === null ? "AI opinion" : `${r.score}/100`}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium">Confirm with the real built result</legend>
        {TASKS.map((t) => (
          <label key={t.id} className="flex min-h-11 items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={record.details.tasks.includes(t.id)}
              disabled={!latest}
              onChange={(e) =>
                persist({
                  ...record,
                  details: {
                    ...record.details,
                    tasks: e.target.checked
                      ? [...record.details.tasks, t.id]
                      : record.details.tasks.filter((id) => id !== t.id),
                    status: "reviewed",
                    launchedAt: null,
                  },
                })
              }
            />
            {t.label}
          </label>
        ))}
      </fieldset>
      {blocker && (
        <p id="launch-readiness" role="status" className="text-sm text-muted-foreground">
          {blocker}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!!blocker || record.details.status === "launched"}
          aria-describedby={blocker ? "launch-readiness" : undefined}
          onClick={() => {
            try {
              persist({
                ...record,
                details: markLaunched(record.details, new Date().toISOString()),
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not record launch.");
            }
          }}
        >
          {record.details.status === "launched" ? "Launch recorded" : "Record launch"}
        </Button>
        {user ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await save({ data: record });
                if (
                  !mounted.current ||
                  record.id !== currentBuild.current.id ||
                  record.fingerprint !== currentBuild.current.fingerprint
                )
                  return;
                setAccountSaved(true);
                toast.success("Launch evidence saved to your account");
              } catch (e) {
                if (
                  mounted.current &&
                  record.id === currentBuild.current.id &&
                  record.fingerprint === currentBuild.current.fingerprint
                )
                  setError(e instanceof Error ? e.message : "Could not save account evidence.");
              } finally {
                if (
                  mounted.current &&
                  record.id === currentBuild.current.id &&
                  record.fingerprint === currentBuild.current.fingerprint
                )
                  setBusy(false);
              }
            }}
          >
            <Save />
            {accountSaved ? "Saved to account" : "Save evidence to account"}
          </Button>
        ) : (
          <Button asChild variant="link">
            <Link to="/auth">Sign in to keep account evidence</Link>
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Task checks are your confirmation, not automated usability certification. A high score alone
        does not prove a first-class design.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
