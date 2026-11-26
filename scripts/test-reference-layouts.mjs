/** Reproduce the Showcase/Journal browser stress matrix without running the app.
 * Uses existing dependencies. Set CHROMIUM_PATH when Chromium is not /usr/bin/chromium.
 * Results and screenshots are written to artifacts/reference-layouts/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { rolldown } from "rolldown";
import { createServer } from "node:http";
import { launchChromium } from "./browser-engine.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = join(root, "artifacts/reference-layouts");
mkdirSync(artifactDir, { recursive: true });
const compiled = await mkdtemp(join(tmpdir(), "focus-reference-layouts-"));
let browser;
let server;
try {
  const bundle = await rolldown({
    input: {
      authored: join(root, "src/lib/authored-page.ts"),
      design: join(root, "src/lib/design.ts"),
    },
    platform: "node",
  });
  try {
    await bundle.write({
      dir: compiled,
      format: "esm",
      entryFileNames: "[name].mjs",
      chunkFileNames: "[name]-[hash].mjs",
    });
  } finally {
    await bundle.close();
  }
  const { buildAuthoredPage } = await import(pathToFileURL(join(compiled, "authored.mjs")).href);
  const { normalizeTokens } = await import(pathToFileURL(join(compiled, "design.mjs")).href);
  const tokens = normalizeTokens({
    bg: "#f3f1e9",
    surface: "#e9e6d9",
    ink: "#22382b",
    muted: "#53604f",
    accent: "#385a42",
    accentInk: "#ffffff",
    headingFont: "Fraunces",
    bodyFont: "Instrument Sans",
    scale: 1.333,
    radius: 4,
    density: "airy",
  });
  const base = {
    brand: "Fieldwork",
    headline: "Spaces for the way you live.",
    sub: "Architecture and interiors shaped around the rituals of everyday life.",
    cta: "Discuss your project",
    features: [
      {
        title: "A place to begin",
        body: "New homes and thoughtful additions. A clear process from the first conversation through the final details.",
      },
      {
        title: "Room to be yourself",
        body: "Interiors, materials, and furniture chosen together.",
      },
      {
        title: "Considered, down to the detail",
        body: "The joinery, the light, the way a door opens.",
      },
    ],
    quote: "",
  };
  const image = {
    src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=",
    alt: "A raster fixture, not a published photograph",
  };
  const output = [];
  const requests = [];
  browser = await launchChromium();
  const page = await browser.newPage();
  page.on("request", (request) => requests.push(request.url()));
  for (const composition of ["showcase", "journal"]) {
    for (const scenario of ["content", "image", "long", "empty"]) {
      const content =
        scenario === "empty"
          ? { ...base, sub: "", features: [] }
          : scenario === "long"
            ? {
                ...base,
                brand: "VeryLongBusinessName".repeat(12),
                headline: "OneLongHeadline".repeat(16),
                cta: "A very long action label that needs to wrap naturally",
                features: Array.from({ length: 8 }, (_, i) => ({
                  title: "Repeated long section title ".repeat(5),
                  body: `${i + 1}: ` + "UnbrokenWord".repeat(25),
                })),
              }
            : base;
      const built = buildAuthoredPage(tokens, content, {
        composition,
        actionUrl: "https://example.com/contact",
        ...(scenario === "image" ? { image } : {}),
      });
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "no-preference", forcedColors: "none" });
        await page.setContent(built.html);
        await page.evaluate(() => document.fonts.ready);
        const inspect = () =>
          page.evaluate(() => ({
            viewport: innerWidth,
            scroll: document.documentElement.scrollWidth,
            smallTargets: [...document.querySelectorAll("a")]
              .filter((a) => {
                const r = a.getBoundingClientRect();
                return r.width < 44 || r.height < 44;
              })
              .map((a) => a.textContent),
            clipped: [...document.querySelectorAll("h1,h2,h3,p,a")]
              .filter(
                (e) =>
                  e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== "inline",
              )
              .map((e) => e.textContent?.slice(0, 30)),
            images: [...document.images].map((i) => ({
              loaded: i.complete && i.naturalWidth > 0,
              alt: !!i.alt,
            })),
            missingAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(
              (a) => !document.getElementById(a.getAttribute("href").slice(1)),
            ).length,
          }));
        output.push({ composition, scenario, width, mode: "normal", ...(await inspect()) });
        if (scenario === "content" && (width === 320 || width === 1440))
          await page.screenshot({
            path: join(artifactDir, `${composition}-${width}.png`),
            fullPage: true,
          });
        if (width === 320 && scenario === "content") {
          await page.addStyleTag({
            content:
              "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}",
          });
          output.push({ composition, scenario, width, mode: "text-spacing", ...(await inspect()) });
          await page.setContent(built.html);
          await page.emulateMedia({ reducedMotion: "reduce" });
          output.push({
            composition,
            scenario,
            width,
            mode: "reduced-motion",
            ...(await inspect()),
          });
          await page.emulateMedia({ forcedColors: "active" });
          output.push({
            composition,
            scenario,
            width,
            mode: "forced-colors",
            ...(await inspect()),
          });
        }
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
    await page.setContent(buildAuthoredPage(tokens, base, { composition, actionUrl: "" }).html);
    await page.locator('a[href="#feature-2"]').click();
    output.push({
      composition,
      mode: "native-section-navigation",
      focused: await page.evaluate(() => document.activeElement?.id),
      targetText: await page.locator("#feature-2").textContent(),
    });
  }
  const pages = Object.fromEntries(
    ["showcase", "journal"].map((c) => [
      c,
      buildAuthoredPage(tokens, base, { composition: c, actionUrl: "" }),
    ]),
  );
  server = createServer((req, res) => {
    const parts = req.url.split("/").filter(Boolean);
    const c = parts[0];
    const result = pages[c];
    if (!result) {
      res.writeHead(404).end();
      return;
    }
    const file = parts[1] ?? "standalone.html";
    res.setHeader("Content-Type", file.endsWith(".css") ? "text/css" : "text/html");
    res.end(file === "standalone.html" ? result.html : (result.files[file] ?? ""));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  for (const c of ["showcase", "journal"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`http://127.0.0.1:${address.port}/${c}/standalone.html`);
    await page.evaluate(() => document.fonts.ready);
    const a = await page.screenshot({ path: join(artifactDir, `${c}-standalone.png`) });
    await page.goto(`http://127.0.0.1:${address.port}/${c}/index.html`);
    await page.evaluate(() => document.fonts.ready);
    const b = await page.screenshot({ path: join(artifactDir, `${c}-linked-source.png`) });
    output.push({ composition: c, mode: "linked-source-parity", pixelsIdentical: a.equals(b) });
  }
  const failures = output.filter(
    (r) =>
      r.scroll > r.viewport ||
      r.smallTargets?.length ||
      r.clipped?.length ||
      r.images?.some((i) => !i.loaded || !i.alt) ||
      r.missingAnchors ||
      r.pixelsIdentical === false ||
      (r.mode === "native-section-navigation" && r.focused !== "feature-2"),
  );
  const externalRequests = requests.filter(
    (r) => !r.startsWith("http://127.0.0.1:") && !r.startsWith("data:"),
  );
  const report = {
    at: new Date().toISOString(),
    rendererSha256: createHash("sha256")
      .update(readFileSync(join(root, "src/lib/render-authored-page.ts")))
      .digest("hex"),
    results: output,
    failures,
    externalRequests,
  };
  writeFileSync(join(artifactDir, "RESULTS.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({ scenarios: output.length, failures, externalRequests, artifactDir }, null, 2),
  );
  if (failures.length || externalRequests.length) process.exitCode = 1;
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (browser) await browser.close();
  await rm(compiled, { recursive: true, force: true });
}
