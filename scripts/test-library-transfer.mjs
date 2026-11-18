/**
 * Run against a running Focus app (development or production preview):
 *   FOCUS_TEST_URL=http://localhost:4173 node scripts/test-library-transfer.mjs
 * Requires npm dependencies and Chromium at CHROMIUM_PATH (default /usr/bin/chromium).
 * Creates isolated browser contexts and its own readable PNG fixtures; no account,
 * API key, existing backup, or prior artifact generation is required.
 */
import { launchTestBrowser, browserName } from "./browser-engine.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const url = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const artifacts = new URL("../artifacts/", import.meta.url);
const artifactPath = (name) => fileURLToPath(new URL(name, artifacts));
await mkdir(artifacts, { recursive: true });
const browser = await launchTestBrowser();
const errors = [];
let activePage;
const source = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
activePage = source;
source.on("pageerror", (e) => errors.push(e.message));
try {
  await source.goto(new URL("/", url).href, { waitUntil: "networkidle" });
  await source
    .getByLabel("Your idea, in your words")
    .fill("A local ceramics studio teaching pottery and making tableware.");
  await source.getByRole("button", { name: "Find my direction", exact: true }).click();
  await source.getByRole("heading", { name: "Which direction is closest?" }).waitFor();
  await source.locator("main button").first().click();
  for (let i = 0; i < 3; i++)
    await source.getByRole("button", { name: "Skip", exact: true }).click();
  await source.getByRole("button", { name: "Create my Vision", exact: true }).click();
  await source.getByText("Add your own image", { exact: true }).click();
  await source.getByLabel(/Describe the image/).fill("A test ceramic tile.");
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=",
    "base64",
  );
  await source
    .locator("#page-image")
    .setInputFiles({ name: "tile.png", mimeType: "image/png", buffer: bytes });
  await source.getByRole("button", { name: "Remove image", exact: true }).waitFor();
  await source
    .frameLocator('iframe[title="Working page preview"]')
    .locator("img.owner-image")
    .waitFor();
  // PNG readers accept trailing bytes; this keeps the fixture self-contained while
  // producing a different content hash for the saved image revision.
  const laterBytes = Buffer.concat([bytes, Buffer.from("later")]);
  const laterSource = `data:image/png;base64,${laterBytes.toString("base64")}`;
  await source
    .locator("#page-image")
    .setInputFiles({ name: "tile-later.png", mimeType: "image/png", buffer: laterBytes });
  await source
    .frameLocator('iframe[title="Working page preview"]')
    .locator(`img.owner-image[src="${laterSource}"]`)
    .waitFor();
  await source.getByRole("link", { name: "My designs", exact: true }).click();
  const downloadPromise = source.waitForEvent("download");
  await source.getByRole("button", { name: "Back up library", exact: true }).click();
  const downloaded = await downloadPromise;
  const raw = await readFile(await downloaded.path(), "utf8");
  const backup = JSON.parse(raw);
  assert.equal(backup.version, 1);
  assert.equal(Object.keys(backup.assets.images).length, 2);
  const id = backup.entries[0].state.page.imageId;
  assert(backup.assets.images[id]);
  const historical = backup.entries[0].versions.map((v) => v.state.page?.imageId).filter(Boolean);
  assert(historical.length > 0);
  for (const imageId of historical) assert(backup.assets.images[imageId]);
  // browser.newPage creates a separate, empty browser context.
  const destination = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage = destination;
  destination.on("pageerror", (e) => errors.push(e.message));
  await destination.goto(new URL("/library", url).href, { waitUntil: "networkidle" });
  assert.equal(
    await destination.evaluate(() => localStorage.getItem("refraction:library:v1")),
    null,
  );
  await destination.getByLabel("Library backup JSON file").setInputFiles({
    name: "focus-design-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await destination.getByRole("status").filter({ hasText: "Restored 1 design" }).waitFor();
  const persisted = await destination.evaluate(() => localStorage.getItem("refraction:library:v1"));
  assert.equal(JSON.parse(persisted).entries.length, 1);
  for (const [imageId, data] of Object.entries(backup.assets.images))
    assert.equal(
      await destination.evaluate((id) => localStorage.getItem("focus:page-image:" + id), imageId),
      data,
    );
  await destination.getByLabel("Library backup JSON file").setInputFiles({
    name: "focus-design-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await destination
    .getByRole("status")
    .filter({ hasText: "No duplicate designs were added." })
    .waitFor();
  assert.equal(
    JSON.parse(await destination.evaluate(() => localStorage.getItem("refraction:library:v1")))
      .entries.length,
    1,
  );
  await destination
    .getByLabel("Library backup JSON file")
    .setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await destination.getByRole("alert").filter({ hasText: "not valid JSON" }).waitFor();
  assert.equal(
    await destination.evaluate(() => localStorage.getItem("refraction:library:v1")),
    persisted,
  );
  await destination.getByRole("button", { name: /Open its Vision/ }).click();
  const restoredImage = destination
    .frameLocator('iframe[title="Working page preview"]')
    .locator("img.owner-image");
  await restoredImage.waitFor();
  assert.equal(await restoredImage.getAttribute("src"), backup.assets.images[id]);
  await destination.reload({ waitUntil: "networkidle" });
  assert.equal(
    await destination
      .frameLocator('iframe[title="Working page preview"]')
      .locator("img.owner-image")
      .getAttribute("src"),
    backup.assets.images[id],
  );
  await destination.getByRole("link", { name: "My designs", exact: true }).click();
  await destination.getByLabel("Library backup JSON file").setInputFiles({
    name: "focus-design-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await destination
    .getByRole("status")
    .filter({ hasText: "No duplicate designs were added." })
    .waitFor();
  const afterReopen = await destination.evaluate(() =>
    JSON.parse(localStorage.getItem("refraction:library:v1")),
  );
  assert.equal(afterReopen.entries.length, 1);
  assert.equal(afterReopen.entries[0].versions.length, backup.entries[0].versions.length);
  await destination.setViewportSize({ width: 320, height: 812 });
  assert.equal(await destination.evaluate(() => document.documentElement.scrollWidth), 320);
  await destination.screenshot({
    path: artifactPath("library-transfer-mobile.png"),
    fullPage: true,
  });

  // Simulate damaged browser storage only inside this isolated test context.
  const damaged = '{"version":1,"entries":[{"id":"original-work"';
  await destination.evaluate(
    (value) => localStorage.setItem("refraction:library:v1", value),
    damaged,
  );
  await destination.goto(new URL("/", url).href, { waitUntil: "networkidle" });
  await destination.waitForFunction(() => {
    try {
      return JSON.parse(localStorage.getItem("refraction:library:v1")).entries.length === 1;
    } catch {
      return false;
    }
  });
  await destination.getByRole("link", { name: "My designs", exact: true }).click();
  await destination.getByRole("heading", { name: "Original library data preserved (1)" }).waitFor();
  const recoveryDownload = destination.waitForEvent("download");
  await destination
    .getByRole("button", { name: "Download preserved library data 1", exact: true })
    .click();
  assert.equal(await readFile(await (await recoveryDownload).path(), "utf8"), damaged);
  await destination.reload({ waitUntil: "networkidle" });
  await destination.getByRole("heading", { name: "Original library data preserved (1)" }).waitFor();
  assert.equal(await destination.evaluate(() => document.documentElement.scrollWidth), 320);
  await destination.screenshot({
    path: artifactPath("library-recovery-mobile.png"),
    fullPage: true,
  });

  // Recovery also works without a Studio autosave first: preserve the damaged
  // library, then restore the valid downloaded backup through the public UI.
  const secondDamage = "{another-original-library";
  await destination.evaluate(
    (value) => localStorage.setItem("refraction:library:v1", value),
    secondDamage,
  );
  await destination.reload({ waitUntil: "networkidle" });
  await destination.getByRole("heading", { name: "Original library data preserved (2)" }).waitFor();
  assert.equal(
    await destination.evaluate(() => localStorage.getItem("refraction:library:v1")),
    secondDamage,
  );
  await destination.getByLabel("Library backup JSON file").setInputFiles({
    name: "focus-design-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await destination.getByRole("status").filter({ hasText: "Restored 1 design" }).waitFor();
  const retained = await destination.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("refraction:library:v1:recovery:"))
      .map((key) => localStorage.getItem(key)),
  );
  assert.deepEqual(retained.sort(), [damaged, secondDamage].sort());

  // Deterministic quota fault: only recovery-copy writes fail, while the live
  // Studio save can succeed. This exercises the existing persistence warning.
  const blocked = await browser.newPage({
    viewport: { width: 320, height: 812 },
    acceptDownloads: true,
  });
  activePage = blocked;
  blocked.on("pageerror", (error) => errors.push(error.message));
  await blocked.addInitScript(
    ({ damaged, studio }) => {
      if (window !== window.top) return;
      if (!sessionStorage.getItem("focus:recovery-test-seeded")) {
        localStorage.setItem("refraction:library:v1", damaged);
        localStorage.setItem("refraction:v1", JSON.stringify(studio));
        sessionStorage.setItem("focus:recovery-test-seeded", "true");
      }
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("refraction:library:v1:recovery:"))
          throw new DOMException("Test quota", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
      window.restoreTestStorage = () => {
        Storage.prototype.setItem = setItem;
      };
    },
    {
      damaged,
      studio: {
        ...backup.entries[0].state,
        page: { ...backup.entries[0].state.page, imageId: null },
      },
    },
  );
  await blocked.goto(new URL("/", url).href, { waitUntil: "networkidle" });
  await blocked.getByRole("alert").filter({ hasText: "My designs could not be updated" }).waitFor();
  assert.equal(
    await blocked.evaluate(() => localStorage.getItem("refraction:library:v1")),
    damaged,
  );
  await blocked.getByRole("link", { name: "My designs", exact: true }).click();
  await blocked.getByRole("alert").filter({ hasText: "could not keep a recovery copy" }).waitFor();
  const blockedDownload = blocked.waitForEvent("download");
  await blocked
    .getByRole("button", { name: "Download original library data", exact: true })
    .click();
  assert.equal(await readFile(await (await blockedDownload).path(), "utf8"), damaged);
  assert.equal(await blocked.evaluate(() => document.documentElement.scrollWidth), 320);
  await blocked.getByLabel("Library backup JSON file").setInputFiles({
    name: "focus-design-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await blocked
    .getByRole("alert")
    .filter({ hasText: "could not keep a recovery copy" })
    .last()
    .waitFor();
  assert.equal(
    await blocked.evaluate(() => localStorage.getItem("refraction:library:v1")),
    damaged,
  );
  await blocked.evaluate(() => window.restoreTestStorage());
  await blocked.getByRole("button", { name: "Try reading library again", exact: true }).click();
  await blocked.getByRole("heading", { name: "Original library data preserved (1)" }).waitFor();
  await blocked.getByLabel("Library backup JSON file").setInputFiles({
    name: "focus-design-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await blocked.getByRole("status").filter({ hasText: "Restored 1 design" }).waitFor();

  // A copy's still-visible Undo must not erase a backup restored afterward.
  const undoContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const undoPage = await undoContext.newPage();
  activePage = undoPage;
  undoPage.on("pageerror", (error) => errors.push(error.message));
  await undoPage.goto(new URL("/library", url).href, { waitUntil: "networkidle" });
  await undoPage.getByLabel("Library backup JSON file").setInputFiles({
    name: "original.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await undoPage.getByRole("status").filter({ hasText: "Restored 1 design" }).waitFor();
  await undoPage.getByRole("button", { name: "Make a copy", exact: true }).click();
  await undoPage.getByRole("button", { name: "Undo", exact: true }).waitFor();
  const laterBackup = structuredClone(backup);
  laterBackup.entries[0].id = "later-restored-project";
  laterBackup.entries[0].state.libraryId = "later-restored-project";
  laterBackup.entries[0].title = "Later restored project";
  await undoPage.getByLabel("Library backup JSON file").setInputFiles({
    name: "later.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(laterBackup)),
  });
  await undoPage.waitForFunction(
    () => JSON.parse(localStorage.getItem("refraction:library:v1")).entries.length === 3,
  );
  const afterLaterRestore = await undoPage.evaluate(() =>
    localStorage.getItem("refraction:library:v1"),
  );
  await undoPage.getByRole("button", { name: "Undo", exact: true }).click();
  assert.ok(
    (await undoPage.evaluate(() => localStorage.getItem("refraction:library:v1"))) ===
      afterLaterRestore,
    "An old Undo must preserve the later restored design",
  );
  await undoPage
    .getByText(
      "Your library changed after that action. Undo was not applied; your current designs have been kept.",
      { exact: true },
    )
    .waitFor();
  await undoPage.getByRole("button", { name: "Undo", exact: true }).waitFor({ state: "detached" });
  await undoPage.getByRole("button", { name: "Make a copy", exact: true }).first().click();
  await undoPage.waitForFunction(
    () => JSON.parse(localStorage.getItem("refraction:library:v1")).entries.length === 4,
  );
  await undoPage.getByRole("button", { name: "Undo", exact: true }).click();
  assert.ok(
    (await undoPage.evaluate(() => localStorage.getItem("refraction:library:v1"))) ===
      afterLaterRestore,
    "An immediate Undo must still restore the exact prior library",
  );

  // The Brands page uses the same guard. A restore in another tab must survive
  // its Add-a-website toast's Undo, without a later cloud undo being triggered.
  const brandsContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const brandsPage = await brandsContext.newPage();
  activePage = brandsPage;
  brandsPage.on("pageerror", (error) => errors.push(error.message));
  await brandsPage.goto(new URL("/library", url).href, { waitUntil: "networkidle" });
  await brandsPage.getByLabel("Library backup JSON file").setInputFiles({
    name: "original.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await brandsPage.getByRole("status").filter({ hasText: "Restored 1 design" }).waitFor();
  await brandsPage.goto(new URL("/brands", url).href, { waitUntil: "networkidle" });
  await brandsPage.getByRole("button", { name: "Add a website", exact: true }).click();
  await brandsPage.getByRole("button", { name: "Undo", exact: true }).waitFor();
  const laterTab = await brandsPage.context().newPage();
  laterTab.on("pageerror", (error) => errors.push(error.message));
  await laterTab.goto(new URL("/library", url).href, { waitUntil: "networkidle" });
  await laterTab.getByLabel("Library backup JSON file").setInputFiles({
    name: "later.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(laterBackup)),
  });
  await laterTab.waitForFunction(
    () => JSON.parse(localStorage.getItem("refraction:library:v1")).entries.length === 3,
  );
  const afterOtherTabRestore = await laterTab.evaluate(() =>
    localStorage.getItem("refraction:library:v1"),
  );
  await brandsPage.getByRole("button", { name: "Undo", exact: true }).click();
  assert.ok(
    (await brandsPage.evaluate(() => localStorage.getItem("refraction:library:v1"))) ===
      afterOtherTabRestore,
    "An old Brands Undo must preserve a restore in another tab",
  );
  await brandsPage
    .getByText(
      "Your library changed after that action. Undo was not applied; your current designs have been kept.",
      { exact: true },
    )
    .waitFor();
  await brandsPage.getByRole("button", { name: "Add a website", exact: true }).click();
  await brandsPage
    .getByText(
      "Your library changed after this view was loaded. The change was not applied. Reload the library and try again.",
      { exact: true },
    )
    .waitFor();
  assert.ok(
    (await brandsPage.evaluate(() => localStorage.getItem("refraction:library:v1"))) ===
      afterOtherTabRestore,
    "A stale Brands save must preserve work from another tab",
  );

  const staleLibraryTab = await undoPage.context().newPage();
  staleLibraryTab.on("pageerror", (error) => errors.push(error.message));
  await staleLibraryTab.goto(new URL("/library", url).href, { waitUntil: "networkidle" });
  await undoPage.getByRole("button", { name: "Make a copy", exact: true }).first().click();
  await undoPage.waitForFunction(
    () => JSON.parse(localStorage.getItem("refraction:library:v1")).entries.length === 4,
  );
  const latestCopy = await undoPage.evaluate(() => localStorage.getItem("refraction:library:v1"));
  await staleLibraryTab.getByRole("button", { name: "Make a copy", exact: true }).first().click();
  await staleLibraryTab
    .getByText(
      "Your library changed after this view was loaded. The change was not applied. Reload the library and try again.",
      { exact: true },
    )
    .waitFor();
  assert.ok(
    (await staleLibraryTab.evaluate(() => localStorage.getItem("refraction:library:v1"))) ===
      latestCopy,
    "A stale Library save must preserve work from another tab",
  );
  await undoPage.getByRole("button", { name: "Make a copy", exact: true }).first().click();
  await undoPage.waitForFunction(
    () => JSON.parse(localStorage.getItem("refraction:library:v1")).entries.length === 5,
  );
  const latestBackupDownload = staleLibraryTab.waitForEvent("download");
  await staleLibraryTab.getByRole("button", { name: "Back up library", exact: true }).click();
  const latestBackup = JSON.parse(
    await readFile(await (await latestBackupDownload).path(), "utf8"),
  );
  assert.equal(
    latestBackup.entries.length,
    5,
    "A backup must include designs saved in another tab before the download starts",
  );
  assert.deepEqual(errors, []);
  const report = {
    date: new Date().toISOString(),
    target: url,
    browser: browserName,
    outcome: "passed",
    freshBrowserRestore: true,
    actualImageCount: Object.keys(backup.assets.images).length,
    versionsWithImages: historical.length,
    repeatImportNoDuplicate: true,
    repeatAfterOpenReloadNoDuplicate: true,
    openDoesNotAddVersion: true,
    malformedFileLeavesLibraryUnchanged: true,
    restoredImageMatches: true,
    damagedLibraryPreservedBeforeAutosave: true,
    recoveryDownloadMatchesOriginal: true,
    recoveryCopiesDeduplicated: true,
    backupRestoresDamagedLibrary: true,
    recoveryQuotaFailurePreservesOriginal: true,
    blockedRecoveryDownloadMatchesOriginal: true,
    recoveryRetrySucceeds: true,
    staleCopyUndoPreservesLaterRestore: true,
    immediateCopyUndoWorks: true,
    staleBrandUndoPreservesOtherTabRestore: true,
    staleLibraryAndBrandsWritesPreserveOtherTabChanges: true,
    libraryBackupIncludesLatestOtherTabChanges: true,
    mobileWidth: 320,
    pageErrors: errors,
  };
  await writeFile(
    artifactPath("LIBRARY-TRANSFER-BROWSER.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (error) {
  await activePage
    ?.screenshot({ path: artifactPath("library-transfer-failure.png"), fullPage: true })
    .catch(() => {});
  await writeFile(
    artifactPath("LIBRARY-TRANSFER-BROWSER.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        target: url,
        browser: browserName,
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error),
        pageErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  await browser.close();
}
