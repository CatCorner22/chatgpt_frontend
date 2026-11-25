import { useMemo, useRef, useState } from "react";
import { useDraftExitSave } from "@/hooks/useDraftExitSave";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Clipboard,
  Code2,
  Download,
  FileCheck2,
  FlaskConical,
  ListChecks,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BrowserAuditPanel } from "@/components/BrowserAuditPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadBlob } from "@/lib/download-blob";
import { inertMarkup } from "@/lib/quality-markup";
import { allRules } from "../../north-star-kit/data/rules";
import { checkRegistry } from "../../north-star-kit/page-checks";
import { receipt } from "../../north-star-kit/logic/receipt";
import { repairPlan } from "../../north-star-kit/logic/repair-plan";
import type { Finding } from "../../north-star-kit/types";
import goodSample from "../../north-star-kit/fixtures/good.html?raw";
import flawedSample from "../../north-star-kit/fixtures/flawed.html?raw";

const MAX_SOURCE = 250_000;
type Inspection = { findings: Finding[]; source: string; label: string };
const ruleNames = new Map(allRules.map((rule) => [rule.id, rule.plain]));

function inspectMarkup(source: string): Finding[] {
  const doc = new DOMParser().parseFromString(inertMarkup(source), "text/html");
  return checkRegistry.flatMap((check): Finding[] => {
    if (check.needsRealBrowser) {
      return [
        {
          ruleId: check.ruleId,
          status: "could-not-measure",
          measured: "This static inspection does not render styles or operate the page.",
          fix: "Run this check on the rendered page in a real browser.",
        },
      ];
    }
    try {
      return check.run(doc);
    } catch {
      return [
        {
          ruleId: check.ruleId,
          status: "could-not-measure",
          measured: "The check could not read the supplied markup.",
          fix: "Check the rendered page in a real browser.",
        },
      ];
    }
  });
}

export function QualityWorkbench() {
  const [source, setSource] = useState("");
  const [label, setLabel] = useState("Your page");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("measured");
  const resultsRef = useRef<HTMLElement>(null);
  const hasPrivateMarkup = useRef(false);
  useDraftExitSave(() => !hasPrivateMarkup.current);
  const report = useMemo(
    () => (inspection ? receipt(inspection.findings, allRules) : null),
    [inspection],
  );
  const plan = useMemo(
    () => (inspection ? repairPlan(inspection.findings, [], allRules) : null),
    [inspection],
  );
  const fails = inspection?.findings.filter((finding) => finding.status === "fails") ?? [];
  const stale = !!inspection && source !== inspection.source;
  const measured = [...(report?.measured ?? [])].sort(
    (a, b) => Number(b.status === "fails") - Number(a.status === "fails"),
  );

  const inspect = (nextSource = source, nextLabel = label) => {
    if (!nextSource.trim()) {
      setError("Paste your page’s HTML or choose one of the sample pages.");
      return;
    }
    if (nextSource.length > MAX_SOURCE) {
      setError(
        "This page is too large for the local check. Use a page smaller than 250,000 characters.",
      );
      return;
    }
    if (!/<[a-z][\s\S]*>/i.test(nextSource)) {
      setError(
        "This looks like plain text. Paste HTML that includes elements such as <main> or <img>.",
      );
      return;
    }
    try {
      setInspection({ findings: inspectMarkup(nextSource), source: nextSource, label: nextLabel });
      setError("");
      setTab("measured");
      requestAnimationFrame(() => resultsRef.current?.focus({ preventScroll: true }));
    } catch {
      setError(
        "This markup could not be read. Check that you pasted a complete HTML page and try again.",
      );
    }
  };
  const sample = (kind: "good" | "flawed") => {
    const next = kind === "good" ? goodSample : flawedSample;
    const name = kind === "good" ? "Reference sample" : "Flawed sample";
    hasPrivateMarkup.current = false;
    setSource(next);
    setLabel(name);
    inspect(next, name);
  };
  const download = () => {
    if (!report || !inspection || !plan) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "north-star-static-receipt-v1",
            page: inspection.label,
            scope:
              "Static markup only. Source URLs, scripts and styling were not loaded. Layout, keyboard use, assistive technology and lived experience were not tested.",
            receipt: report,
            repairPlan: plan,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    downloadBlob(blob, "north-star-receipt.json");
  };
  const copyRepairs = async () => {
    if (!plan) return;
    const text = [
      "Static markup repair list",
      "Recheck the rendered page after each fix; these results do not verify layout or interaction.",
      "",
      ...plan.items.map(
        (item, index) => `${index + 1}. ${item.fix}${item.where ? ` (${item.where})` : ""}`,
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Repair list copied");
    } catch {
      toast.error("The browser could not copy the list. Download the receipt instead.");
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-10">
          <div>
            <p className="eyebrow mb-4 flex items-center gap-2">
              <FlaskConical size={14} aria-hidden /> Quality lab
            </p>
            <h1 className="max-w-3xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
              A small check.
              <br />
              <span className="text-muted-foreground">A clear next step.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Find concrete problems in your page’s HTML. Take a repair list with you, and see
              exactly what still needs a real browser or a human eye.
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck size={17} aria-hidden /> Local checks · No AI requests
          </p>
        </div>

        <BrowserAuditPanel />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="markup-title" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="markup-title" className="font-display text-xl">
                  Start with your page
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paste HTML, or try a sample to see how it works.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11" onClick={() => sample("good")}>
                  Reference sample
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => sample("flawed")}>
                  Flawed sample
                </Button>
              </div>
            </div>
            <label htmlFor="quality-source" className="mb-2 block text-sm font-medium">
              Page HTML
            </label>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Code2 size={15} aria-hidden /> {label === "Your page" ? "your-page.html" : label}
                </span>
                <span className="font-mono tabular-nums">
                  {source.length.toLocaleString()} characters
                </span>
              </div>
              <textarea
                id="quality-source"
                value={source}
                onChange={(event) => {
                  hasPrivateMarkup.current = event.target.value.length > 0;
                  setSource(event.target.value);
                  setLabel("Your page");
                  setError("");
                }}
                rows={13}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={MAX_SOURCE + 1}
                aria-describedby="quality-source-help"
                aria-invalid={!!error}
                placeholder={
                  '<!doctype html>\n<html lang="en">\n  <head>…</head>\n  <body>\n    <main>Your page goes here.</main>\n  </body>\n</html>'
                }
                className="block min-h-72 w-full resize-y bg-transparent px-4 py-4 font-mono text-xs leading-6 outline-offset-[-3px] sm:text-sm"
              />
            </div>
            <p
              id="quality-source-help"
              className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground"
            >
              Your HTML stays in this browser tab. We do not render it or run its scripts. Resource
              URLs and styling are ignored for this markup-only check.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button className="min-h-12 px-6" onClick={() => inspect()}>
                Check this HTML <ArrowRight aria-hidden />
              </Button>
              {source && (
                <Button
                  variant="ghost"
                  className="min-h-12"
                  onClick={() => {
                    hasPrivateMarkup.current = false;
                    setSource("");
                    setInspection(null);
                    setLabel("Your page");
                    setError("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </section>

          <aside
            className="border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-1"
            aria-labelledby="scope-title"
          >
            <p className="eyebrow mb-4">The North Star kit</p>
            <h2 id="scope-title" className="font-display text-2xl">
              Evidence you can inspect.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Each result names what was checked. No score stands in for someone actually using your
              page.
            </p>
            <ul className="mt-7 space-y-6">
              <li className="flex gap-3">
                <FileCheck2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Measured in markup</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Autoplay attributes, image markup, and leftover placeholder copy.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-medium">A browser comes next</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Contrast, reflow, motion, focus, and keyboard behavior need the rendered page.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <Users className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-medium">People finish the review</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    True content, clear language, and testing with the people the page is for.
                  </p>
                </div>
              </li>
            </ul>
            <Link
              to="/review-room"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4"
            >
              Open the review room <ArrowRight size={16} aria-hidden />
            </Link>
          </aside>
        </div>

        {report && inspection && (
          <section
            ref={resultsRef}
            tabIndex={-1}
            aria-labelledby="quality-results-title"
            className="mt-14 border-t border-border pt-9 outline-none"
          >
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="eyebrow">Your inspection receipt</p>
                <h2 id="quality-results-title" className="mt-3 font-display text-3xl">
                  {fails.length
                    ? `${fails.length} ${fails.length === 1 ? "finding" : "findings"} to work through.`
                    : "No defects found by these static checks."}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {inspection.label} · Static markup only. A result that holds applies only to the
                  specific evidence described.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!!plan?.items.length && (
                  <Button variant="outline" className="min-h-11" onClick={() => void copyRepairs()}>
                    <Clipboard aria-hidden /> Copy repairs
                  </Button>
                )}
                <Button variant="outline" className="min-h-11" onClick={download}>
                  <Download aria-hidden /> Download receipt
                </Button>
              </div>
            </div>
            <p role="status" className="sr-only">
              Inspection complete. {fails.length} findings. {report.couldNotMeasure.length} checks
              could not be measured.
            </p>
            {stale && (
              <div
                role="status"
                className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-4 text-sm"
              >
                <p>The HTML changed. These results describe the previous version.</p>
                <Button variant="outline" className="min-h-11" onClick={() => inspect()}>
                  Check changes <ArrowRight aria-hidden />
                </Button>
              </div>
            )}
            <Tabs value={tab} onValueChange={setTab} className="mt-8">
              <TabsList
                aria-label="Evidence type"
                className="h-auto max-w-full flex-wrap justify-start gap-1 bg-transparent p-0"
              >
                <TabsTrigger
                  value="measured"
                  className="min-h-11 border border-border px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <ListChecks className="mr-2 size-4" aria-hidden /> Measured{" "}
                  <span className="ml-2 tabular-nums">{report.measured.length}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="unmeasured"
                  className="min-h-11 border border-border px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Not measured{" "}
                  <span className="ml-2 tabular-nums">{report.couldNotMeasure.length}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="person"
                  className="min-h-11 border border-border px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Human review{" "}
                  <span className="ml-2 tabular-nums">{report.personChecks.length}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="measured" className="mt-6">
                {measured.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    No markup findings were measurable. See the next two lists for the remaining
                    checks.
                  </p>
                ) : (
                  <ul className="divide-y divide-border border-y border-border">
                    {measured.map((finding, index) => {
                      const raw = inspection.findings.find(
                        (item) =>
                          item.ruleId === finding.ruleId &&
                          (item.where ?? "Page") === finding.where &&
                          item.status === finding.status,
                      );
                      return (
                        <li
                          key={`${finding.ruleId}-${index}`}
                          className="grid gap-3 py-6 sm:grid-cols-[7rem_minmax(0,1fr)]"
                        >
                          <span
                            className={`inline-flex w-fit items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-medium ${finding.status === "fails" ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"}`}
                          >
                            {finding.status === "fails" ? (
                              finding.ruleId.startsWith("tells-") ? (
                                "Review copy"
                              ) : (
                                "Needs a fix"
                              )
                            ) : (
                              <>
                                <Check size={13} aria-hidden /> Holds
                              </>
                            )}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-medium">
                              {ruleNames.get(finding.ruleId) ?? finding.check}
                            </h3>
                            {finding.where && (
                              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                                {finding.where}
                              </p>
                            )}
                            <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="text-xs text-muted-foreground">Found</dt>
                                <dd className="mt-1 break-words">
                                  {finding.value || "See check details"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  Required by this check
                                </dt>
                                <dd className="mt-1 break-words">
                                  {finding.required || "See check details"}
                                </dd>
                              </div>
                            </dl>
                            {finding.status === "fails" && raw?.fix && (
                              <p className="mt-3 text-sm leading-relaxed">
                                <span className="font-medium">Next step: </span>
                                {raw.fix}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="unmeasured" className="mt-6">
                <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Missing evidence stays missing. Run these checks on your rendered page; an HTML
                  snippet cannot answer them.
                </p>
                <ul className="divide-y divide-border border-y border-border">
                  {report.couldNotMeasure.map((finding, index) => (
                    <li key={`${finding.ruleId}-${index}`} className="flex gap-3 py-5">
                      <CircleHelp
                        size={18}
                        className="mt-0.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div>
                        <h3 className="text-sm font-medium">
                          {ruleNames.get(finding.ruleId) ?? finding.check}
                        </h3>
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                          {finding.why}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </TabsContent>
              <TabsContent value="person" className="mt-6">
                <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Use these prompts in a real review. A static check cannot establish that a page
                  works for someone with ADHD, autism, or dyslexia.
                </p>
                <ol className="divide-y divide-border border-y border-border">
                  {report.personChecks.map((question, index) => (
                    <li key={question} className="flex gap-4 py-5">
                      <span className="w-6 shrink-0 font-mono text-xs leading-6 tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="max-w-3xl text-sm leading-relaxed">{question}</p>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>
          </section>
        )}
      </main>
    </div>
  );
}
