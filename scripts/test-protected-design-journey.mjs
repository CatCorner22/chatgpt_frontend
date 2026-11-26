import { readPreviewDocument } from "./fixtures/preview-source.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";
import { useLoopbackSession } from "./fixtures/saved-studio.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1");
assert.equal(origin.protocol, "http:");
const directory = `artifacts/protected-design-journey/${browserName}`;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const originals = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
const smoky = originals.find((item) => item.id === "smoky-mountain-autumn");
const inventory = JSON.parse(await readFile("src/test/fixtures/protected-gallery.json", "utf8"));
const protectedArt = JSON.parse(await readFile("src/test/fixtures/protected-artwork.json", "utf8"));
const baseline = inventory.find((item) => item.id === smoky.id);
const name = baseline.name;
const signature = { ...baseline.tokens, ...baseline.runtimeTokenOverrides };
assert.equal(smoky.direction.name, name);
assert.equal(smoky.content.headline, "The ridges in October.");
assert.deepEqual(smoky.extras, baseline.extras);
const copyHeadline = "Walk the ridge at sunrise.";
const browser = await launchTestBrowser();
try {
  await mkdir(directory, { recursive: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  await context.routeWebSocket("**/*", () => {});
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin.origin ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  await useLoopbackSession(page, origin.href, "protected-design-journey");
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  const link = (name) => page.getByRole("link", { name, exact: true });
  const heading = (name) => page.getByRole("heading", { name, exact: true });
  const map = page.getByRole("navigation", { name: "Garden Path steps" });
  const brief = page.getByRole("checkbox", { name: "Keep it brief" });
  const focusIs = (locator) => locator.evaluate((node) => node === document.activeElement);
  async function download(label) {
    const received = page.waitForEvent("download");
    await button(label).click();
    return readFile(await (await received).path());
  }
  async function savedDesigns() {
    return JSON.parse(await download("Back up library")).entries;
  }
  async function openDesign(title, switching = true) {
    const card = page.getByRole("article").filter({
      has: page.getByRole("textbox", { name: "Name for " + title, exact: true }),
    });
    await card.getByRole("button", { name: "Open its Vision", exact: true }).click();
    if (switching) await button("Open design").click();
    await page.getByTitle("Working page preview").waitFor();
  }
  async function checkGardenLesson(isBrief) {
    await heading("Refine the details").waitFor();
    assert.equal(await brief.isChecked(), isBrief);
    const title = heading("Polish comes from relationships");
    if (isBrief) await title.waitFor({ state: "hidden" });
    else await title.waitFor();
    assert.equal(
      await map.locator('[aria-current="step"]').getAttribute("aria-label"),
      "5. Refine the details",
    );
  }
  async function checkExport(headline, radius) {
    const frame = page.getByTitle("Working page preview");
    await frame
      .contentFrame()
      .getByRole("heading", { level: 1, name: headline, exact: true })
      .waitFor();
    const html = (await download("Download working HTML")).toString();
    assert.equal(
      digest(html),
      digest(await readPreviewDocument(frame)),
      "HTML download differs from the Studio preview.",
    );
    const zip = await JSZip.loadAsync(await download("Download page ZIP"));
    const css = await zip.file("styles.css").async("string");
    const index = await zip.file("index.html").async("string");
    const combined = index.replace(
      '<link rel="stylesheet" href="./styles.css">',
      () => "<style>" + css + "</style>",
    );
    assert.equal(
      digest(combined),
      digest(html),
      "ZIP markup and styles differ from the standalone page.",
    );
    assert.ok(
      css.includes("--radius: " + radius + "px;"),
      "Wrong corner radius in the downloaded CSS.",
    );
    assert.match(css, /--bg: #fff9f2;/);
    assert.match(css, /--accent: #883500;/);
    assert.match(css, /Focus Newsreader v1/);
    assert.match(css, /Focus Literata v1/);
    // The editable page ZIP carries the page CSS. The design pack also carries the
    // complete Studio tokens, including Smoky’s decorative second color.
    await button("Design specification & handoff tools").click();
    const designPack = await JSZip.loadAsync(await download("Download design pack"));
    const tokens = JSON.parse(await designPack.file("tokens.json").async("string"));
    assert.deepEqual(tokens, { ...signature, radius });
    const tokenCss = await designPack.file("tokens.css").async("string");
    assert.ok(tokenCss.includes("--color-accent-2: " + signature.accent2 + ";"));
    return html;
  }

  // Enter at the real first page with a blank browser and reach both starting modes.
  await page.goto(origin.href);
  await heading("Where do we start?").waitFor();
  const start = (kind) => page.getByRole("radio", { name: kind + " app or website", exact: true });
  const continueButton = button("Continue");
  const kite = page.getByRole("img", { name: "Reverie walking with her kite" });
  await kite.evaluate((image) => image.decode());
  assert.equal(await kite.getAttribute("src"), "/brand/reverie-kite.webp");
  const kiteResponse = await context.request.get(
    new URL(await kite.getAttribute("src"), origin).href,
  );
  assert.equal(kiteResponse.status(), 200);
  const kiteHash = digest(await kiteResponse.body());
  assert.equal(
    kiteHash,
    protectedArt.find((item) => item.path === "brand/reverie-kite.webp").sha256,
  );
  for (const choice of [
    start("New"),
    start("Existing"),
    continueButton,
    link("Browse designer layouts"),
  ]) {
    const bounds = await choice.boundingBox();
    assert.ok(
      bounds && bounds.y >= 0 && bounds.y + bounds.height <= 844,
      "Starting choices must fit on the first phone screen.",
    );
  }
  await page.screenshot({ path: directory + "/garden-entry.png" });
  await start("Existing").check();
  await continueButton.press("Enter");
  await heading("Gather your content").waitFor();
  await link("Work on the page content").click();
  assert.ok(
    await page.getByRole("radio", { name: /^Restyle my existing site or app/ }).isChecked(),
  );
  await link("Focus home").click();
  await button("Change starting point").click();
  await start("New").check();

  // The one-click shortcut and the first four map stops are reachable from Continue, in order.
  await continueButton.focus();
  await page.keyboard.press("Tab");
  assert.ok(await focusIs(link("Browse designer layouts")));
  for (const stop of [
    "1. Choose your goal",
    "2. Gather your content",
    "3. Arrange the page",
    "4. Pick a visual direction",
  ]) {
    await page.keyboard.press("Tab");
    assert.ok(
      await focusIs(map.getByRole("button", { name: stop, exact: true })),
      "Tab should reach " + stop,
    );
  }
  await page.keyboard.press("Enter");
  await heading("Pick a visual direction").waitFor();
  assert.ok(await focusIs(heading("Pick a visual direction")));
  await link("Explore design directions").click();
  assert.ok(await page.getByRole("radio", { name: /^A new site or app/ }).isChecked());

  // Start from the shipped gallery. Skipping each quick question preserves its design.
  await page.getByText("Or browse the design collection", { exact: true }).click();
  await page.getByRole("button", { name: /^Browse all \d+ designs$/ }).click();
  await button("Warm and nostalgic").click();
  await page.getByRole("searchbox", { name: "Search designs" }).fill(name);
  await page.getByRole("button", { name: /^Open Smoky Mountain Autumn:/ }).click();
  for (let question = 0; question < 3; question++) await button("Skip").click();
  await button("Create my Vision").click();
  const originalHtml = await checkExport(smoky.content.headline, signature.radius);
  await link("My designs").click();
  const before = await savedDesigns();
  assert.equal(before.length, 1);
  const [original] = before;
  assert.equal(original.title, name);
  assert.equal(original.state.direction, name);
  assert.deepEqual(original.state.tokens, signature);
  assert.deepEqual(original.state.content, smoky.content);
  assert.deepEqual(original.state.page, {
    composition: "studio",
    actionUrl: "",
    imageId: null,
    imageAlt: "",
  });

  await button("Make a copy").click();
  const copies = await savedDesigns();
  assert.equal(copies.length, 2);
  const copy = copies.find((entry) => entry.id !== original.id);
  assert.equal(copy.title, "Copy of " + name);
  assert.equal(copy.state.libraryId, copy.id);
  await openDesign(copy.title);
  await button("Edit the page’s words").click();
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill(copyHeadline);
  await page.getByRole("radio", { name: /^Journal / }).check();

  await link("Focus home").click();
  await map.getByRole("button", { name: "5. Refine the details" }).press("Enter");
  await link("Buttons and corners").press("Enter");
  const fineTune = page.getByText("Fine-tune buttons and corners", { exact: true });
  const radius = page.getByRole("slider", { name: /Corner roundness/ });
  await fineTune.press("Enter");
  assert.equal(await radius.inputValue(), String(signature.radius));
  await radius.press("ArrowRight");
  const copyRadius = signature.radius + 1;

  // Learning preferences and map navigation must never edit the current work.
  await link("My designs").click();
  const edited = await savedDesigns();
  const copyState = edited.find((entry) => entry.id === copy.id).state;
  assert.equal(copyState.content.headline, copyHeadline);
  assert.equal(copyState.page.composition, "journal");
  assert.deepEqual(copyState.tokens, { ...signature, radius: copyRadius });
  await link("Focus home").click();
  await checkGardenLesson(true);
  for (const mode of [false, true]) {
    await brief.press("Space");
    await checkGardenLesson(mode);
    await page.reload();
    await checkGardenLesson(mode);
    await link("Buttons and corners").press("Enter");
    await heading("Buttons and corners").waitFor();
    assert.equal(await brief.isChecked(), mode);
    await fineTune.press("Enter");
    assert.equal(await page.getByLabel("Button treatment").inputValue(), "solid");
    assert.equal(await radius.inputValue(), String(copyRadius));
    await link("Focus home").click();
    await checkGardenLesson(mode);
  }
  await link("My designs").click();
  const afterGarden = await savedDesigns();
  for (const prior of edited) {
    const restored = afterGarden.find((entry) => entry.id === prior.id);
    assert.deepEqual(
      restored.state,
      prior.state,
      "Garden navigation and learning must preserve saved design state.",
    );
  }

  await openDesign(copy.title, false);
  await page.reload();
  const copyHtml = await checkExport(copyHeadline, copyRadius);
  assert.match(copyHtml, /class="journal"/);
  assert.notEqual(digest(copyHtml), digest(originalHtml));
  await link("My designs").click();
  const finalEntries = await savedDesigns();
  assert.equal(finalEntries.length, 2);
  const finalOriginal = finalEntries.find((entry) => entry.id === original.id);
  assert.deepEqual(finalOriginal.state, original.state);
  assert.deepEqual(finalOriginal.versions, original.versions);
  await openDesign(original.title);
  assert.equal(
    digest(await checkExport(smoky.content.headline, signature.radius)),
    digest(originalHtml),
  );
  assert.deepEqual(errors, []);
  const evidence = {
    browser: browser.version(),
    viewport: { width: 390, height: 844 },
    kiteHash,
    galleryId: smoky.id,
    originalId: original.id,
    copyId: copy.id,
    originalHtmlSha256: digest(originalHtml),
    copyHtmlSha256: digest(copyHtml),
  };
  await writeFile(directory + "/results.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(
    browserName +
      " passed the Garden keyboard, both lesson modes, Smoky gallery, copy, reopen and export checks.",
  );
} finally {
  await browser.close();
}
