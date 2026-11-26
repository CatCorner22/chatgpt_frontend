// Exercise the Garden shortcut, real layout previews, and downloaded pages in a disposable browser.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";
import { useLoopbackSession } from "./fixtures/saved-studio.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1", "Use a disposable loopback Focus build.");
assert.equal(origin.protocol, "http:");
const layouts = new URL("/layouts", origin).href;
const studio = new URL("/?view=studio", origin).href;
const names = ["Studio", "Editorial", "Product", "Comparison", "Showcase", "Journal"];
const ownerId = "layout-browser-fixture";
const ownerPrefix = "focus:owner:v1:" + encodeURIComponent("sites:" + ownerId) + ":";
const keys = {
  draft: ownerPrefix + "refraction:v1",
  library: ownerPrefix + "refraction:library:v1",
  garden: ownerPrefix + "focus:garden:v1",
};
const browser = await launchTestBrowser();
const context = await browser.newContext({
  acceptDownloads: true,
  reducedMotion: "reduce",
  serviceWorkers: "block",
  viewport: { width: 1280, height: 900 },
});
const errors = [];
context.setDefaultTimeout(15_000);
context.on("page", (p) => p.on("pageerror", (error) => errors.push(error.message)));
await context.routeWebSocket("**/*", () => {});
await context.route("**/*", (route) =>
  new URL(route.request().url()).origin === origin.origin ? route.continue() : route.abort(),
);
const page = await context.newPage();
const button = (name) => page.getByRole("button", { name, exact: true });
const layout = (name) => page.getByRole("radio", { name, exact: true });
const frame = (name, viewport = "desktop") =>
  page.frameLocator(`iframe[title="${name} layout preview on ${viewport}"]`);
const store = (name) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), keys[name]);
const snapshot = () =>
  page.evaluate((keys) => Object.values(keys).map((key) => localStorage.getItem(key)), keys);
async function download(name) {
  const downloading = page.waitForEvent("download");
  await button(name).click();
  return readFile(await (await downloading).path());
}

async function assertExport(name, headline, chosenPreview) {
  const editor = page.getByTitle("Working page preview");
  await editor
    .contentFrame()
    .locator("body." + name.toLowerCase())
    .waitFor();
  const rendered = await editor.getAttribute("srcdoc");
  const html = (await download("Download working HTML")).toString();
  assert.equal(html, rendered, name + " export diverged from Studio");
  if (chosenPreview)
    assert.equal(html, chosenPreview, name + " export diverged from the selected layout preview");
  assert.ok(html.includes(headline));
  assert.doesNotMatch(html, /Reserve a place for your whole group/);
  const zip = await JSZip.loadAsync(await download("Download page ZIP"));
  const css = await zip.file("styles.css").async("string");
  const linked = await zip.file("index.html").async("string");
  assert.equal(
    linked.replace(
      '<link rel="stylesheet" href="./styles.css">',
      () => "<style>" + css + "</style>",
    ),
    html,
  );
}

try {
  await useLoopbackSession(page, origin, ownerId);
  await page.goto(origin.href);
  const shortcut = page.getByRole("link", { name: /Browse designer layouts/i });
  const newGoal = page.getByRole("radio", { name: "New app or website", exact: true });
  await newGoal.check();
  const briefMode = page.getByRole("checkbox", { name: "Keep it brief" });
  await briefMode.uncheck();
  const before = await snapshot();
  await shortcut.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(layouts);
  await layout("Studio").waitFor();
  await page.goBack();
  await shortcut.waitFor();
  assert.equal(await newGoal.isChecked(), true);
  assert.equal(await briefMode.isChecked(), false);
  assert.deepEqual(await snapshot(), before);
  await shortcut.click();

  let sampleHeadline;
  for (const name of names) {
    await layout(name).check();
    const sample = frame(name);
    await sample.locator("body." + name.toLowerCase() + " h1").waitFor();
    sampleHeadline ??= await sample.locator("h1").innerText();
    assert.equal(await sample.locator("h1").innerText(), sampleHeadline);
  }
  const themes = page.getByRole("combobox", { name: "Theme", exact: true });
  const themeLabels = await themes.getByRole("option").allTextContents();
  assert.equal(themeLabels.length, 50, "49 gallery themes plus the current/sample choice");
  await themes.selectOption({ label: "Smoky Mountain Autumn" });
  assert.equal(await layout("Journal").isChecked(), true);
  await button("Phone").click();
  const phone = frame("Journal", "phone");
  await phone.getByRole("heading", { name: sampleHeadline, exact: true }).waitFor();
  assert.equal(await phone.locator("body").evaluate(() => innerWidth), 320);
  await page.setViewportSize({ width: 320, height: 850 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= 320);
  await button("Try tricky content").click();
  await phone.getByRole("heading", { level: 1, name: /^A weekend workshop/ }).waitFor();
  assert.equal(await phone.locator(".hero img").count(), 0);
  await page.getByText(/^At 320 px,/).waitFor();
  assert.equal(await button("Use this layout").isDisabled(), true);
  await button("Try tricky content").click();
  await phone.getByRole("heading", { name: sampleHeadline, exact: true }).waitFor();
  assert.deepEqual(await snapshot(), before, "Browsing changed stored work");
  await page.setViewportSize({ width: 1280, height: 900 });
  const firstPreview = await phone.owner().getAttribute("srcdoc");
  await button("Use this layout").click();
  await page.waitForURL(studio);
  await assertExport("Journal", sampleHeadline, firstPreview);

  // Put actual owner copy into the editor; every subsequent preview and file must preserve it.
  const mine = "Handmade notebooks at the riverside bindery";
  await button("Edit the page’s words").click();
  await page.getByLabel("Headline", { exact: true }).filter({ visible: true }).fill(mine);
  await page
    .getByTitle("Working page preview")
    .contentFrame()
    .getByRole("heading", { name: mine })
    .waitFor();
  const photoAlt = "The bindery’s linen-bound pocket notebook";
  const photoBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByText("Add your own image", { exact: true }).click();
  await page.getByLabel("Describe the image", { exact: true }).fill(photoAlt);
  await page
    .locator("#page-image")
    .setInputFiles({ name: "notebook.png", mimeType: "image/png", buffer: photoBytes });
  await page
    .getByTitle("Working page preview")
    .contentFrame()
    .getByRole("img", { name: photoAlt })
    .waitFor();
  await page.goto(layouts);
  const original = await store("draft");
  assert.equal(original.content.headline, mine);
  assert.equal(original.page.composition, "journal");
  assert.ok(original.libraryId);
  const source = await snapshot();
  await layout("Comparison").check();
  await frame("Comparison").getByRole("heading", { name: mine }).waitFor();
  await frame("Comparison").getByRole("img", { name: photoAlt }).waitFor();
  await themes.selectOption({ label: "Smoky Mountain Autumn" });
  await button("Try tricky content").click();
  await frame("Comparison")
    .getByRole("link", { name: "Reserve a place for your whole group" })
    .waitFor();
  assert.equal(await frame("Comparison").getByRole("img", { name: photoAlt }).count(), 0);
  assert.deepEqual(await snapshot(), source);
  assert.equal(await button("Start a separate copy").isDisabled(), true);
  await button("Try tricky content").click();
  await frame("Comparison").getByRole("img", { name: photoAlt }).waitFor();
  const copyPreview = await frame("Comparison").owner().getAttribute("srcdoc");
  await button("Start a separate copy").click();
  await page.waitForURL(studio);
  await page
    .getByTitle("Working page preview")
    .contentFrame()
    .locator("body.comparison h1")
    .waitFor();
  await page.reload();
  await assertExport("Comparison", mine, copyPreview);
  const copy = await store("draft");
  assert.notEqual(copy.libraryId, original.libraryId);
  assert.equal(copy.page.imageId, original.page.imageId);
  assert.equal(copy.page.imageAlt, photoAlt);
  await page
    .getByTitle("Working page preview")
    .contentFrame()
    .getByRole("img", { name: photoAlt })
    .waitFor();
  assert.deepEqual(copy.content, original.content);
  const savedDesigns = (await store("library")).entries;
  const archived = savedDesigns.find((item) => item.id === original.libraryId);
  assert.equal(archived.state.page.composition, "journal");
  assert.deepEqual(archived.state.content, original.content);

  for (const name of ["Editorial", "Product", "Studio", "Showcase"]) {
    await page.goto(layouts);
    await layout(name).check();
    await frame(name).getByRole("heading", { name: mine }).waitFor();
    const selectedPreview = await frame(name).owner().getAttribute("srcdoc");
    await button("Apply to my design").click();
    await page.waitForURL(studio);
    await page
      .getByTitle("Working page preview")
      .contentFrame()
      .locator("body." + name.toLowerCase() + " h1")
      .waitFor();
    await page.reload();
    await assertExport(name, mine, selectedPreview);
    const applied = await store("draft");
    assert.equal(applied.libraryId, copy.libraryId);
    assert.deepEqual(applied.content, original.content);
    assert.equal(applied.page.composition, name.toLowerCase());
  }
  assert.equal(
    (await store("library")).entries.find((entry) => entry.id === original.libraryId).state.page
      .composition,
    "journal",
  );

  // A project that restyles someone’s existing app can only become a separate website copy here.
  await page.getByRole("radio", { name: /^Restyle my existing site or app/ }).check();
  await page.goto(layouts);
  const restyle = await store("draft");
  assert.equal(restyle.integration, "existing");
  await layout("Editorial").check();
  const separateWebsite = button("Start a separate website copy");
  await separateWebsite.waitFor();
  assert.equal(await button("Apply to my design").count(), 0);
  await separateWebsite.click();
  await page.waitForURL(studio);
  await page.getByTitle("Working page preview").waitFor();
  const website = await store("draft");
  assert.notEqual(website.libraryId, restyle.libraryId);
  assert.equal(website.integration, "new");
  const unchanged = (await store("library")).entries.find(
    (entry) => entry.id === restyle.libraryId,
  );
  assert.equal(unchanged.state.integration, "existing");
  assert.equal(unchanged.state.page.composition, "showcase");
  assert.deepEqual(unchanged.state.content, original.content);
  // Force a failed draft write at the final confirmation. The previous website must still reopen.
  await page.goto(layouts);
  await layout("Product").check();
  const beforeFailure = await store("draft");
  await page.evaluate((key) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (this === localStorage && k === key)
        throw new DOMException("Test storage is full", "QuotaExceededError");
      return setItem.call(this, k, value);
    };
  }, keys.draft);
  await button("Apply to my design").click();
  await page
    .getByRole("alert")
    .filter({ has: button("Reload saved draft") })
    .waitFor();
  assert.equal(page.url(), layouts);
  assert.deepEqual(await store("draft"), beforeFailure);
  await page.reload();
  await layout("Product").check();
  await button("Apply to my design").click();
  await page.waitForURL(studio);
  await assertExport("Product", mine);
  await page.getByRole("link", { name: "My designs", exact: true }).click();
  const originalCard = page.getByRole("article").filter({
    has: page.getByRole("textbox", { name: "Name for " + archived.title, exact: true }),
  });
  await originalCard.getByRole("button", { name: "Open its Vision" }).click();
  await button("Open design").click();
  const reopened = page.getByTitle("Working page preview").contentFrame();
  await reopened.locator("body.journal").getByRole("heading", { name: mine }).waitFor();
  await reopened.getByRole("img", { name: photoAlt }).waitFor();
  assert.equal((await store("draft")).libraryId, original.libraryId);
  assert.deepEqual(errors, []);
  console.log(
    browserName +
      " passed Garden keyboard/Back, six layouts, 49 themes, phone sizing, preview isolation, copy/apply, reload, and downloaded HTML/ZIP parity.",
  );
} finally {
  await browser.close();
}
