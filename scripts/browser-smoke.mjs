/** Run against an already-running local app: npm run test:browser. */
import { launchTestBrowser, browserName } from "./browser-engine.mjs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import JSZip from "jszip";
const base = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const browser = await launchTestBrowser();
await mkdir("artifacts", { recursive: true });
const errors = [];
const serverRequests = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("_server")) serverRequests.push(r.url());
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await page
    .getByLabel("Your idea, in your words")
    .fill("An independent ceramics studio teaching pottery workshops in Portland.");
  await page.getByRole("button", { name: "Find my direction", exact: true }).click();
  await page.getByRole("heading", { name: "Which direction is closest?" }).waitFor();
  assert.equal(await page.locator("main button").count(), 3);
  await page.locator("main button").first().click();
  assert.equal(await page.getByRole("button", { name: "Show three different options" }).count(), 0);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Choose 1", exact: true }).click();
  await page.getByRole("heading", { name: "Check your 3 answers" }).waitFor();
  await page.getByRole("button", { name: "Create my Vision" }).click();
  await page.getByRole("button", { name: /Design specification.*handoff tools/ }).click();
  await page.getByText("Make the words yours", { exact: true }).click();
  await page.getByLabel("Business or project name").fill("Clay House");
  await page.getByLabel("Headline", { exact: true }).fill("Make something with your hands.");
  const markdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download DESIGN.md", exact: true }).click();
  const markdown = await readFile(await (await markdownDownload).path(), "utf8");
  assert.ok(markdown.includes("Clay House"));
  assert.ok(markdown.includes("Make something with your hands."));
  assert.ok(markdown.includes("Do not invent a testimonial"));
  const packDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download design pack", exact: true }).click();
  const pack = await JSZip.loadAsync(await readFile(await (await packDownload).path()));
  assert.ok(Object.keys(pack.files).some((name) => name.endsWith("tokens.css")));
  await page.reload({ waitUntil: "networkidle" });
  await page
    .frameLocator('iframe[title="Working page preview"]')
    .getByRole("link", { name: "Clay House", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Focus home", exact: true }).click();
  await page.getByRole("button", { name: "Continue design", exact: true }).click();
  await page.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
  await page.getByRole("link", { name: "Skip to content", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "MAIN");
  await page.screenshot({ path: "artifacts/design-export.png", fullPage: true });
  // Regression: skipped answers are still completed steps and must resume at export.
  const skipped = await browser.newPage();
  await skipped.goto(base, { waitUntil: "networkidle" });
  await skipped.getByRole("button", { name: /WARM & ORGANIC Garden Ledger/ }).click();
  for (let i = 0; i < 3; i++)
    await skipped.getByRole("button", { name: "Skip", exact: true }).click();
  await skipped.getByRole("button", { name: "Create my Vision" }).click();
  await skipped.getByRole("link", { name: "Focus home", exact: true }).click();
  await skipped.getByRole("button", { name: "Continue design", exact: true }).click();
  await skipped.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
  // Mobile and quality lab use a fresh browser context.
  const mobile = await browser.newPage({
    viewport: { width: 320, height: 812 },
    acceptDownloads: true,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(base, { waitUntil: "networkidle" });
  const mobileWidths = await mobile.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.equal(mobileWidths.viewport, mobileWidths.document);
  await mobile.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  await mobile.getByRole("link", { name: "Quality lab", exact: true }).click();
  await mobile.getByRole("button", { name: "Flawed sample", exact: true }).click();
  await mobile.getByRole("button", { name: "Check this HTML", exact: true }).click();
  await mobile.getByRole("heading", { name: "3 findings to work through." }).waitFor();
  const receiptDownload = mobile.waitForEvent("download");
  await mobile.getByRole("button", { name: "Download receipt", exact: true }).click();
  const receipt = JSON.parse(await readFile(await (await receiptDownload).path(), "utf8"));
  assert.ok(receipt);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 320);
  await mobile.screenshot({ path: "artifacts/quality-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(serverRequests, []);
  const report = {
    date: new Date().toISOString(),
    target: base,
    browser: browserName,
    outcome: "passed",
    checks: [
      "local brief to three directions",
      "three choice flow",
      "real content editing",
      "Markdown download contents",
      "ZIP download contents",
      "reload persistence",
      "resume with skipped choices",
      "keyboard skip link",
      "320px home and quality layout",
      "quality flawed sample and receipt download",
    ],
    mobileWidths,
    pageErrors: errors,
    localFlowServerRequests: serverRequests,
  };
  await writeFile("artifacts/BROWSER-SMOKE.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
