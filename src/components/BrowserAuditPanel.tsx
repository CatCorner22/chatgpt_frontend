import { useMemo, useRef, useState } from "react";
import { ChevronDown, FileJson, Monitor, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  auditCounts,
  auditScreenshotName,
  MAX_BROWSER_AUDIT_BYTES,
  parseBrowserAudit,
  type BrowserAudit,
} from "@/lib/browser-audit";
import { allRules } from "../../north-star-kit/data/rules";

const ruleNames = new Map(allRules.map((rule) => [rule.id, rule.plain]));
const STATUS = {
  fails: "Needs attention",
  holds: "Holds in this observation",
  "could-not-measure": "Not measured",
  "not-applicable": "Not applicable",
} as const;
const RUN_COMMAND =
  "node scripts/north-star-audit.mjs --url http://localhost:3000 --out artifacts/north-star-audit";

export function BrowserAuditPanel() {
  const [report, setReport] = useState<BrowserAudit | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [scenarioId, setScenarioId] = useState("");
  const [filter, setFilter] = useState("attention");
  const [limit, setLimit] = useState(100);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const scenario = report?.scenarios.find((item) => item.id === scenarioId);
  const findings = useMemo(() => {
    const selected = (scenario?.findings ?? []).filter(
      (finding) =>
        filter === "all" || finding.status === "fails" || finding.status === "could-not-measure",
    );
    const order = { fails: 0, "could-not-measure": 1, holds: 2, "not-applicable": 3 };
    return [...selected].sort((a, b) => order[a.status] - order[b.status]);
  }, [scenario, filter]);

  const read = async (file: File) => {
    const id = ++requestId.current;
    setError("");
    setReport(null);
    setFileName("");
    setReading(false);
    if (file.size > MAX_BROWSER_AUDIT_BYTES) {
      setError("Choose a browser audit JSON file smaller than 5 MB.");
      return;
    }
    setReading(true);
    try {
      const next = parseBrowserAudit(await file.text());
      if (id !== requestId.current) return;
      setReport(next);
      setFileName(file.name);
      setScenarioId(next.scenarios[0]!.id);
      setFilter("attention");
      setLimit(100);
    } catch (cause) {
      if (id === requestId.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The browser could not read this file. Choose a local JSON receipt and try again.",
        );
    } finally {
      if (id === requestId.current) setReading(false);
    }
  };

  const clear = () => {
    requestId.current++;
    setReading(false);
    setReport(null);
    setFileName("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section aria-labelledby="browser-audit-title" className="mb-10 border-b border-border pb-10">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex max-w-2xl items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
            <Monitor size={20} aria-hidden />
          </div>
          <div>
            <h2 id="browser-audit-title" className="font-display text-xl">
              Bring your browser audit into the review.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Open a receipt from the North Star browser runner to compare screen sizes, motion
              preferences, and rendered-page findings.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Browser audit JSON file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void read(file);
              event.target.value = "";
            }}
          />
          <Button
            variant="outline"
            className="min-h-11"
            disabled={reading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden />
            {reading ? "Reading receipt…" : "Import browser receipt"}
          </Button>
          {(report || reading) && (
            <Button variant="ghost" className="min-h-11" onClick={clear}>
              <X aria-hidden /> Remove receipt
            </Button>
          )}
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-muted-foreground hover:text-foreground">
          <ChevronDown size={14} aria-hidden /> How to create a browser receipt
        </summary>
        <div className="mt-1 max-w-3xl border-l-2 border-border pl-4">
          <p className="leading-relaxed text-muted-foreground">
            Start your app, then run this command from the project folder with Playwright and
            Chromium installed. Change the local address if your app uses a different port.
          </p>
          <pre className="my-3 whitespace-pre-wrap break-all rounded-md border border-border bg-card p-4 text-xs leading-6">
            <code>{RUN_COMMAND}</code>
          </pre>
          <p className="leading-relaxed text-muted-foreground">
            Choose <code className="text-xs">report.json</code> from the output folder. Keep the
            screenshots alongside it for visual review. Importing reads the local file only; it
            never visits the reported address or loads screenshot paths.
          </p>
        </div>
      </details>
      {error && (
        <p role="alert" className="mt-3 max-w-3xl text-sm text-destructive">
          {error}
        </p>
      )}
      {report && (
        <div className="mt-7">
          <div className="border-t border-border pt-6">
            <p className="eyebrow flex items-center gap-2">
              <FileJson size={14} aria-hidden /> Imported browser observations
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h3 className="break-all font-mono text-sm">{report.target}</h3>
                <p className="mt-2 break-all text-xs leading-relaxed text-muted-foreground">
                  {fileName} · Reported start:{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/New_York",
                  }).format(new Date(report.startedAt))}{" "}
                  Eastern
                </p>
              </div>
              <p role="status" className="text-sm tabular-nums">
                {report.summary.scenarioCount}{" "}
                {report.summary.scenarioCount === 1 ? "scenario" : "scenarios"} ·{" "}
                {report.summary.failureCount}{" "}
                {report.summary.failureCount === 1 ? "finding needs" : "findings need"} attention ·{" "}
                {report.summary.unknownCount} not measured
              </p>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              This is evidence supplied by the file’s author. Focus has checked the file format and
              recalculated the counts; it has not independently rerun the audit or confirmed the
              reported address.
            </p>
          </div>

          <div
            className="mt-6 overflow-x-auto rounded-lg border border-border"
            tabIndex={0}
            role="region"
            aria-label="Browser audit scenario comparison"
          >
            <table className="w-full min-w-[660px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Choose a scenario to inspect its findings. Counts come from the imported findings.
                Screenshot filenames are displayed without loading the images.
              </caption>
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Scenario
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Viewport
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Needs attention
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Not measured
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Reported screenshot
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.scenarios.map((item) => {
                  const counts = auditCounts(item.findings);
                  const selected = item.id === scenarioId;
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-border ${selected ? "bg-secondary/50" : "bg-card"}`}
                    >
                      <th scope="row" className="max-w-64 px-4 py-2 font-normal">
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setScenarioId(item.id);
                            setLimit(100);
                          }}
                          className={`min-h-11 text-left ${selected ? "font-medium underline underline-offset-4" : "hover:underline"}`}
                        >
                          {item.label}
                        </button>
                        <p className="pb-2 text-xs text-muted-foreground">
                          {[
                            item.preferences.reducedMotion === "reduce" && "Reduced motion",
                            item.preferences.forcedColors === "active" && "Forced colors",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Default preferences"}
                        </p>
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums">
                        {item.viewport.width} × {item.viewport.height}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{counts.failureCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{counts.unknownCount}</td>
                      <td className="max-w-56 break-all px-4 py-3 text-xs text-muted-foreground">
                        {auditScreenshotName(item.screenshots.fullPage)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {scenario && (
            <div className="mt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl">{scenario.label}: findings</h3>
                <div className="flex w-full flex-wrap items-center gap-2 text-sm sm:w-auto">
                  <label htmlFor="browser-audit-filter">Show</label>
                  <select
                    id="browser-audit-filter"
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setLimit(100);
                    }}
                    className="min-h-11 min-w-0 max-w-full rounded-md border border-border bg-card px-3"
                  >
                    <option value="attention">Needs attention and not measured</option>
                    <option value="all">All findings</option>
                  </select>
                </div>
              </div>
              {findings.length === 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  This view has no findings. Review all observations and the report’s limits before
                  drawing a conclusion about this page.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {findings.slice(0, limit).map((finding, index) => (
                    <li
                      key={`${finding.ruleId}-${index}`}
                      className="grid gap-3 py-5 md:grid-cols-[10rem_minmax(0,1fr)]"
                    >
                      <p
                        className={`text-xs leading-6 ${finding.status === "fails" ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {STATUS[finding.status]}
                      </p>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium">
                          {ruleNames.get(finding.ruleId) ?? finding.ruleId.replace(/-/g, " ")}
                        </h4>
                        {finding.where && (
                          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                            {finding.where}
                          </p>
                        )}
                        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-muted-foreground">Reported observation</dt>
                            <dd className="mt-1 break-words leading-relaxed">
                              {finding.measured || "No measurement was supplied."}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              Required by this check
                            </dt>
                            <dd className="mt-1 break-words leading-relaxed">
                              {finding.required || "See the rule or review the rendered page."}
                            </dd>
                          </div>
                        </dl>
                        {finding.fix && (
                          <p className="mt-3 break-words text-sm leading-relaxed">
                            <span className="font-medium">Next step: </span>
                            {finding.fix}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {findings.length > limit && (
                <Button
                  variant="outline"
                  className="mt-4 min-h-11"
                  onClick={() => setLimit((current) => current + 100)}
                >
                  Show next {Math.min(100, findings.length - limit)} findings
                </Button>
              )}
            </div>
          )}

          <details className="mt-6 rounded-lg border border-border p-4" open>
            <summary className="min-h-8 cursor-pointer text-sm font-medium">
              Limits reported by the audit author
            </summary>
            {report.limitations.length ? (
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {report.limitations.map((limitation, index) => (
                  <li key={index} className="break-words">
                    {limitation}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                The file supplied no limitations. That does not establish complete coverage. Review
                keyboard tasks, screen-reader use, content truth, and the intended users’ experience
                separately.
              </p>
            )}
          </details>
        </div>
      )}
    </section>
  );
}
