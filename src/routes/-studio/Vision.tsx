import { focusLocalStorage } from "@/lib/browser-storage";
import { DesignShareAction } from "@/components/DesignShareAction";
import { LazyAuthoredPagePanel } from "@/components/LazyAuthoredPagePanel";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";
import type { State } from "@/lib/studio-state";
import { ContentEditor } from "@/components/ContentEditor";
import { useExportReceipt } from "@/hooks/useExportReceipt";
import { ExportReceipt } from "@/components/ExportReceipt";
import { IntegrationChoice } from "@/components/IntegrationChoice";
import { hasCloudBackend } from "@/lib/runtime-config";
import { BeforeAfter } from "@/components/BeforeAfter";
import { BadgePanel } from "@/components/BadgePanel";
import { LiveVisionPanel } from "@/components/LiveVisionPanel";
import { BrandLogo, ReverieArt } from "@/components/BrandArt";
import { designId } from "@/lib/launch";
import { signDesignId } from "@/lib/signing.functions";
import { createShare } from "@/lib/projects";
import { buildPack, downloadBlob, PackError, scopedTokensCss } from "@/lib/exportPack";
import { useUser } from "@/hooks/useSession";
import { useEffect, useRef, useState } from "react";
import { HelpTip, Term, WhyPopover } from "@/components/Help";
import { useCopied } from "@/hooks/useUx";
import { CHECK_CARD, workHash } from "@/lib/ux";
import { toast } from "sonner";
import { PreviewFrame } from "@/components/DesignPreview";
import { TASTE_KEY, parseTaste, rememberTaste } from "@/lib/taste";
import type { LibraryState } from "@/lib/library";
import { NAV_PATTERNS } from "@/lib/nav";
import { ComponentSheet } from "@/components/ComponentSheet";
import { SkinBar } from "@/components/SkinBar";
import { LaunchPanel } from "@/components/LaunchPanel";
import { buildStudioLaunchArtifact } from "@/lib/studio-launch-artifact";
import { Button } from "@/components/ui/button";
import {
  STEPS,
  TOOLS,
  toolMessages,
  buildPrescription,
  tokensCss,
  type Integration,
} from "@/lib/design";
import { measuredChecks, qualityGrade } from "@/lib/engine";
import { useDesignFonts } from "@/lib/useDesignFonts";
import type { StudioStageProps } from "./stage";

// Library backups and reopening a design retain its bounded Undo/Redo timeline.
// archiveDesign removes generated option caches before writing this state.
const libState = (state: State) => state as unknown as LibraryState;

export function Vision({ s, update, ask }: StudioStageProps) {
  useDesignFonts([s.tokens]);
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("Lovable");
  const integration = s.integration;
  const setIntegration = (mode: Integration) => update({ integration: mode });
  const md = buildPrescription({
    integration,
    brief: s.brief,
    content: s.content!,
    direction: s.direction,
    tokens: s.tokens!,
    picks: s.picks,
    tool,
    checks: measuredChecks(s.tokens!),
    nav: s.nav,
    experience: s.purpose.experience,
  });
  useEffect(() => {
    if (!s.picks.length) return;
    try {
      const next = rememberTaste(
        parseTaste(focusLocalStorage.getItem(TASTE_KEY)),
        s.picks,
        s.content?.brand ?? "",
      );
      focusLocalStorage.setItem(TASTE_KEY, JSON.stringify(next));
    } catch {
      /* taste memory is optional */
    }
  }, [s.picks, s.content?.brand]);
  const user = useUser();
  const receipt = useExportReceipt(JSON.stringify([s, tool]), user?.id ?? null);
  const { copied, copy: copyText } = useCopied();
  const exported = (scope: "spec" | "project" = "spec") => {
    const pageIsDefault = JSON.stringify(s.page) === JSON.stringify(DEFAULT_PAGE_SETTINGS);
    if (
      scope === "project" ||
      pageIsDefault ||
      integration === "existing" ||
      s.purpose.experience === "app"
    )
      update({ savedHash: workHash(s) });
  };
  const copy = async (k: string, text: string) => {
    try {
      const request = receipt.begin();
      if ((await copyText(k, text)) && receipt.isCurrent(request)) {
        if (k === "rx" || k === "msg0") exported();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy this design.");
    }
  };
  const download = () => {
    try {
      const request = receipt.begin();
      downloadBlob(new Blob([md], { type: "text/markdown" }), "DESIGN.md");
      receipt.offer(request, "DESIGN.md", exported);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not download DESIGN.md. Please try again.",
      );
    }
  };
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"page" | "parts">("page");
  const [advanced, setAdvanced] = useState(false);
  const showAuthored = s.purpose.experience !== "app" && integration === "new";
  const [packing, setPacking] = useState(false);
  const packingNow = useRef(false);
  const [sharing, setSharing] = useState(false);
  const pack = async () => {
    if (busy || packingNow.current || !s.tokens) return;
    packingNow.current = true;
    setBusy(true);
    setPacking(true);
    try {
      const request = receipt.begin();
      // Signature is optional: an unsigned pack still works if signing is unavailable.
      const sig = hasCloudBackend()
        ? await signDesignId({ data: { id: designId(s.tokens) } })
            .then((r) => r.sig)
            .catch(() => undefined)
        : undefined;
      if (!receipt.isCurrent(request)) return;
      const blob = await buildPack(md, s.tokens, s.content?.brand, sig, integration);
      if (!receipt.isCurrent(request)) return;
      const filename =
        integration === "existing" ? "focus-existing-site-pack.zip" : "focus-design-pack.zip";
      downloadBlob(blob, filename);
      receipt.offer(request, filename, exported);
    } catch (e) {
      toast.error(
        e instanceof PackError
          ? `This pack didn't pass its safety check, so nothing was downloaded: ${e.problems.join("; ")}.`
          : "Could not download the design pack. Please try again.",
      );
    } finally {
      packingNow.current = false;
      setBusy(false);
      setPacking(false);
    }
  };
  const share = async () => {
    if (busy) return;
    setBusy(true);
    setSharing(true);
    try {
      const url = await createShare(s.content?.brand ?? "Untitled design", {
        tokens: s.tokens,
        content: s.content,
        direction: s.direction,
      });
      const copied = await copyText("share", url);
      if (copied) toast.success("Share link copied", { description: url });
      else toast.info("Your share link is ready", { description: url, duration: 15000 });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setSharing(false);
    }
  };
  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:px-10 lg:grid-cols-[1fr_1.1fr]">
      <div className="lg:col-span-2">
        <IntegrationChoice value={integration} onChange={setIntegration} />
      </div>
      {showAuthored && (
        <div className="lg:col-span-2">
          <LazyAuthoredPagePanel
            key={s.libraryId ?? "draft"}
            tokens={s.tokens!}
            content={s.content!}
            settings={s.page}
            onSettings={(page) => update({ page })}
            onContent={(content) => update({ content })}
            onExport={() => exported("project")}
            projectState={libState(s)}
          />
        </div>
      )}
      {showAuthored && (
        <button
          type="button"
          className="lg:col-span-2 flex min-h-14 items-center justify-between border-b border-border text-left text-sm font-medium"
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          Design specification &amp; handoff tools{" "}
          <span aria-hidden="true">{advanced ? "−" : "+"}</span>
        </button>
      )}
      <div hidden={showAuthored && !advanced} className="min-w-0 space-y-5">
        <BrandLogo variant="vision" />
        <h2 className="font-display text-5xl leading-none">
          A clear direction.
          <br />
          Ready to make real.
        </h2>
        {integration === "existing" && (
          <p className="rounded-sm border border-border bg-card p-3 text-sm">
            This is a style study. Focus reads public pages and prepares files; it does not install
            changes on your live site. Preview words and navigation are examples. Apply the pack to
            a separate staging or local copy first, then verify the original content, routes, and
            working tasks before an owner-reviewed release.
          </p>
        )}
        <ContentEditor content={s.content!} onChange={(content) => update({ content })} />
        {s.quick && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-accent/50 bg-accent/10 p-3 text-sm">
            <span>
              You answered the 3 main questions. The other {STEPS.length - 3} use your direction's
              choices.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => update({ quick: false, stage: "exam", stepIndex: 3 })}
            >
              Answer the other {STEPS.length - 3} questions
            </Button>
          </div>
        )}
        {(() => {
          const g = qualityGrade(measuredChecks(s.tokens!));
          return (
            <div
              className="rounded-sm border border-border bg-card p-4"
              aria-label="Design token checks"
            >
              <div className="flex items-center gap-3">
                <HelpTip tip="These checks measure the selected design tokens. They do not verify a rendered page, keyboard operation, or usability.">
                  <div tabIndex={0} className="flex gap-1" aria-label={`Level ${g.level + 1} of 3`}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-2 w-8 rounded-full ${i <= g.level ? "bg-primary" : "bg-border"}`}
                      />
                    ))}
                  </div>
                </HelpTip>
                <p className="font-semibold">
                  {g.name}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · design tokens only
                  </span>
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{g.summary}</p>
              {g.missing.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {g.missing.map((m) => (
                    <li key={m}>
                      To improve: {m} {CHECK_CARD[m] && <WhyPopover cardId={CHECK_CARD[m]!} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
        {s.libraryId && s.tokens && (
          <SkinBar id={s.libraryId} tokens={s.tokens} onChange={(tokens) => update({ tokens })} />
        )}
        <p className="text-muted-foreground">
          Paste this <Term term="prescription">Vision</Term> into your AI builder. It carries every
          decision, your reasons, measured contrast, and the craft rules generic AI pages skip.
        </p>

        <label className="block text-sm">
          <span className="eyebrow">Which tool do you build with?</span>
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value as (typeof TOOLS)[number])}
            className="mt-1 h-11 w-full rounded-sm border border-input bg-background px-2"
          >
            {TOOLS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            {integration === "existing"
              ? "The Vision adds safe restyle steps for that tool. The pack adds rule lines you paste into your own rules file, plus a short version for small or local models."
              : "The Vision adds instructions for that tool. The design pack also includes files for every major tool and a short version for small or local models."}
          </span>
        </label>
        {(() => {
          const m = toolMessages(tool, s.content!.brand, integration);
          return (
            <details className="rounded-sm border border-border bg-card p-3 text-sm">
              <summary className="min-h-6 cursor-pointer font-medium">
                What to say to {tool}, step by step
              </summary>
              <ol className="mt-3 space-y-3">
                {[m.first, ...m.next].map((msg, i) => (
                  <li key={msg}>
                    <p className="text-xs text-muted-foreground">
                      {i === 0
                        ? "1. Send first, with the Vision pasted after it"
                        : `${i + 1}. Send next`}
                    </p>
                    <p className="mt-1">{msg}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={() => copy(`msg${i}`, i === 0 ? `${msg}\n\n${md}` : msg)}
                    >
                      {copied === `msg${i}`
                        ? "Copied ✓"
                        : i === 0
                          ? "Copy message and Vision"
                          : "Copy message"}
                    </Button>
                  </li>
                ))}
              </ol>
            </details>
          );
        })()}
        <fieldset className="space-y-1.5">
          <legend className="eyebrow">How visitors move around</legend>
          {NAV_PATTERNS.map((n) => (
            <label
              key={n.id}
              className="flex min-h-11 cursor-pointer items-start gap-2 rounded-sm border border-border bg-card p-2.5 text-sm has-[:checked]:border-accent"
            >
              <input
                type="radio"
                name="nav"
                className="mt-1 h-4 w-4"
                checked={s.nav === n.id}
                onChange={() => update({ nav: n.id })}
              />
              <span>
                <span className="font-medium">{n.label}</span>
                <span className="block text-xs text-muted-foreground">Best when: {n.when}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="brand-handoff-note">
          <ReverieArt pose="handoff" />
          <p>
            <strong>A thoughtful handoff, one step at a time.</strong>
            <br />
            {integration === "existing"
              ? "Start with START-HERE.md in a new, empty folder. Keep a backup, try one page in staging, test real tasks with sandbox data, and rehearse rollback before publishing."
              : "Keep a copy of your work. Review the included setup steps, test your pages and key tasks in a preview, and check the details before publishing."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="min-w-44" onClick={() => copy("rx", md)}>
            {copied === "rx" ? "Copied ✓" : "Copy Vision"}
          </Button>
          <Button
            variant="outline"
            className="min-w-48"
            onClick={() =>
              copy(
                "tok",
                integration === "existing" ? scopedTokensCss(s.tokens!) : tokensCss(s.tokens!),
              )
            }
          >
            {copied === "tok" ? "Copied ✓" : "Copy design values only"}
          </Button>
          <Button variant="outline" onClick={download}>
            Download DESIGN.md
          </Button>
          <Button variant="outline" disabled={busy} onClick={pack}>
            {packing
              ? "Checking and preparing your pack…"
              : integration === "existing"
                ? "Download existing-site pack"
                : "Download design pack"}
          </Button>
          <DesignShareAction
            signedIn={!!user}
            busy={busy}
            sharing={sharing}
            onShare={() => void share()}
          />
          <Button variant="ghost" onClick={() => ask?.("retake")}>
            Answer the questions again
          </Button>
        </div>
        <ExportReceipt receipt={receipt.pending} />
        <p role="status" className="sr-only">
          {sharing ? "Creating your share link…" : packing ? "Preparing your design pack…" : ""}
        </p>
        <pre className="max-h-[32rem] overflow-auto rounded-sm border border-border bg-card p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {md}
        </pre>
        {integration === "existing" && <BeforeAfter />}
        {s.libraryId && s.tokens && s.content && (
          <LaunchPanel
            id={s.libraryId}
            title={s.content.brand}
            tokens={s.tokens}
            tool={tool}
            artifact={buildStudioLaunchArtifact(s)}
          />
        )}
        {s.tokens && s.content && (
          <LiveVisionPanel designId={designId(s.tokens)} title={s.content.brand} vision={md} />
        )}
        {s.tokens && (
          <BadgePanel tokens={s.tokens} picks={s.picks} brand={s.content?.brand ?? ""} />
        )}
      </div>
      <section hidden={showAuthored && !advanced} className="h-fit min-w-0 space-y-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "page" ? "default" : "outline"}
            onClick={() => setView("page")}
          >
            Page
          </Button>
          <Button
            size="sm"
            variant={view === "parts" ? "default" : "outline"}
            onClick={() => setView("parts")}
          >
            Components &amp; states
          </Button>
        </div>
        <div className="overflow-hidden rounded-sm border border-border shadow-sm">
          {view === "page" ? (
            <PreviewFrame
              t={s.tokens!}
              c={s.content!}
              phoneFirst={s.purpose.device === "mostly phones"}
              bottomTabs={s.nav === "bottom-tabs"}
              experience={s.purpose.experience}
            />
          ) : (
            <ComponentSheet t={s.tokens!} c={s.content!} />
          )}
        </div>
      </section>
    </main>
  );
}
