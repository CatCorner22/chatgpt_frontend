import { openSavedStudio } from "./fixtures/saved-studio.mjs";
import { launchChromium } from "./browser-engine.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import JSZip from "jszip";

const url = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const browser = await launchChromium();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const dirs = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
  const tokens = dirs.find((direction) => direction.id === "graphite-precision").direction.tokens;
  const content = {
    brand: "Test workshop",
    headline: "Careful, useful work.",
    sub: "A test-only project for verifying edits and image handling.",
    cta: "Contact",
    features: [{ title: "Process", body: "Test content." }],
    quote: "",
  };
  await openSavedStudio(page, url, {
    brief: "Workshop test",
    tokens,
    content,
    direction: "Graphite Precision",
    libraryId: "editor-proof",
  });
  const panel = page.locator(".authored-workspace");
  await panel.getByRole("button", { name: "Edit the page’s words" }).click();
  const name = panel.getByRole("textbox", { name: "Business or project name", exact: true });
  assert.equal(await name.evaluate((element) => element === document.activeElement), true);
  const rect = await name.boundingBox();
  assert.ok(rect.y >= 0 && rect.y < 1000);
  await name.fill("Edited workshop");
  const imageBytes = await name.screenshot();
  await panel.getByRole("radio", { name: /^Journal/ }).check();
  await panel.getByText("Add your own image", { exact: true }).click();
  const upload = panel.getByLabel(/PNG, JPEG, or WebP/);
  await upload.setInputFiles({ name: "test.png", mimeType: "image/png", buffer: imageBytes });
  await panel
    .getByText("Add an image description to include it in the preview and download.")
    .waitFor();
  await panel.getByLabel("Describe the image").fill("Test-only screenshot fixture");
  const image = page
    .frameLocator('iframe[title="Working page preview"]')
    .getByRole("img", { name: "Test-only screenshot fixture" });
  await image.waitFor();
  await upload.setInputFiles({
    name: "incorrect.jpg",
    mimeType: "image/jpeg",
    buffer: imageBytes,
  });
  await panel.getByRole("alert").filter({ hasText: "contents do not match" }).waitFor();
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download page ZIP", exact: true }).click();
  const zip = await JSZip.loadAsync(await readFile(await (await download).path()));
  const project = JSON.parse(await zip.file("focus-project.json").async("string"));
  assert.equal(project.studio.content.brand, "Edited workshop");
  assert.equal(project.studio.page.composition, "journal");
  assert.ok(project.embeddedImage.src.startsWith("data:image/png;"));
  await page.reload({ waitUntil: "networkidle" });
  await image.waitFor();
  assert.equal(await panel.getByRole("radio", { name: /^Journal/ }).isChecked(), true);
  await page.setViewportSize({ width: 320, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.deepEqual(errors, []);
  const result = {
    at: new Date().toISOString(),
    target: url,
    status: "passed",
    checks: [
      "editor focus visible after opening",
      "content retained after layout change",
      "missing image description explained",
      "invalid replacement preserves original image",
      "downloaded ZIP retains project and image",
      "new layout and image survive reload",
      "320px editor reflow",
    ],
    pageErrors: errors,
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/REFERENCE-EDITOR-BROWSER.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
