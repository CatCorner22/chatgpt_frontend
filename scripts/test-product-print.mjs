// Run from the project root with node scripts/test-product-print.mjs.
// Chromium produces the PDFs. Poppler's pdftotext enables the content checks.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "vite";
import { launchTestBrowser } from "./browser-engine.mjs";

const content = {
  brand: "River Studio",
  headline: "Plan your workshop",
  sub: "A short guide to your studio visit.",
  cta: "Reserve a workshop",
  features: [
    { title: "Studio entrance", body: "Meet at the blue door." },
    { title: "Open on Saturday", body: "" },
    { title: "Clay and tools", body: "Your ticket includes clay and a tool kit." },
    { title: "Collect your work", body: "Bring the paper receipt when you return." },
  ],
  quote: "",
};
const pdfTool = spawnSync("pdftotext", ["-v"]);
if (pdfTool.error && pdfTool.error.code !== "ENOENT") throw pdfTool.error;
const canReadPdf = !pdfTool.error;
if (canReadPdf) assert.equal(pdfTool.status, 0, "pdftotext must run successfully");

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
try {
  const { buildAuthoredPage } = await vite.ssrLoadModule("/src/lib/authored-page.ts");
  const { normalizeTokens } = await vite.ssrLoadModule("/src/lib/design.ts");
  const tokens = normalizeTokens({
    headingFont: "Instrument Serif",
    bodyFont: "Instrument Sans",
    bg: "#15181b",
    ink: "#ffffff",
    surface: "#202326",
    muted: "#d5d8db",
  });
  const built = buildAuthoredPage(tokens, content, {
    composition: "product",
    actionUrl: "https://example.org/workshops",
  });
  assert.match(built.files["README.txt"], /Print preview/);
  browser = await launchTestBrowser();
  assert.equal(browser.browserType().name(), "chromium", "This test needs Chromium PDF output");
  for (const file of ["working.html", "index.html"]) {
    const page = await browser.newPage();
    // Use the actual linked stylesheet from the editable export for the second case.
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      assert.equal(url.origin, "https://handoff.test");
      const name = url.pathname.slice(1);
      const body = name === "working.html" ? built.html : built.files[name];
      assert.ok(body, `Unexpected export request for ${name}`);
      await route.fulfill({ body, contentType: name === "styles.css" ? "text/css" : "text/html" });
    });
    await page.goto(`https://handoff.test/${file}`);
    await page.evaluate(() => document.fonts.ready);
    const rows = page.locator("details");
    const states = () => rows.evaluateAll((items) => items.map((item) => item.open));
    assert.deepEqual(await states(), [true, false, false]);
    const first = rows.first().locator("summary");
    if (file === "index.html") {
      await first.focus();
      await page.keyboard.press("Enter");
    }
    const before = await states();
    assert.deepEqual(before, [file === "working.html", false, false]);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".skip").isVisible(), false);
    assert.equal(
      await page.locator(".details-section").evaluate((el) => getComputedStyle(el).display),
      "block",
    );
    const canPrintClosed = await rows.evaluateAll((items) =>
      items.every(
        (item) => getComputedStyle(item, "::details-content").contentVisibility === "visible",
      ),
    );
    assert.ok(canPrintClosed, "Closed detail bodies must be paintable on paper");
    const pdf = await page.pdf({ format: "A4", printBackground: false });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    if (canReadPdf) {
      const result = spawnSync("pdftotext", ["-", "-"], { input: pdf, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const text = result.stdout.replace(/\s+/g, " ").trim();
      const copy = [
        content.headline,
        content.sub,
        content.cta,
        ...content.features.flatMap(({ title, body }) => [title, body]).filter(Boolean),
      ];
      let previous = -1;
      for (const words of copy) {
        const index = text.indexOf(words);
        assert.ok(index > previous, `${file} PDF lost or reordered "${words}"`);
        assert.equal(text.lastIndexOf(words), index, `Duplicate "${words}" in ${file} PDF`);
        previous = index;
      }
      assert.doesNotMatch(text, /Skip to content|Explore details|Back to top|[+−]/);
    }
    await page.emulateMedia({ media: "screen" });
    assert.deepEqual(
      await states(),
      before,
      `${file} printing changed the screen disclosure state`,
    );
    await first.focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await states(), [!before[0], false, false]);
    await page.close();
  }
  console.log(
    "Passed Chromium A4 printing and screen disclosure checks for working HTML and editable HTML/CSS.",
  );
  console.log(
    canReadPdf
      ? "Verified owner text, order, duplicates and print-only omissions in both PDFs."
      : "SKIPPED PDF text extraction: install pdftotext (Poppler) to verify the actual printed words.",
  );
} finally {
  await browser?.close();
  await vite.close();
}
