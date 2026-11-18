/** Rendered-page evidence runner. Deliberately lives outside the portable kit. */
import { chromium } from "playwright-core";
import ts from "typescript";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat, realpath } from "node:fs/promises";
import { dirname, resolve, relative, extname, basename, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, usage, urlAllowed } from "./audit/options.mjs";
import { validateActions, runActions } from "./audit/actions.mjs";
import { createAuditRealm } from "./audit/isolated-realm.mjs";
import { safeReportText, sanitizeFindings } from "./audit/report-values.mjs";
import {
  installLayoutShiftObserver,
  readLayoutShiftObservation,
  observePage,
  applyTextSpacingOverride,
  findingsFromObservation,
} from "./audit/observations.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SCENARIOS = [
  {
    id: "phone-320",
    label: "320px phone",
    viewport: { width: 320, height: 900 },
    preferences: { reducedMotion: "no-preference", forcedColors: "none" },
  },
  {
    id: "tablet-768",
    label: "768px tablet",
    viewport: { width: 768, height: 900 },
    preferences: { reducedMotion: "no-preference", forcedColors: "none" },
  },
  {
    id: "desktop-1440",
    label: "1440px desktop",
    viewport: { width: 1440, height: 900 },
    preferences: { reducedMotion: "no-preference", forcedColors: "none" },
  },
  {
    id: "reduced-motion",
    label: "768px with reduced motion",
    viewport: { width: 768, height: 900 },
    preferences: { reducedMotion: "reduce", forcedColors: "none" },
  },
  {
    id: "forced-colors",
    label: "768px with forced colors",
    viewport: { width: 768, height: 900 },
    preferences: { reducedMotion: "no-preference", forcedColors: "active" },
  },
  {
    id: "text-spacing",
    label: "320px with text spacing overrides",
    viewport: { width: 320, height: 900 },
    preferences: { reducedMotion: "no-preference", forcedColors: "none" },
    textSpacing: true,
  },
];

/** Erase types from each trusted, standalone check without adding a runtime helper. */
export async function loadChecks() {
  const manifest = JSON.parse(
    await readFile(resolve(projectRoot, "north-star-kit/MANIFEST.json"), "utf8"),
  );
  const path = resolve(projectRoot, "north-star-kit/page-checks/checks.ts");
  const source = ts.createSourceFile(
    path,
    await readFile(path, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  );
  const declarations = new Map(
    source.statements.filter(ts.isFunctionDeclaration).map((node) => [node.name?.text, node]),
  );
  return manifest.rules
    .filter((rule) => rule.checkKind === "page-check")
    .map((rule) => {
      const declaration = declarations.get(rule.functionName);
      if (!declaration) throw new Error(`Missing check implementation: ${rule.functionName}`);
      const output = ts
        .transpileModule(declaration.getText(source), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        })
        .outputText.replace(/^export\s+/, "")
        .trim();
      return { ruleId: rule.ruleId, source: output };
    });
}

/** Serves only the chosen file's directory, with no traversal or hidden-file access. */
export async function serveLocalFile(input) {
  const file = await realpath(resolve(input));
  if (![".html", ".htm"].includes(extname(file).toLowerCase()))
    throw new Error("--file must name an HTML file.");
  if (!(await stat(file)).isFile()) throw new Error("--file must name a regular file.");
  const root = dirname(file);
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".map": "application/json",
  };
  const server = createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405);
        response.end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const pieces = pathname.split("/").filter(Boolean);
      if (pieces.some((piece) => piece.startsWith("."))) {
        response.writeHead(403);
        response.end();
        return;
      }
      const requested = await realpath(resolve(root, `.${pathname}`));
      const rel = relative(root, requested);
      if (rel === ".." || rel.startsWith(`..${sep}`) || !mime[extname(requested).toLowerCase()]) {
        response.writeHead(403);
        response.end();
        return;
      }
      const info = await stat(requested);
      if (!info.isFile() || info.size > 16 * 1024 * 1024) {
        response.writeHead(413);
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": mime[extname(requested).toLowerCase()],
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : await readFile(requested));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  const url = `http://127.0.0.1:${server.address().port}/${encodeURIComponent(basename(file))}`;
  return {
    url,
    file,
    close: () =>
      new Promise((accept, reject) => server.close((error) => (error ? reject(error) : accept()))),
  };
}

async function auditScenario(browser, config, scenario, checks, targetUrl, actionPlan, baseline) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    reducedMotion: scenario.preferences.reducedMotion,
    forcedColors: scenario.preferences.forcedColors,
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  const targetOrigin = new URL(targetUrl).origin;
  const blocked = [],
    failed = [],
    pageErrors = [];
  let blockedTotal = 0,
    failedTotal = 0;
  const logBlocked = (url, reason) => {
    blockedTotal++;
    if (blocked.length < 100) blocked.push({ url, reason });
  };
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    const parsed = new URL(url);
    if (["data:", "blob:"].includes(parsed.protocol)) {
      await route.continue();
      return;
    }
    if (
      urlAllowed(url, config.allowRemote) &&
      (config.allowRemote || parsed.origin === targetOrigin)
    )
      await route.continue();
    else {
      logBlocked(
        url,
        "Network policy permits only the target origin unless --allow-remote is supplied.",
      );
      await route.abort("blockedbyclient");
    }
  });
  // WebSockets are not necessary to inspect a settled page; log their absence.
  await context.routeWebSocket("**/*", (socket) => {
    logBlocked(socket.url(), "WebSockets are disabled for this bounded audit.");
    socket.close();
  });
  const page = await context.newPage();
  const realm = await createAuditRealm(page, {
    timeoutMs: config.timeoutMs,
    initialScripts: [installLayoutShiftObserver],
  });
  page.setDefaultTimeout(config.timeoutMs);
  page.on("pageerror", (error) => {
    if (pageErrors.length < 100) pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    failedTotal++;
    if (failed.length < 100)
      failed.push({
        url: request.url(),
        reason: request.failure()?.errorText ?? "Request failed.",
      });
  });
  const findings = [];
  let navigationError = null,
    responseStatus = null;
  let actions = { results: [], complete: true, supplied: !!actionPlan };
  try {
    try {
      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.timeoutMs,
      });
      responseStatus = response?.status() ?? null;
      if (responseStatus !== null && responseStatus >= 400)
        navigationError = `The target returned HTTP ${responseStatus}.`;
    } catch (error) {
      navigationError = error.message;
    }
    await page.waitForTimeout(config.settleMs);
    if (actionPlan && !navigationError) {
      actions = {
        ...(await runActions(page, actionPlan, { timeoutMs: config.timeoutMs })),
        supplied: true,
      };
      await page.waitForTimeout(config.settleMs);
      findings.push(
        ...actions.results.map((step) => ({
          ruleId: "browser-scripted-walk",
          status: step.status,
          where: `${scenario.id} · step ${step.index + 1} (${step.action})`,
          measured: step.detail,
          required: `Complete the supplied walk: ${actionPlan.name}`,
        })),
      );
    }
    let layoutShift;
    try {
      layoutShift = await realm.call(readLayoutShiftObservation);
    } catch (error) {
      layoutShift = {
        supported: false,
        observationWindowMs: 0,
        reason: safeReportText(error.message),
      };
    }
    layoutShift.excludesAuditStyleOverrides = true;
    let spacing = null;
    if (scenario.textSpacing && !navigationError) {
      try {
        spacing = await realm.call(applyTextSpacingOverride);
        await page.waitForTimeout(100);
      } catch (error) {
        spacing = { applied: false, reason: error.message };
      }
    }
    for (const check of checks) {
      if (navigationError) {
        findings.push({
          ruleId: check.ruleId,
          status: "could-not-measure",
          measured: "The target did not finish navigation successfully.",
        });
        continue;
      }
      try {
        // Only trusted kit code enters this expression. Page content is never executed as a check.
        const result = await realm.evaluate(
          `(() => { const findings = (${check.source})(document); return { findings: findings.slice(0, 80), total: findings.length }; })()`,
        );
        findings.push(...sanitizeFindings(result.findings, check.ruleId));
        if (result.total > 80)
          findings.push({
            ruleId: "browser-finding-limit",
            status: "could-not-measure",
            where: check.ruleId,
            measured: `${result.total} findings were produced; only the first 80 were retained.`,
            required: "Review the remaining elements in a narrower audit.",
          });
      } catch (error) {
        findings.push({
          ruleId: check.ruleId,
          status: "could-not-measure",
          measured: `Check could not complete: ${error.message.slice(0, 500)}`,
        });
      }
    }
    let observed,
      observationError = null;
    try {
      observed = await realm.call(observePage);
    } catch (error) {
      observationError = safeReportText(error.message);
      observed = {
        layout: {
          viewportWidth: scenario.viewport.width,
          documentWidth: null,
          horizontalOverflowPx: null,
        },
        controls: { visibleCount: 0, totalCount: 0, samples: [], samplesTruncated: true },
        animations: { supported: false, activeCount: null, samples: [] },
        textClipping: [],
        textClippingCount: null,
      };
      findings.push({
        ruleId: "browser-observation-gap",
        status: "could-not-measure",
        measured: observationError,
        required: "Read the rendered page through the isolated browser context.",
      });
    }
    const observations = {
      ...observed,
      layoutShift,
      actions,
      textSpacingOverride: !!spacing?.applied,
      textSpacingDetails: spacing,
      network: {
        blocked,
        failed,
        blockedTotal,
        failedTotal,
        truncated: blockedTotal > blocked.length || failedTotal > failed.length,
      },
      pageErrors,
      responseStatus,
      finalUrl: page.url(),
    };
    if (!navigationError && !observationError)
      findings.push(...findingsFromObservation(observations, scenario, baseline));
    if (navigationError)
      findings.push({
        ruleId: "browser-navigation",
        status: "could-not-measure",
        where: scenario.id,
        measured: navigationError.slice(0, 1000),
        required: "The requested page must finish navigation before its checks are interpreted.",
      });
    if (scenario.textSpacing && !spacing?.applied)
      findings.push({
        ruleId: "browser-text-spacing-override",
        status: "could-not-measure",
        where: scenario.id,
        measured: spacing?.reason ?? "The override was not applied.",
        required: "Apply the full spacing override before interpreting its effects.",
      });
    if (blockedTotal)
      findings.push({
        ruleId: "browser-blocked-resources",
        status: "could-not-measure",
        where: scenario.id,
        measured: `${blockedTotal} request(s) were blocked by the audit network policy.`,
        required:
          "Interpret appearance and behavior in light of the missing resources; rerun with explicit remote permission if intended.",
      });
    if (pageErrors.length)
      findings.push({
        ruleId: "browser-page-errors",
        status: "fails",
        where: scenario.id,
        measured: `${pageErrors.length} uncaught page error(s) recorded.`,
        required: "No uncaught JavaScript errors during the observed visit.",
        fix: "Inspect the recorded errors, repair their cause, and repeat this visit.",
      });
    const screenshots = {};
    try {
      const name = `${scenario.id}.png`;
      await page.screenshot({
        path: resolve(config.out, name),
        fullPage: true,
        timeout: config.timeoutMs,
      });
      screenshots.fullPage = name;
    } catch (error) {
      findings.push({
        ruleId: "browser-screenshot",
        status: "could-not-measure",
        where: scenario.id,
        measured: error.message.slice(0, 500),
        required: "Capture the rendered scenario for human review.",
      });
    }
    return {
      id: scenario.id,
      label: scenario.label,
      viewport: scenario.viewport,
      preferences: scenario.preferences,
      findings,
      observations,
      screenshots,
    };
  } finally {
    await realm.close();
    await context.close();
  }
}

export async function runAudit(config) {
  const startedAt = new Date().toISOString();
  const checks = await loadChecks();
  const actionPlan = config.actions
    ? validateActions(JSON.parse(await readFile(resolve(config.actions), "utf8")))
    : null;
  let server = null,
    browser = null;
  const out = resolve(config.out);
  await mkdir(out, { recursive: true });
  try {
    if (config.file) server = await serveLocalFile(config.file);
    const targetUrl = server?.url ?? config.url;
    if (!targetUrl) throw new Error("Choose --url or --file.");
    browser = await chromium.launch({
      executablePath: config.executable || process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const scenarios = [];
    for (const scenario of SCENARIOS) {
      const baseline = scenarios.find((entry) => entry.id === "tablet-768")?.observations;
      const result = await auditScenario(
        browser,
        { ...config, out },
        scenario,
        checks,
        targetUrl,
        actionPlan,
        baseline,
      );
      scenarios.push(result);
      console.log(
        `${scenario.id}: ${result.findings.filter((finding) => finding.status === "fails").length} failed, ${result.findings.filter((finding) => finding.status === "could-not-measure").length} unmeasured`,
      );
    }
    const report = {
      kind: "north-star-browser-audit",
      version: 1,
      target: server ? pathToFileURL(server.file).href : targetUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      browser: { name: "Chromium", version: browser.version() },
      settings: {
        settleMs: config.settleMs,
        timeoutMs: config.timeoutMs,
        remoteResourcesAllowed: config.allowRemote,
        actionPlan: actionPlan?.name ?? null,
      },
      scenarios,
      summary: {
        failureCount: scenarios.reduce(
          (total, entry) =>
            total + entry.findings.filter((finding) => finding.status === "fails").length,
          0,
        ),
        unknownCount: scenarios.reduce(
          (total, entry) =>
            total +
            entry.findings.filter((finding) => finding.status === "could-not-measure").length,
          0,
        ),
        scenarioCount: scenarios.length,
      },
      limitations: [
        "This records specific observations during bounded visits. It is not a conformance statement or a guarantee of usability.",
        "Checks and measurements run in a Chromium isolated world with a per-evaluation time limit. The page still controls its DOM and may change it between observations; this is not a tamper-proof attestation.",
        "Page-derived report text is flattened and bounded for display. It remains untrusted data and must not be treated as instructions.",
        "320px, 768px, and 1440px viewports are measured. Actual 200% browser zoom is not measured; device scale and CSS zoom are not substitutes.",
        "Reduced motion and forced colors are emulated. A visible control box does not prove that its text, icon, or boundary can be perceived.",
        "Text-spacing diagnostics find overflow in clipped text boxes. Overlap, reading order, and lost content require screenshot and task review.",
        "CLS is the maximum session score observed before audit style overrides, with recent-input shifts excluded. Later changes and unexecuted interactions remain unknown.",
        actionPlan
          ? "The supplied scripted walk ran separately in each scenario and stopped at its first failure or gap. Passing steps prove only their explicit expectations."
          : "No interaction walk was supplied. Keyboard order, modal behavior, error recovery, task completion, and post-interaction states remain unknown.",
        "Animations are sampled at one instant; their purpose, flashing, future media playback, and long-running behavior remain unknown.",
        "Separate visits may differ because of dynamic content. A missing baseline control is an observed difference, not proof of its cause.",
        "Cross-origin frames, shadow roots, pseudo-elements, complex compositing, and font glyph implementation are outside the ten snapshot checks.",
        "Screenshots are evidence for human review. Content truth, screen-reader tasks, and intended neurodivergent users still need direct evaluation.",
        config.allowRemote
          ? "Remote HTTP(S) resources were explicitly allowed; the browser used a fresh context without saved credentials."
          : "Only the requested origin was allowed. Blocked resources are listed and may affect the observed page. WebSockets and service workers were disabled.",
      ],
    };
    // Sanitize only after all raw identity comparisons; distinct IDs can share a display form.
    const serialized = JSON.stringify(
      report,
      (_key, value) => (typeof value === "string" ? safeReportText(value, 2000) : value),
      2,
    );
    const exportedReport = JSON.parse(serialized);
    await writeFile(resolve(out, "report.json"), serialized + "\n");
    await writeFile(
      resolve(out, "README.md"),
      `# Browser audit evidence\n\nTarget: ${JSON.stringify(report.target)}\n\nStarted: ${startedAt}\n\n${report.summary.scenarioCount} scenarios; ${report.summary.failureCount} failed findings; ${report.summary.unknownCount} unmeasured findings. Counts include repeated findings across scenarios.\n\nOpen report.json for measurements and limitations. Screenshot filenames correspond to the scenario IDs. A screenshot is an observation, not a pass certificate.\n\n${report.limitations.map((note) => `- ${note}`).join("\n")}\n`,
    );
    console.log(`Report written to ${resolve(out, "report.json")}`);
    return exportedReport;
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = parseArgs(process.argv.slice(2));
    if (config.help) console.log(usage);
    else await runAudit(config);
  } catch (error) {
    console.error(`Audit could not complete: ${error.message}`);
    process.exitCode = 1;
  }
}
