/** Actual existing-site ZIP applied to isolated customer fixtures, then completely undone. */
import { launchTestBrowser, browserName } from "./browser-engine.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import JSZip from "jszip";

const target = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const out = `artifacts/existing-site-hardening/${browserName}`;
await mkdir(out, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "focus-existing-customer-"));
const browser = await launchTestBrowser();
const sourceFiles = new Map();
const failures = [];
const scenarios = [];
const pageErrors = [];
const remoteRequests = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(temporary, `.${pathname}`);
    if (!file.startsWith(temporary + sep)) throw new Error("Outside fixture");
    const bytes = await readFile(file);
    response.writeHead(200, {
      "Content-Type": file.endsWith(".css")
        ? "text/css"
        : file.endsWith(".js")
          ? "text/javascript"
          : "text/html",
      "Cache-Control": "no-store",
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;

function customerCss(kind) {
  const legacy = kind.includes("legacy"),
    mixed = kind.includes("mixed");
  const values = legacy
    ? "--background:210 40% 96%;--foreground:222 47% 11%;--primary:210 75% 30%;--primary-foreground:0 0% 100%;--muted:210 40% 92%;--muted-foreground:215 25% 27%;--ring:210 75% 30%;"
    : mixed
      ? "--background:#111827;--foreground:#f8fafc;--primary:#bfdbfe;--primary-foreground:#172554;--muted:#334155;--muted-foreground:#e2e8f0;--ring:#93c5fd;"
      : "--background:#f1f5f9;--foreground:#0f172a;--primary:#134e8c;--primary-foreground:#ffffff;--muted:#e2e8f0;--muted-foreground:#334155;--ring:#134e8c;";
  const v = (name) => (legacy ? `hsl(var(--${name}))` : `var(--${name})`);
  return `:root{${values}--radius:4px}*{box-sizing:border-box}body{margin:0;background:${v("background")};color:${v("foreground")};font:16px/1.6 Arial,sans-serif}header,main,#portal{padding:24px;max-width:900px;margin:auto}main{background:${v("background")};color:${v("foreground")}}h1{font:700 32px/1.2 Arial,sans-serif}form{display:grid;gap:8px;max-width:360px;margin:16px 0}input,button{min-width:0;max-width:100%;font:inherit;min-height:44px;padding:8px 12px}input{color:#111827;background:#ffffff;border:2px solid #64748b}button{border:2px solid #64748b;border-radius:var(--radius);background:#ffffff;color:#111827;white-space:normal}button.sample{background:${v("primary")};color:${v("primary-foreground")}}a{color:inherit}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid ${v("ring")};outline-offset:3px}output{margin-left:12px}#details{margin-top:20px}#muted,#fixed{padding:16px}.muted{background:${v("muted")};color:${v("muted-foreground")}}.fixed-surface{background:#162235;${mixed ? "" : "color:#f8fafc;"}}#portal{background:#e2e8f0;color:#0f172a}#portal button{background:#ffffff;color:#111827}`;
}
const plainMarkup = `<main id="trial"><h1>Customer booking</h1><a href="#details">Details</a><form><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required><button type="submit" class="sample">Book</button></form><p role="status"></p><button id="increment" type="button">Add item</button><output id="count">0</output><section id="details">Original words</section><span data-route>Booking</span><p id="muted" class="muted">Existing muted surface</p><p id="fixed" class="fixed-surface">Existing fixed-color surface</p></main>`;
const portalMarkup = `<p>Existing portal</p><button id="portal-action" type="button">Portal action</button><output id="portal-count">0</output>`;
const html = (reactClient) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Existing customer project</title><link rel="stylesheet" href="./customer.css"></head><body><header id="outside">Customer navigation stays unchanged</header><div id="customer-root">${reactClient ? "" : plainMarkup}</div><aside id="portal">${reactClient ? "" : portalMarkup}</aside><script src="./customer.js"></script></body></html>`;
async function appearance(page) {
  // Compare the same unfocused state; keyboard focus is checked during each task.
  await page.evaluate(() => document.activeElement?.blur());
  return page.evaluate(() =>
    Object.fromEntries(
      [
        "body",
        "#trial",
        "h1",
        "#email",
        ".sample",
        "#outside",
        "#portal",
        "#portal-action",
        "#muted",
        "#fixed",
      ].map((selector) => {
        const element = document.querySelector(selector),
          s = getComputedStyle(element);
        return [
          selector,
          {
            background: s.backgroundColor,
            color: s.color,
            font: s.fontFamily,
            radius: s.borderRadius,
            outline: s.outlineColor,
            display: s.display,
          },
        ];
      }),
    ),
  );
}
async function inventory(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("a,form,input,button,#details")].map((e) => ({
      tag: e.tagName,
      id: e.id,
      href: e.getAttribute("href"),
      action: e.getAttribute("action"),
      name: e.getAttribute("name"),
      type: e.getAttribute("type"),
      required: e.hasAttribute("required"),
      text: e.textContent,
    })),
  );
}
function contrast(a, b) {
  const lum = (rgb) => {
    const c = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((n) => {
        const v = n / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
async function task(page, expectedCount) {
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const previousStatus = await page.locator('p[role="status"]').innerText();
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Book", exact: true }).click();
  assert.equal(await email.evaluate((e) => e.validity.typeMismatch), true);
  assert.equal(await page.locator('p[role="status"]').innerText(), previousStatus);
  const value = `visitor${expectedCount}@example.test`;
  await email.fill(value);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Book");
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle),
    "none",
  );
  await page.keyboard.press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: `Booked ${value}` })
    .waitFor();
  await page.getByRole("button", { name: "Add item", exact: true }).focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#count").innerText(), String(expectedCount));
  await page.getByRole("link", { name: "Details", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => location.hash), "#details");
  assert.equal(await page.locator("[data-route]").innerText(), "Details");
  await page.getByRole("button", { name: "Portal action", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#portal-count").innerText(), String(expectedCount));
  assert.equal(await email.inputValue(), value);
}
try {
  // Download from the real Focus interaction, including switching to existing mode.
  const source = await browser.newPage({ acceptDownloads: true });
  source.on("pageerror", (error) => pageErrors.push(error.message));
  await source.goto(target, { waitUntil: "networkidle" });
  const directions = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
  const tokens = directions.find((d) => d.id === "garden-ledger").direction.tokens;
  await source.evaluate(
    (tokens) =>
      localStorage.setItem(
        "refraction:v1",
        JSON.stringify({
          version: 2,
          stage: "rx",
          brief: "An existing booking application",
          content: {
            brand: "Existing booking",
            headline: "Keep customer work",
            sub: "Synthetic transfer fixture",
            cta: "Book",
            features: [],
            quote: "",
          },
          tokens,
          direction: "Garden Ledger",
          libraryId: "existing-transfer-fixture",
          quick: true,
          picks: [],
          history: [],
          directions: [],
          stepIndex: 3,
        }),
      ),
    tokens,
  );
  await source.reload({ waitUntil: "networkidle" });
  await source.getByRole("button", { name: /Design specification.*handoff tools/ }).click();
  await source.getByRole("radio", { name: /Restyle my existing site or app/ }).check();
  const download = source.waitForEvent("download");
  await source.getByRole("button", { name: "Download existing-site pack", exact: true }).click();
  const zipBytes = await readFile(await (await download).path());
  const zip = await JSZip.loadAsync(zipBytes, { checkCRC32: true });
  await writeFile(`${out}/actual-existing-site-pack.zip`, zipBytes);
  assert.ok(zip.file("focus-restyle/START-HERE.md"));
  assert.ok(zip.file("focus-restyle/UNDO.md"));
  const originalSentinels = {
    "AGENTS.md": "Customer rules must survive.\n",
    "package.json": '{"name":"existing-customer-project","private":true}\n',
    "tokens.css": ":root{--customer-original:1}\n",
    "customer-data.json": '{"draft":"Keep this uncommitted customer work"}\n',
  };
  for (const [name, value] of Object.entries(originalSentinels)) {
    await writeFile(join(temporary, name), value);
    sourceFiles.set(name, hash(value));
  }
  await mkdir(join(temporary, "focus-restyle"));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    assert.match(name, /^focus-restyle\/[A-Za-z0-9_.-]+$/);
    assert.ok(
      !["AGENTS.md", ".cursorrules", ".windsurfrules", "tokens.css", "tailwind-theme.css"].includes(
        name.split("/")[1],
      ),
    );
    await writeFile(join(temporary, name), await entry.async("nodebuffer"));
  }
  await assert.rejects(mkdir(join(temporary, "focus-restyle")), { code: "EEXIST" });
  const built = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    define: { "process.env.NODE_ENV": '"production"' },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: fileURLToPath(new URL("./fixtures/existing-customer-react.tsx", import.meta.url)),
        name: "CustomerFixture",
        formats: ["iife"],
      },
    },
  });
  const reactJs = (Array.isArray(built) ? built[0] : built).output.find(
    (entry) => entry.type === "chunk",
  ).code;
  const plainJs = await readFile("scripts/fixtures/existing-customer-plain.js", "utf8");
  for (const kind of [
    "plain-modern",
    "plain-legacy",
    "react-modern",
    "react-legacy",
    "plain-mixed",
    "react-mixed",
  ]) {
    await mkdir(join(temporary, kind));
    for (const [name, value] of Object.entries({
      "index.html": html(kind.startsWith("react")),
      "customer.css": customerCss(kind),
      "customer.js": kind.startsWith("react") ? reactJs : plainJs,
    })) {
      const path = `${kind}/${name}`;
      await writeFile(join(temporary, path), value);
      sourceFiles.set(path, hash(value));
    }
    for (const width of [1280, 768, 320]) {
      const label = `${kind}-${width}`;
      const issues = [];
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on("pageerror", (error) => pageErrors.push(`${label}: ${error.message}`));
      await page.route("**/*", (route) => {
        if (
          route
            .request()
            .url()
            .startsWith(origin + "/")
        )
          return route.continue();
        remoteRequests.push(route.request().url());
        return route.abort();
      });
      try {
        await page.goto(`${origin}/${kind}/index.html`, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Customer booking" }).waitFor();
        const before = await appearance(page);
        const controls = await inventory(page);
        await task(page, 1);
        await page.screenshot({ path: `${out}/${label}-before.png`, fullPage: true });
        await page.evaluate((legacy) => {
          for (const file of [
            "focus-tokens.css",
            legacy ? "focus-bridge-legacy.css" : "focus-bridge.css",
          ]) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = `/focus-restyle/${file}`;
            link.dataset.focusTestImport = "";
            document.head.append(link);
          }
        }, kind.includes("legacy"));
        await page.waitForFunction(() =>
          [...document.querySelectorAll("link[data-focus-test-import]")].every(
            (link) => link.sheet,
          ),
        );
        assert.deepEqual(
          await appearance(page),
          before,
          "Importing without opt-in must not change customer styles.",
        );
        await page
          .locator("#trial")
          .evaluate((element) => element.setAttribute("data-focus-restyle", ""));
        assert.deepEqual(
          await appearance(page),
          before,
          "The default Focus wrapper must only expose values, including on fixed-color descendants.",
        );
        const semanticCompatible = !kind.includes("mixed");
        if (semanticCompatible) {
          await page
            .locator("#trial")
            .evaluate((element) => element.setAttribute("data-focus-theme", "semantic"));
        }
        const after = await appearance(page);
        if (semanticCompatible) {
          assert.notEqual(
            after[".sample"].background,
            before[".sample"].background,
            "An explicitly compatible semantic trial must apply the delivered palette.",
          );
          assert.notEqual(after["#trial"].background, before["#trial"].background);
        }
        for (const outside of ["body", "#outside", "#portal", "#portal-action"])
          assert.deepEqual(after[outside], before[outside], `Scope leaked to ${outside}`);
        const pairs = {};
        for (const selector of ["#trial", ".sample", "#muted", "#fixed"]) {
          const baseline = contrast(before[selector].color, before[selector].background),
            applied = contrast(after[selector].color, after[selector].background);
          pairs[selector] = { baseline, applied };
          if (applied < 4.5 && applied < baseline - 0.05)
            issues.push(
              `${selector} text contrast regressed from ${baseline.toFixed(2)} to ${applied.toFixed(2)}`,
            );
        }
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
          issues.push("Restyle caused horizontal overflow");
        await task(page, 2);
        assert.deepEqual(await inventory(page), controls);
        await page.screenshot({ path: `${out}/${label}-trial.png`, fullPage: true });
        await page
          .locator("#trial")
          .evaluate((element) => element.removeAttribute("data-focus-restyle"));
        assert.deepEqual(
          await appearance(page),
          before,
          "Removing the opt-in attribute must restore all original styles.",
        );
        await task(page, 3);
        await page
          .locator("#trial")
          .evaluate((element) => element.removeAttribute("data-focus-theme"));
        await page
          .locator("link[data-focus-test-import]")
          .evaluateAll((links) => links.forEach((link) => link.remove()));
        assert.deepEqual(
          await appearance(page),
          before,
          "Removing imports must restore original styles.",
        );
        await task(page, 4);
        assert.deepEqual(await inventory(page), controls);
        await page.screenshot({ path: `${out}/${label}-undo.png`, fullPage: true });
        scenarios.push({
          label,
          status: issues.length ? "failed" : "passed",
          importBeforeOptInInert: true,
          defaultWrapperInert: true,
          semanticTrial: semanticCompatible
            ? "Explicitly enabled on audited paired-color runtime consumers"
            : "Not enabled: mixed fixed-color descendants require component review",
          appliedDeliveredPalette: semanticCompatible,
          externalScopeUnchanged: true,
          formValidationAndSubmission: true,
          keyboardAndClientRoute: true,
          controlledStateAndPortalPreserved: true,
          exactStyleRollback: true,
          markupInventoryUnchanged: true,
          contrast: pairs,
          issues,
        });
      } catch (error) {
        issues.push(error.message);
        scenarios.push({ label, status: "failed", issues });
      }
      if (issues.length) failures.push({ label, issues });
      await page.close();
    }
  }
  for (const [name, sha] of sourceFiles)
    assert.equal(
      hash(await readFile(join(temporary, name))),
      sha,
      `Customer source was changed: ${name}`,
    );
  const report = {
    at: new Date().toISOString(),
    target,
    browser: browserName,
    status: failures.length || pageErrors.length || remoteRequests.length ? "failed" : "passed",
    actualUiZip: true,
    archiveSha256: hash(zipBytes),
    sourceFilesByteIdentical: sourceFiles.size,
    collisionRefusedBeforeWrites: true,
    scenarios,
    failures,
    pageErrors,
    remoteRequests,
    limits: [
      "Synthetic plain HTML and React19 task fixtures; no real customer project, auth, API, database or analytics integration.",
      "Fixture routing uses an actual anchor and React/local route state; it is not a complete framework router certification.",
      "Fonts are not fetched; customer controls use local fallbacks. No public deployment or screen-reader study.",
      "Source-file nonmutation is verified for extraction and runtime CSS trial. Human or AI component edits need separate review and rollback.",
      "The paired semantic bridge is not applied to mixed fixed-color fixtures. Their inherited-color regression is preserved in BASELINE-RESULTS.json; default opt-in must remain inert.",
    ],
  };
  await writeFile(`${out}/RESULTS.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
  await rm(temporary, { recursive: true, force: true });
}
