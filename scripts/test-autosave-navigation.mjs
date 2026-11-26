// Run against a packaged or development Focus app on loopback.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1");
assert.equal(origin.protocol, "http:");
const studio = new URL("/?view=studio", origin).href;
const outside = new URL("/outside-the-studio-fixture", origin).href;
const browser = await launchTestBrowser();

async function withWorkspace(run) {
  const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: true });
  context.setDefaultTimeout(10_000);
  const errors = [];
  context.on("page", (page) => page.on("pageerror", (err) => errors.push(err.message)));
  try {
    await context.routeWebSocket("**/*", () => {});
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin.origin) return route.abort();
      if (url.href === outside)
        return route.fulfill({ contentType: "text/html", body: "<h1>Outside Focus</h1>" });
      if (url.pathname === "/api/hosted/session")
        return route.fulfill({
          json: {
            mode: "hosted",
            user: { id: "autosave-fixture", email: null },
            storageAvailable: false,
          },
        });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(origin.href);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("link", { name: "Work on the page content" }).click();
    await page.waitForURL(studio);
    await page.locator("#brief").waitFor();
    await run(context, page);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

// A tab-specific, reversible storage failure makes exit-time writes observable.
// Only the specified draft write is affected. Session verification and other tabs work normally.
async function pauseDraftWrites(page, draftKey = "refraction:v1") {
  await page.evaluate((draftKey) => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage && (key === draftKey || key.endsWith(":" + draftKey)))
        throw new DOMException("Local test storage is full", "QuotaExceededError");
      return write.call(this, key, value);
    };
    window.resumeDraftWrites = () => {
      Storage.prototype.setItem = write;
      delete window.resumeDraftWrites;
    };
  }, draftKey);
}

async function pendingBrief(page, text) {
  await pauseDraftWrites(page);
  await page.locator("#brief").fill(text);
  await page.getByRole("button", { name: "Download current work" }).waitFor();
}

async function resumeDraftWrites(page) {
  await page.evaluate(() => window.resumeDraftWrites());
}

async function checkExit(method) {
  await withWorkspace(async (context, page) => {
    const text = "Keep the last words before " + method;
    const dialogs = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.accept();
    });
    if (method === "Forward") {
      await page.goto(outside);
      await page.goBack();
      await page.waitForURL(studio);
      await page.locator("#brief").waitFor();
    }
    await pendingBrief(page, text);
    await resumeDraftWrites(page);
    if (method === "Back") {
      await page.goBack();
      await page.getByRole("heading", { name: "Gather your content" }).waitFor();
    } else if (method === "Forward") {
      await page.goForward();
      await page.waitForURL(outside);
      await page.getByRole("heading", { name: "Outside Focus" }).waitFor();
    } else if (method === "internal link") {
      await page.getByRole("link", { name: "Focus home" }).click();
      await page.getByRole("heading", { name: "Gather your content" }).waitFor();
    } else if (method === "document navigation") {
      await page.goto(outside);
    } else if (method === "reload") {
      await page.reload();
    } else if (method === "tab close") {
      const closed = page.waitForEvent("close");
      await page.close({ runBeforeUnload: true });
      await closed;
    }
    const restored = method === "tab close" ? await context.newPage() : page;
    if (method !== "reload") await restored.goto(studio);
    assert.equal(await restored.locator("#brief").inputValue(), text, "Lost edit on " + method);
    assert.deepEqual(dialogs, [], "A recovered save should permit " + method);
  });
}

try {
  await withWorkspace(async (_context, page) => {
    const text = "The last keystroke before Back";
    // Leave in the same input event, without waiting for another render or a timer.
    await page.evaluate(() =>
      window.addEventListener("input", () => history.back(), { once: true }),
    );
    await page.locator("#brief").fill(text);
    await page.getByRole("heading", { name: "Gather your content" }).waitFor();
    await page.goto(studio);
    assert.equal(await page.locator("#brief").inputValue(), text);
  });
  for (const method of [
    "Back",
    "Forward",
    "internal link",
    "document navigation",
    "reload",
    "tab close",
  ])
    await checkExit(method);
  await withWorkspace(async (context, page) => {
    const mine = "My draft while storage is full";
    const theirs = "Newer draft from another tab";
    // Chromium only offers the native unload dialog after user activation.
    await page.locator("#brief").click();
    await pendingBrief(page, mine);
    const unload = page.waitForEvent("dialog", (dialog) => dialog.type() === "beforeunload");
    const reloading = page.evaluate(() => location.reload());
    await (await unload).dismiss();
    await reloading;
    assert.equal(await page.locator("#brief").inputValue(), mine);

    const confirm = page.waitForEvent("dialog", (dialog) => dialog.type() === "confirm");
    const navigating = page.getByRole("link", { name: "Focus home" }).click();
    await (await confirm).dismiss();
    await navigating;
    assert.equal(await page.locator("#brief").inputValue(), mine);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download current work" }).click();
    const backup = JSON.parse(await readFile(await (await downloading).path(), "utf8"));
    assert.equal(backup.brief, mine, "Recovery should include the last unpersisted edit");

    const other = await context.newPage();
    await other.goto(studio);
    await other.locator("#brief").fill(theirs);
    await other.reload();
    assert.equal(await other.locator("#brief").inputValue(), theirs);

    await resumeDraftWrites(page);
    const conflict = page.waitForEvent("dialog", (dialog) => dialog.type() === "confirm");
    const leaving = page.getByRole("link", { name: "Focus home" }).click();
    await (await conflict).dismiss();
    await leaving;
    assert.equal(await page.locator("#brief").inputValue(), mine);
    await other.reload();
    assert.equal(
      await other.locator("#brief").inputValue(),
      theirs,
      "A stale tab overwrote the newer draft",
    );
  });
  await withWorkspace(async (_context, page) => {
    await page.getByRole("link", { name: "Focus home" }).click();
    await page.getByRole("button", { name: "Change starting point" }).click();
    await page.getByRole("button", { name: "Open my journey brief" }).click();
    const question = page.getByLabel("What should someone be able to do?");
    const answer = "Find the pottery workshop and book a first lesson";
    await pauseDraftWrites(page, "focus:garden:journey:v1:unassigned");
    await question.fill(answer);
    await page.getByRole("button", { name: "Retry saving" }).waitFor();
    await resumeDraftWrites(page);
    await page.getByRole("link", { name: "My designs", exact: true }).click();
    await page.waitForURL(new URL("/library", origin).href);
    // The router can update the URL before Firefox finishes displaying the destination.
    await page.getByRole("heading", { name: "Your saved designs" }).waitFor();
    await page.goto(origin.href);
    await page.getByRole("button", { name: "Open my journey brief" }).click();
    assert.equal(await question.inputValue(), answer);

    const target = new URL("/target", origin).href;
    await page.goto(target);
    const platform = page.getByLabel("Where is the project built?");
    await platform.waitFor();
    await pauseDraftWrites(page, "focus:target:v1");
    await platform.selectOption("lovable");
    await page.getByRole("region", { name: "Keep your answers" }).waitFor();
    await resumeDraftWrites(page);
    await page.getByRole("link", { name: "Focus home" }).click();
    await page.waitForURL(origin.href);
    await page.getByRole("button", { name: "Open my journey brief" }).waitFor();
    await page.goto(target);
    assert.equal(await platform.inputValue(), "lovable");
  });

  console.log(
    browserName +
      " saved the final edit across six exits, including browser Back and Forward, and recovered Studio, Garden and Target drafts after storage and cross-tab failures.",
  );
} finally {
  await browser.close();
}
