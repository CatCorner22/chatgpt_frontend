/** Restore the supplied art study through Focus, edit it, and open both downloads on a fresh device. */
import { readPreviewDocument } from "./fixtures/preview-source.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1", "Use a disposable loopback Focus instance.");
const directory = "artifacts/editorial-handoff";
await mkdir(directory, { recursive: true });
const fixture = await readFile("public/examples/looking-room.focus.json");
const sample = JSON.parse(fixture);
const saved = sample.entries[0].state;
const sourceImages = sample.assets.images;
const browser = await launchTestBrowser();
try {
  const editor = await browser.newContext({ acceptDownloads: true, reducedMotion: "reduce" });
  const errors = [];
  await editor.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin.origin) return route.abort();
    if (url.pathname === "/api/hosted/session") {
      return route.fulfill({
        json: {
          mode: "hosted",
          user: { id: "editorial-rehearsal", email: null },
          storageAvailable: false,
        },
      });
    }
    return route.continue();
  });
  const source = await editor.newPage();
  source.on("pageerror", (error) => errors.push(error.message));
  await source.goto(new URL("/library", origin).href);
  const sampleResponse = await source.request.get(
    new URL("/examples/looking-room.focus.json", origin).href,
  );
  assert.deepEqual(
    await sampleResponse.body(),
    fixture,
    "The sample available to the owner differs from the checked-in design.",
  );
  await source.getByRole("button", { name: "Restore backup", exact: true }).waitFor();
  await source.getByLabel("Library backup JSON file").setInputFiles({
    name: "looking-room.focus.json",
    mimeType: "application/json",
    buffer: fixture,
  });
  await source.getByRole("button", { name: "Open its Vision" }).click();
  const preview = source.frameLocator('iframe[title="Working page preview"]');
  await preview.getByRole("img", { name: saved.page.relatedStory.imageAlt }).waitFor();
  await source.getByText("Study a two-image editorial example", { exact: true }).click();
  const exampleDownload = source.waitForEvent("download");
  await source.getByRole("link", { name: "Download Looking Room" }).click();
  assert.deepEqual(await readFile(await (await exampleDownload).path()), fixture);
  await source.getByLabel("Story title").fill("A closer look at Red Fuji");
  await source.getByLabel("When do readers see this story?").selectOption("after-intro");
  await preview.locator(".hero + .related-story").waitFor();
  await source.reload();
  await preview.locator(".hero + .related-story").waitFor();
  await source.getByLabel("When do readers see this story?").selectOption("after-article");

  async function download(name) {
    const event = source.waitForEvent("download");
    await source.getByRole("button", { name, exact: true }).click();
    return readFile(await (await event).path());
  }
  const report = [];
  const outputs = new Map();
  for (const composition of ["Editorial", "Journal"]) {
    await source.getByRole("radio", { name: new RegExp("^" + composition) }).check();
    await preview
      .locator("body." + composition.toLowerCase() + " .details-section + .related-story")
      .waitFor();
    const html = await download("Download working HTML");
    const zipBytes = await download("Download page ZIP");
    const zip = await JSZip.loadAsync(zipBytes, { checkCRC32: true });
    const linked = await zip.file("index.html").async("string");
    const css = await zip.file("styles.css").async("string");
    assert.equal(
      html.toString(),
      await readPreviewDocument(source.getByTitle("Working page preview")),
    );
    assert.equal(
      linked.replace(
        '<link rel="stylesheet" href="./styles.css">',
        () => "<style>" + css + "</style>",
      ),
      html.toString(),
    );
    const project = JSON.parse(await zip.file("focus-project.json").async("string"));
    assert.equal(project.embeddedStoryImage.src, sourceImages[saved.page.relatedStory.imageId]);
    outputs.set(composition.toLowerCase() + ".html", html);
    outputs.set(composition.toLowerCase() + ".zip", zipBytes);
    for (const format of ["standalone", "editable"]) {
      const recipient = await browser.newContext({ reducedMotion: "reduce" });
      const page = await recipient.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      // An isolated host exposes only the extracted customer files. All other requests fail.
      const extra = [];
      await recipient.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === "https://focus-recipient.invalid" && url.pathname === "/index.html")
          return route.fulfill({
            body: format === "editable" ? linked : html,
            contentType: "text/html; charset=utf-8",
          });
        if (
          url.origin === "https://focus-recipient.invalid" &&
          url.pathname === "/styles.css" &&
          format === "editable"
        )
          return route.fulfill({ body: css, contentType: "text/css" });
        extra.push(url.href);
        return route.abort();
      });
      await page.goto("https://focus-recipient.invalid/index.html");
      for (const width of [320, 760, 761, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator(".related-story img").scrollIntoViewIfNeeded();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map((i) => i.decode()));
        });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        for (const [selector, image] of [
          [".owner-image", saved.page],
          [".related-story img", saved.page.relatedStory],
        ]) {
          const photo = page.locator(selector);
          assert.equal(await photo.getAttribute("alt"), image.imageAlt);
          assert.equal(await photo.getAttribute("src"), sourceImages[image.imageId]);
          assert.equal(await photo.evaluate((el) => getComputedStyle(el).objectFit), "contain");
          assert.equal(
            await photo.locator("..").locator("figcaption").innerText(),
            image.imageCredit,
          );
        }
        const link = page.getByRole("link", { name: saved.page.relatedStory.title });
        assert.equal(await link.getAttribute("href"), saved.page.relatedStory.url);
        await page.locator("body").click({ position: { x: 1, y: 1 } });
        await page.keyboard.press("Control+Home");
        const tabCount = await page.locator("a[href], summary").count();
        let reached = false;
        for (let i = 0; i < tabCount + 2; i++) {
          await page.keyboard.press("Tab");
          if (await link.evaluate((el) => document.activeElement === el)) {
            reached = true;
            break;
          }
        }
        assert.ok(reached, "The related story must be reachable by keyboard.");
        if (format === "standalone" && width === 1280) {
          await page.evaluate(() => {
            document.activeElement?.blur();
            window.scrollTo({ top: 0, behavior: "instant" });
          });
          outputs.set(
            composition.toLowerCase() + ".png",
            await page.screenshot({ fullPage: true }),
          );
        }
        report.push({ composition, format, width, images: 2, relatedStoryReachedByKeyboard: true });
      }
      assert.deepEqual(extra, []);
      await recipient.close();
    }
  }
  assert.deepEqual(errors, []);
  outputs.set("observations.json", JSON.stringify(report, null, 2));
  for (const [name, bytes] of outputs) await writeFile(join(directory, name), bytes);
  console.log(
    "Two compositions, two downloads and four viewport widths verified against the restored customer design.",
  );
} finally {
  await browser.close();
}
