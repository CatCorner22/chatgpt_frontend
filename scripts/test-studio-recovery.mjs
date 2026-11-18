/** Run against a local app: FOCUS_TEST_URL=http://localhost:4173 node scripts/test-studio-recovery.mjs */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { launchTestBrowser, browserName } from "./browser-engine.mjs";

const base = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const key = "refraction:v1";
const recoveryPrefix = `${key}:recovery:`;
const report = {
  startedAt: new Date().toISOString(),
  base,
  browser: browserName,
  outcome: "running",
  checks: [],
};
const log = [];
const note = (text) => {
  log.push(text);
  console.log(text);
};

// Deliberately omit later fields (page, purpose, undo, cache) to exercise legacy migration.
const legacy = {
  version: 1,
  stage: "rx",
  brief: "Example ceramics workshop",
  direction: "Example legacy look",
  content: {
    brand: "Recovery test studio",
    headline: "Example workshop",
    sub: "Test content",
    cta: "Learn more",
    features: [],
    quote: "",
  },
  tokens: {
    bg: "#ffffff",
    surface: "#f4f4f4",
    ink: "#111111",
    muted: "#444444",
    accent: "#24513a",
    accentInk: "#ffffff",
    headingFont: "Fraunces",
    bodyFont: "Inter",
    headingCase: "normal",
    scale: 1.333,
    radius: 12,
    density: "balanced",
    heroLayout: "split",
    buttonStyle: "solid",
    texture: "none",
  },
  history: [],
  directions: [],
  picks: [],
  stepIndex: 3,
};
const newBrief = "A ceramics workshop with classes every Saturday.";
let browser;

async function snapshot(page) {
  return page.evaluate(
    ({ key, recoveryPrefix }) => ({
      raw: localStorage.getItem(key),
      copies: Object.keys(localStorage)
        .filter((name) => name.startsWith(recoveryPrefix))
        .map((name) => ({ key: name, raw: localStorage.getItem(name) })),
    }),
    { key, recoveryPrefix },
  );
}

async function seed(page, raw) {
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  await page.reload({ waitUntil: "networkidle" });
}

async function createDirections(page) {
  await page.getByLabel("Your idea, in your words").fill(newBrief);
  await page.getByRole("button", { name: "Find my direction", exact: true }).click();
  await page.getByRole("heading", { name: "Which direction is closest?" }).waitFor();
}

async function downloadText(page, buttonName) {
  const ready = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const download = await ready;
  return readFile(await download.path(), "utf8");
}

async function check(name, run) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const pageErrors = [];
  const serverRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("_server")) serverRequests.push(request.url());
  });
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    const evidence = await run(page);
    assert.deepEqual(pageErrors, [], "The scenario must not produce uncaught browser errors.");
    assert.deepEqual(serverRequests, [], "Local recovery must not require server functions.");
    report.checks.push({ name, outcome: "passed", ...evidence, pageErrors, serverRequests });
    note(`PASS ${name}`);
  } catch (error) {
    report.checks.push({
      name,
      outcome: "failed",
      error: error.stack || String(error),
      pageErrors,
      serverRequests,
    });
    note(`FAIL ${name}: ${error.stack || error}`);
  } finally {
    await context.close();
  }
}

try {
  await mkdir("artifacts", { recursive: true });
  browser = await launchTestBrowser();

  await check("legitimate legacy save migrates without quarantine", async (page) => {
    await seed(page, JSON.stringify(legacy));
    await page.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
    const saved = await snapshot(page);
    const restored = JSON.parse(saved.raw);
    assert.equal(restored.content.brand, legacy.content.brand);
    assert.equal(restored.stage, "rx");
    assert.equal(restored.page.composition, "studio");
    assert.equal(saved.copies.length, 0);
    return { originalContentRetained: true, missingPageSettingsMigrated: true, recoveryCopies: 0 };
  });

  const corruptions = [
    ["invalid JSON", "{broken-json"],
    [
      "valid JSON with null features",
      JSON.stringify({ ...legacy, content: { ...legacy.content, features: null } }),
    ],
    ["valid JSON with nonarray history", JSON.stringify({ ...legacy, history: { bad: "data" } })],
  ];
  for (const { field, damage, label } of [
    {
      field: "past",
      damage: [{ ...legacy, content: { ...legacy.content, features: null } }],
      label: "past entry",
    },
    {
      field: "future",
      damage: [{ ...legacy, content: { ...legacy.content, features: null } }],
      label: "future entry",
    },
    { field: "past", damage: null, label: "past container" },
    { field: "future", damage: {}, label: "future container" },
  ]) {
    await check(`damaged ${label} preserves original and usable current work`, async (page) => {
      const raw = JSON.stringify({
        ...legacy,
        [field]: damage,
      });
      await seed(page, raw);
      await page.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
      await page.getByText("Original saved data preserved (1)", { exact: true }).waitFor();
      let saved = await snapshot(page);
      assert.equal(JSON.parse(saved.raw).content.brand, legacy.content.brand);
      assert.deepEqual(JSON.parse(saved.raw)[field], []);
      assert.deepEqual(
        saved.copies.map((copy) => copy.raw),
        [raw],
      );
      await page.reload({ waitUntil: "networkidle" });
      saved = await snapshot(page);
      assert.equal(JSON.parse(saved.raw).content.headline, legacy.content.headline);
      assert.deepEqual(
        saved.copies.map((copy) => copy.raw),
        [raw],
      );
      await page.getByText("Original saved data preserved (1)", { exact: true }).click();
      assert.equal(await downloadText(page, "Download preserved data 1"), raw);
      return { currentWorkRetained: true, exactOriginalRetained: true, historyRepaired: true };
    });
  }
  await check("history repair blocks if its recovery copy cannot be saved", async (page) => {
    const raw = JSON.stringify({ ...legacy, past: [null] });
    await page.addInitScript(
      ({ recoveryPrefix }) => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name.startsWith(recoveryPrefix))
            throw new DOMException("Injected quota failure", "QuotaExceededError");
          return original.call(this, name, value);
        };
        window.__focusRecoveryTestAllowWrites = () => {
          Storage.prototype.setItem = original;
        };
      },
      { recoveryPrefix },
    );
    await seed(page, raw);
    await page.getByRole("heading", { name: "Let's protect your saved work" }).waitFor();
    assert.equal((await snapshot(page)).raw, raw);
    assert.equal(await downloadText(page, "Download original saved data"), raw);
    await page.evaluate(() => window.__focusRecoveryTestAllowWrites());
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
    const saved = await snapshot(page);
    assert.equal(JSON.parse(saved.raw).content.brand, legacy.content.brand);
    assert.deepEqual(
      saved.copies.map((copy) => copy.raw),
      [raw],
    );
    return { originalKeptUntilVerifiedCopy: true, retryKeepsCurrentDesign: true };
  });
  for (const [label, raw] of corruptions) {
    await check(`${label}: preserve original, create, reload`, async (page) => {
      await seed(page, raw);
      await page.getByText("Original saved data preserved (1)", { exact: true }).waitFor();
      let saved = await snapshot(page);
      assert.equal(saved.copies.length, 1);
      assert.equal(saved.copies[0].raw, raw);
      await createDirections(page);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Which direction is closest?" }).waitFor();
      saved = await snapshot(page);
      assert.equal(JSON.parse(saved.raw).brief, newBrief);
      assert.equal(
        saved.copies.length,
        1,
        "Reload must not duplicate or remove the recovery copy.",
      );
      assert.equal(saved.copies[0].raw, raw);
      await page.getByText("Original saved data preserved (1)", { exact: true }).click();
      assert.equal(await downloadText(page, "Download preserved data 1"), raw);
      return {
        exactOriginalRetained: true,
        newWorkRestored: true,
        originalDownloadAfterReloadExact: true,
      };
    });
  }

  await check(
    "recovery quota failure blocks creation and offers download plus retry",
    async (page) => {
      const raw = "{retain-my-original";
      await page.addInitScript(
        ({ recoveryPrefix }) => {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function (name, value) {
            if (name.startsWith(recoveryPrefix))
              throw new DOMException("Injected quota failure", "QuotaExceededError");
            return original.call(this, name, value);
          };
          window.__focusRecoveryTestAllowWrites = () => {
            Storage.prototype.setItem = original;
          };
        },
        { recoveryPrefix },
      );
      await seed(page, raw);
      await page.getByRole("heading", { name: "Let's protect your saved work" }).waitFor();
      assert.equal(await page.getByLabel("Your idea, in your words").count(), 0);
      assert.equal((await snapshot(page)).raw, raw);
      assert.equal(await downloadText(page, "Download original saved data"), raw);
      await page.evaluate(() => window.__focusRecoveryTestAllowWrites());
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await createDirections(page);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Which direction is closest?" }).waitFor();
      const saved = await snapshot(page);
      assert.equal(JSON.parse(saved.raw).brief, newBrief);
      assert.equal(saved.copies.length, 1);
      assert.equal(saved.copies[0].raw, raw);
      return {
        creationBlockedWhileUnsafe: true,
        originalDownloadExact: true,
        retryReopened: true,
        newWorkRestored: true,
        exactOriginalRetained: true,
      };
    },
  );

  await check(
    "library quota failure preserves current-save updates across reload",
    async (page) => {
      await createDirections(page);
      await page.locator("main button").first().click();
      await page.getByRole("button", { name: "Choose 1", exact: true }).waitFor();
      const original = JSON.parse((await snapshot(page)).raw);
      await page.addInitScript(() => {
        const real = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === "refraction:library:v1")
            throw new DOMException("Injected archive quota failure", "QuotaExceededError");
          return real.call(this, name, value);
        };
      });
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByText(
          "Your current design is saved for refresh, but My designs could not be updated.",
          { exact: false },
        )
        .waitFor();
      await page.getByRole("button", { name: "Choose 1", exact: true }).click();
      await page.waitForFunction(
        ({ key, step }) => JSON.parse(localStorage.getItem(key)).stepIndex === step + 1,
        { key, step: original.stepIndex },
      );
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Choose 1", exact: true }).waitFor();
      const restored = JSON.parse((await snapshot(page)).raw);
      assert.equal(restored.libraryId, original.libraryId);
      assert.equal(restored.brief, newBrief);
      assert.equal(restored.stepIndex, original.stepIndex + 1);
      assert.equal(
        await page.getByRole("heading", { name: "Let's protect your saved work" }).count(),
        0,
      );
      return {
        archiveWarningVisible: true,
        currentDesignRestored: true,
        subsequentChoicePersisted: true,
      };
    },
  );

  report.outcome = report.checks.every((item) => item.outcome === "passed") ? "passed" : "failed";
} catch (error) {
  report.outcome = "failed";
  report.error = error.stack || String(error);
  note(report.error);
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  note(
    `${report.outcome.toUpperCase()}: ${report.checks.filter((item) => item.outcome === "passed").length}/${report.checks.length} recovery scenarios at ${base}`,
  );
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/STUDIO-RECOVERY.json", JSON.stringify(report, null, 2) + "\n");
  await writeFile("artifacts/STUDIO-RECOVERY.log", log.join("\n") + "\n");
  if (report.outcome !== "passed") process.exitCode = 1;
}
