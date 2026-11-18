import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BrandLogo, CatMascot } from "@/components/BrandArt";
import { Button } from "@/components/ui/button";
import { focusLocalStorage } from "@/lib/browser-storage";
import { downloadBlob } from "@/lib/exportPack";
import {
  EMPTY_ONBOARDING,
  ONBOARDING_STEPS,
  onboardingChecklist,
  readOnboardingProgress,
  saveOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/onboarding";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to Focus — your guided first session" },
      {
        name: "description",
        content: "A guided path from a design idea to a carefully tested existing-project handoff.",
      },
    ],
  }),
  component: WelcomeSession,
});

export function WelcomeSession() {
  const [progress, setProgress] = useState<OnboardingProgress>({ ...EMPTY_ONBOARDING });
  const [ready, setReady] = useState(false);
  const [storageIssue, setStorageIssue] = useState<"unavailable" | "invalid" | null>(null);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloadError, setDownloadError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const result = readOnboardingProgress(focusLocalStorage);
    setProgress(result.progress);
    setStorageIssue(result.issue);
    setReady(true);
  }, []);

  const step = ONBOARDING_STEPS[progress.step]!;
  const last = progress.step === ONBOARDING_STEPS.length - 1;
  const move = (index: number, finished = false) => {
    const next = { version: 1 as const, step: index, finished };
    setProgress(next);
    setStorageIssue(saveOnboardingProgress(focusLocalStorage, next) ? null : "unavailable");
    // Focus stays on the current guide content rather than jumping back to page navigation.
    requestAnimationFrame(() => heading.current?.focus());
  };
  const download = () => {
    try {
      downloadBlob(
        new Blob([onboardingChecklist()], { type: "text/markdown;charset=utf-8" }),
        "focus-existing-project-trial-checklist.md",
      );
      setDownloadError(false);
      setDownloadStatus(
        "Checklist download started. Check your downloads and keep it with your trial evidence.",
      );
    } catch {
      setDownloadError(true);
      setDownloadStatus(
        "The checklist could not be downloaded. Please try again; the guide remains available here.",
      );
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="eyebrow">Your first session</p>
            <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">
              Welcome to Focus
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A friendly guide from first idea to a tested handoff. Follow along at your own pace,
              and come back through Explore → Welcome to Focus whenever you need a hand.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              Return to studio <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        {!ready ? (
          <p role="status">Opening your guide…</p>
        ) : (
          <>
            {storageIssue && (
              <p role="status" className="mb-5 rounded-xl border border-border bg-card p-4 text-sm">
                {storageIssue === "invalid"
                  ? "Your saved guide progress could not be read, so this guide opened at the beginning. Your designs were not changed."
                  : "Guide progress could not be saved in this browser. You can still use every step; keep this tab open or reopen the guide anytime."}
              </p>
            )}
            <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr] lg:gap-10">
              <nav aria-label="Welcome tour steps">
                <p className="mb-3 text-xs text-muted-foreground">
                  Guide navigation · not project test results
                </p>
                <ol className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  {ONBOARDING_STEPS.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => move(index)}
                        aria-current={index === progress.step ? "step" : undefined}
                        className={`flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${index === progress.step ? "border-primary bg-primary/5 font-medium" : "border-transparent text-muted-foreground hover:bg-muted"}`}
                      >
                        <span aria-hidden="true" className="font-mono text-xs">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.shortTitle}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>

              <section
                aria-labelledby="welcome-step-title"
                className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-8"
              >
                <div className="mb-5 flex items-center gap-4">
                  <div className="w-24 shrink-0 sm:w-28" aria-hidden="true">
                    <CatMascot pose={progress.step >= 4 ? "handoff" : "library"} />
                  </div>
                  <p className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed">
                    {step.cat}
                  </p>
                </div>
                <p className="eyebrow" aria-live="polite">
                  Tour step {progress.step + 1} of {ONBOARDING_STEPS.length}
                </p>
                <h2
                  ref={heading}
                  tabIndex={-1}
                  id="welcome-step-title"
                  className="mt-2 font-display text-3xl leading-tight outline-none sm:text-4xl"
                >
                  {step.title}
                </h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">{step.summary}</p>
                {step.id === "design" && (
                  <div className="mt-5">
                    <BrandLogo variant="vision" />
                  </div>
                )}
                <ol className="mt-6 space-y-4">
                  {step.tasks.map((task, index) => (
                    <li key={task} className="flex gap-3 text-sm leading-relaxed">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs"
                      >
                        {index + 1}
                      </span>
                      <span>{task}</span>
                    </li>
                  ))}
                </ol>
                {"developerDetails" in step && (
                  <details className="mt-5 rounded-xl border border-border p-4 text-sm">
                    <summary className="min-h-6 cursor-pointer font-medium">
                      Details for your developer
                    </summary>
                    <ul className="mt-3 list-disc space-y-3 pl-5 leading-relaxed text-muted-foreground">
                      {step.developerDetails.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  {step.id === "pack" && (
                    <Button asChild>
                      <Link to="/target" target="_blank" rel="noopener noreferrer">
                        Open Target <ExternalLink size={14} />
                        <span className="sr-only"> (new tab)</span>
                      </Link>
                    </Button>
                  )}
                  {(step.id === "welcome" || step.id === "design" || step.id === "pack") && (
                    <Button asChild variant="outline">
                      <Link to="/" target="_blank" rel="noopener noreferrer">
                        Open design studio <ExternalLink size={14} />
                        <span className="sr-only"> (new tab)</span>
                      </Link>
                    </Button>
                  )}
                  {(step.id === "protect" || step.id === "design") && (
                    <Button asChild variant="outline">
                      <Link to="/library" target="_blank" rel="noopener noreferrer">
                        Open My designs <ExternalLink size={14} />
                        <span className="sr-only"> (new tab)</span>
                      </Link>
                    </Button>
                  )}
                  {(step.id === "review" || step.id === "publish") && (
                    <Button asChild variant="outline">
                      <Link
                        to="/critic"
                        search={{ mode: "check" }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Check a live site <ExternalLink size={14} />
                        <span className="sr-only"> (new tab)</span>
                      </Link>
                    </Button>
                  )}
                  {progress.step >= 4 && (
                    <Button variant="outline" onClick={download}>
                      <Download size={16} />
                      Download trial checklist
                    </Button>
                  )}
                </div>
                {(
                  ["welcome", "protect", "review", "design", "pack", "publish"] as string[]
                ).includes(step.id) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tool links open a new tab so you can keep this guide beside your work.
                  </p>
                )}
                {downloadStatus && (
                  <p
                    role={downloadError ? "alert" : "status"}
                    className={`mt-3 text-sm ${downloadError ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {downloadStatus}
                  </p>
                )}
                {progress.finished && (
                  <div
                    role="status"
                    className="mt-6 rounded-xl border border-border bg-background p-4 text-sm leading-relaxed"
                  >
                    <strong>Your guide is complete.</strong> Your project still needs its own task
                    tests, rollback evidence and owner-reviewed release decision. You can revisit
                    any step.
                  </div>
                )}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <Button
                    variant="ghost"
                    onClick={() => move(progress.step - 1)}
                    disabled={progress.step === 0}
                  >
                    <ArrowLeft size={16} />
                    Back
                  </Button>
                  {last ? (
                    <Button onClick={() => move(progress.step, true)} disabled={progress.finished}>
                      {progress.finished ? "Tour finished" : "Finish tour"}
                    </Button>
                  ) : (
                    <Button onClick={() => move(progress.step + 1)}>
                      Next guide step <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Tour progress records where you stopped reading. It does not record tests, connect
                  accounts, install files or approve a release.
                </p>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
