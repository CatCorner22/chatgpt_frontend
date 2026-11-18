import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { launchTestBrowser, browserName } from "./browser-engine.mjs";

const base = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const out = `artifacts/existing-site-hardening/mode-${browserName}`;
await mkdir(out, { recursive: true });
const browser = await launchTestBrowser();
const errors = [];
const requests = [];
const brief = "Redesign this checkout without changing behavior or losing orders";
try {
  const page = await browser.newPage({
    viewport: { width: 320, height: 900 },
    acceptDownloads: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("_server")) requests.push(r.url());
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /Restyle my existing/ }).check();
  await page.getByRole("button", { name: "App", exact: true }).click();
  await page.getByLabel("Your idea, in your words").fill(brief);
  await page.getByRole("button", { name: "Find my direction", exact: true }).click();
  await page.getByRole("heading", { name: "Which direction is closest?" }).waitFor();
  await page.locator("main button").first().click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Choose 1", exact: true }).click();
  await page.getByRole("button", { name: "Create my Vision", exact: true }).click();
  await page.getByRole("radio", { name: /Restyle my existing/ }).waitFor();
  assert.equal(await page.getByRole("radio", { name: /Restyle my existing/ }).isChecked(), true);
  await page.getByRole("radio", { name: /A new site/ }).check();
  assert.equal(await page.getByRole("radio", { name: /A new site/ }).isChecked(), true);
  await page.getByTitle("Undo the last step (Ctrl+Z)").click();
  assert.equal(await page.getByRole("radio", { name: /Restyle my existing/ }).isChecked(), true);
  await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
  assert.equal(await page.getByRole("radio", { name: /A new site/ }).isChecked(), true);
  await page.getByRole("radio", { name: /Restyle my existing/ }).check();
  await page.waitForFunction((expected) => {
    const s = JSON.parse(localStorage.getItem("refraction:v1"));
    return s?.brief === expected && s?.integration === "existing";
  }, brief);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("radio", { name: /Restyle my existing/ }).isChecked(), true);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("refraction:v1")));
  assert.equal(state.brief, brief);
  assert.equal(state.aiCalls, 0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download existing-site pack", exact: true }).click();
  const received = await download;
  assert.equal(received.suggestedFilename(), "focus-existing-site-pack.zip");
  const bytes = await readFile(await received.path());
  await writeFile(`${out}/existing-site-pack.zip`, bytes);
  const zip = await JSZip.loadAsync(bytes);
  assert.ok(zip.file("focus-restyle/UNDO.md"));
  assert.equal(zip.file("focus-restyle/AGENTS.md"), null);
  await page.screenshot({ path: `${out}/mobile-existing.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const legacy = await browser.newPage();
  await legacy.goto(base, { waitUntil: "networkidle" });
  const { integration: _, ...old } = state;
  await legacy.evaluate((s) => localStorage.setItem("refraction:v1", JSON.stringify(s)), old);
  await legacy.reload({ waitUntil: "networkidle" });
  assert.equal(await legacy.getByRole("radio", { name: /Restyle my existing/ }).isChecked(), true);
  await legacy.getByRole("radio", { name: /A new site/ }).check();
  await legacy.waitForFunction(
    () => JSON.parse(localStorage.getItem("refraction:v1"))?.integration === "new",
  );
  await legacy.reload({ waitUntil: "networkidle" });
  assert.equal(await legacy.getByRole("radio", { name: /A new site/ }).isChecked(), true);
  assert.equal(
    await legacy.evaluate(() => JSON.parse(localStorage.getItem("refraction:v1")).brief),
    brief,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const receipt = {
    browser: browserName,
    base,
    explicitIntent: true,
    unchangedBrief: true,
    undoRedo: true,
    reload: true,
    legacyRescueSwitch: true,
    actualZip: true,
    mobile320: true,
    aiCalls: 0,
    errors,
  };
  await writeFile(`${out}/RESULTS.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser.close();
}
