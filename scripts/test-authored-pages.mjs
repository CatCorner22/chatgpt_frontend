import { launchTestBrowser, browserName } from "./browser-engine.mjs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import JSZip from "jszip";
const studioUrl = new URL(process.env.FOCUS_TEST_URL || "http://localhost:3000");
studioUrl.searchParams.set("view", "studio");
studioUrl.searchParams.delete("panel");
studioUrl.hash = "";
const url = studioUrl.href;
const dir = "artifacts/authored-pages";
await mkdir(dir, { recursive: true });
const directions = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
const design = directions.find((d) => d.id === "garden-ledger");
assert.ok(design, "The authored-page test direction must exist.");
const testTokens = {
  ...design.direction.tokens,
  headingFont: "Instrument Serif",
  bodyFont: "Instrument Sans",
};
const exampleContent = {
  brand: "Fieldwork / Example studio",
  headline: "Everyday objects. A little more considered.",
  sub: "Example content for a ceramics studio. Replace this with your actual offer before publishing.",
  cta: "Visit the studio",
  features: [
    {
      title: "Objects for everyday use",
      body: "Describe your actual collection, materials, and care information in your own words.",
    },
    {
      title: "A closer look at the process",
      body: "Explain how you work, with details that a potential customer needs to make a decision.",
    },
    {
      title: "Find the right piece",
      body: "Give visitors a clear next step and a genuine way to contact you.",
    },
  ],
  quote: "",
};
const browser = await launchTestBrowser();
const pageErrors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  // A legacy saved state deliberately has no page settings; migration must supply them.
  await page.evaluate(
    ({ tokens, content }) =>
      localStorage.setItem(
        "refraction:v1",
        JSON.stringify({
          version: 2,
          stage: "rx",
          brief: "Example ceramics studio",
          content,
          tokens,
          direction: "Garden Ledger",
          libraryId: "authored-browser-fixture",
          quick: true,
          picks: [],
          history: [],
          directions: [],
          stepIndex: 3,
        }),
      ),
    { tokens: testTokens, content: exampleContent },
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
  await page.getByLabel("Where should the main action lead?").fill("https://example.com/studio");
  const results = [];
  for (const composition of ["Studio", "Editorial", "Product", "Showcase", "Journal"]) {
    await page.getByRole("radio", { name: new RegExp("^" + composition) }).check();
    const ready = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download working HTML", exact: true }).click();
    const downloaded = await ready;
    const html = await readFile(await downloaded.path(), "utf8");
    const iframeHtml = await page
      .locator('iframe[title="Working page preview"]')
      .getAttribute("srcdoc");
    assert.equal(html, iframeHtml, "Preview and download must contain the same document.");
    assert.ok(html.includes("https://example.com/studio"));
    assert.ok(!/<script\b/i.test(html));
    const file = `${dir}/${composition.toLowerCase()}.html`;
    await writeFile(file, html);
    const output = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    output.on("pageerror", (error) => pageErrors.push(error.message));
    const requests = [];
    output.on("request", (r) => {
      if (!r.url().startsWith("data:")) requests.push(r.url());
    });
    await output.setContent(html, { waitUntil: "load" });
    const loadedFonts = await output.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((face) => ({
        family: face.family.replace(/^['"]|['"]$/g, ""),
        status: face.status,
        weight: face.weight,
      }));
    });
    for (const family of ["Focus Instrument Serif v1", "Focus Instrument Sans v1"]) {
      assert.ok(
        loadedFonts.some((face) => face.family === family && face.status === "loaded"),
        `${family} must load from the delivered document, not an installed fallback.`,
      );
    }
    assert.equal(
      loadedFonts.find((face) => face.family === "Focus Instrument Serif v1").weight,
      "400",
    );
    assert.deepEqual(requests, [], "The authored page must load without remote assets.");
    await output.screenshot({
      path: `${dir}/${composition.toLowerCase()}-desktop.png`,
      fullPage: true,
    });
    if (composition === "Product") {
      const disclosure = output.locator("details").nth(1);
      await disclosure.locator("summary").focus();
      await output.keyboard.press("Enter");
      assert.equal(await disclosure.getAttribute("open"), "");
    }
    if (composition === "Showcase" || composition === "Journal") {
      const links = output
        .getByRole("navigation", {
          name: composition === "Showcase" ? "Explore this page" : "On this page",
          exact: true,
        })
        .getByRole("link");
      assert.equal(await links.count(), exampleContent.features.length);
      const destination = await links.first().getAttribute("href");
      await links.first().focus();
      await output.keyboard.press("Enter");
      await output.waitForFunction((hash) => location.hash === hash, destination);
      assert.equal(await output.evaluate(() => document.activeElement?.id), destination.slice(1));
    }
    await output.setViewportSize({ width: 320, height: 850 });
    assert.equal(await output.evaluate(() => document.documentElement.scrollWidth), 320);
    await output.addStyleTag({
      content:
        "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}",
    });
    assert.equal(await output.evaluate(() => document.documentElement.scrollWidth), 320);
    await output.screenshot({
      path: `${dir}/${composition.toLowerCase()}-mobile-spacing.png`,
      fullPage: true,
    });
    assert.deepEqual(requests, [], "Responsive and keyboard checks must not load remote assets.");
    await output.close();
    results.push({
      composition,
      exactPreviewDownloadMatch: true,
      loadedFonts,
      networkRequests: 0,
      mobileOverflow: false,
      textSpacingOverflow: false,
    });
  }
  // Actual source ZIP, rather than a pack of instructions only.
  const readyZip = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download page ZIP", exact: true }).click();
  const zip = await JSZip.loadAsync(await readFile(await (await readyZip).path()));
  assert.ok(zip.file("index.html"));
  assert.ok(zip.file("styles.css"));
  assert.ok(zip.file("fonts/instrument-serif-OFL.txt"));
  assert.ok(zip.file("fonts/instrument-sans-OFL.txt"));
  assert.ok(zip.file("fonts/PROVENANCE.txt"));
  const zipCss = await zip.file("styles.css").async("string");
  const finalHtml = await readFile(`${dir}/journal.html`, "utf8");
  assert.ok(finalHtml.includes(`<style>${zipCss}</style>`), "ZIP and HTML must use the same CSS.");
  const project = JSON.parse(await zip.file("focus-project.json").async("string"));
  assert.equal(project.studio.page.actionUrl, "https://example.com/studio");
  assert.equal(project.studio.page.composition, "journal");
  assert.equal(project.studio.content.brand, exampleContent.brand);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("Where should the main action lead?").inputValue(),
    "https://example.com/studio",
  );
  assert.equal(await page.getByRole("radio", { name: /^Journal/ }).isChecked(), true);
  await page.screenshot({ path: `${dir}/workspace.png`, fullPage: true });
  // The working-page editor must reflow within the narrow app viewport too.
  await page.setViewportSize({ width: 320, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.deepEqual(pageErrors, []);
  const report = {
    at: new Date().toISOString(),
    target: url,
    browser: browserName,
    status: "passed",
    results,
    checks: [
      "legacy save migration",
      "exact preview/download parity",
      "embedded font faces loaded and licenses retained",
      "valid source ZIP",
      "native disclosure and section-link keyboard operation",
      "320px page and workspace reflow",
      "text spacing override",
      "no remote requests",
      "page settings persist after reload",
    ],
    pageErrors,
  };
  await writeFile(`${dir}/RESULTS.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
