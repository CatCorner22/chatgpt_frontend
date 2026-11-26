import { readPreviewDocument } from "./fixtures/preview-source.mjs";
import { openSavedStudio } from "./fixtures/saved-studio.mjs";
import { launchTestBrowser, browserName } from "./browser-engine.mjs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";
const target = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const dir = "artifacts/authored-pages";
await mkdir(dir, { recursive: true });
const directions = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
const design = directions.find((d) => d.id === "garden-ledger");
assert.ok(design, "The authored-page test direction must exist.");
const testTokens = {
  ...design.direction.tokens,
  headingFont: "Instrument Serif",
  bodyFont: "Instrument Sans",
};
const exampleContent = {
  brand: "Fieldwork / Example studio",
  headline: "Everyday objects. A little more considered.",
  sub: "Example content for a ceramics studio. Replace this with your actual offer before publishing.",
  cta: "Visit the studio",
  features: [
    {
      title: "Objects for everyday use",
      body: "Describe your actual collection, materials, and care information in your own words.",
    },
    {
      title: "A closer look at the process",
      body: "Explain how you work, with details that a potential customer needs to make a decision.",
    },
    {
      title: "Find the right piece",
      body: "Give visitors a clear next step and a genuine way to contact you.",
    },
  ],
  quote: "",
};
const browser = await launchTestBrowser();
const pageErrors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(20_000);
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const url = await openSavedStudio(page, target, {
    brief: "Example ceramics studio",
    content: exampleContent,
    tokens: testTokens,
    direction: "Garden Ledger",
    libraryId: "authored-browser-fixture",
  });
  await page.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
  const mainAction = page.getByLabel("Where should the main action lead?");
  const privateMarker = "focus-browser-private-fixture";
  const privateLink = `https://example.com/studio?access_token=${privateMarker}`;
  await mainAction.fill(privateLink);
  await page
    .getByRole("button", { name: "Download working HTML" })
    .and(page.locator(":disabled"))
    .waitFor();
  assert.equal(await page.getByRole("button", { name: "Download page ZIP" }).isDisabled(), true);
  assert.equal(await mainAction.inputValue(), privateLink);
  assert.ok(
    !(await readPreviewDocument(page.getByTitle("Working page preview"))).includes(privateMarker),
  );
  await mainAction.fill("https://example.com/studio");
  const compare = page.getByRole("button", { name: "Compare layouts with your content" });
  await compare.click();
  await page.getByLabel("What does your visitor want to do?").selectOption("read");
  await page
    .frameLocator('iframe[title="Editorial comparison on phone"]')
    .getByRole("heading", { name: exampleContent.headline })
    .waitFor();
  const journalPhone = page.frameLocator('iframe[title="Journal comparison on phone"]');
  await journalPhone.getByRole("heading", { name: exampleContent.headline }).waitFor();
  assert.equal(
    await journalPhone.locator(".journal-index a").count(),
    exampleContent.features.length,
  );
  await page.getByLabel("Compare", { exact: true }).selectOption("second");
  const journalDesktop = page.frameLocator('iframe[title="Journal comparison on desktop"]');
  await journalDesktop.getByRole("heading", { name: exampleContent.headline }).waitFor();
  for (const [frame, expectedWidth] of [
    [journalPhone, 320],
    [journalDesktop, 1024],
  ]) {
    assert.equal(await frame.locator("body").evaluate(() => innerWidth), expectedWidth);
    assert.equal(
      await frame.locator(".hero-actions a").getAttribute("href"),
      "https://example.com/studio",
    );
  }
  const comparison = page.locator(".layout-comparison");
  await comparison.screenshot({ path: `${dir}/layout-comparison.png` });
  await page.setViewportSize({ width: 320, height: 850 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= 320);
  assert.equal(await journalDesktop.locator("body").evaluate(() => innerWidth), 1024);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const compared = await readPreviewDocument(page.getByTitle("Journal comparison on desktop"));
  await page.getByRole("button", { name: "Use Journal layout" }).click();
  await page.getByRole("button", { name: "Using Journal" }).waitFor();
  await compare.click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /^Journal/ }).waitFor();
  assert.equal(await page.getByRole("radio", { name: /^Journal/ }).isChecked(), true);
  assert.equal(await readPreviewDocument(page.getByTitle("Working page preview")), compared);
  const results = [];
  for (const composition of ["Studio", "Editorial", "Product", "Showcase", "Journal"]) {
    await page.getByRole("radio", { name: new RegExp("^" + composition) }).check();
    const ready = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download working HTML", exact: true }).click();
    const downloaded = await ready;
    const html = await readFile(await downloaded.path(), "utf8");
    const iframeHtml = await readPreviewDocument(page.getByTitle("Working page preview"));
    assert.equal(html, iframeHtml, "Preview and download must contain the same document.");
    if (composition === "Journal")
      assert.equal(html, compared, "The chosen comparative preview must travel intact.");
    assert.ok(html.includes("https://example.com/studio"));
    assert.ok(!/<script\b/i.test(html));
    const file = `${dir}/${composition.toLowerCase()}.html`;
    await writeFile(file, html);
    const output = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    output.on("pageerror", (error) => pageErrors.push(error.message));
    const requests = [];
    output.on("request", (r) => {
      if (!r.url().startsWith("data:")) requests.push(r.url());
    });
    await output.setContent(html, { waitUntil: "load" });
    const loadedFonts = await output.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((face) => ({
        family: face.family.replace(/^['"]|['"]$/g, ""),
        status: face.status,
        weight: face.weight,
      }));
    });
    for (const family of ["Focus Instrument Serif v1", "Focus Instrument Sans v1"]) {
      assert.ok(
        loadedFonts.some((face) => face.family === family && face.status === "loaded"),
        `${family} must load from the delivered document, not an installed fallback.`,
      );
    }
    assert.equal(
      loadedFonts.find((face) => face.family === "Focus Instrument Serif v1").weight,
      "400",
    );
    assert.deepEqual(requests, [], "The authored page must load without remote assets.");
    await output.screenshot({
      path: `${dir}/${composition.toLowerCase()}-desktop.png`,
      fullPage: true,
    });
    if (composition === "Product") {
      const disclosure = output.locator("details").nth(1);
      await disclosure.locator("summary").focus();
      await output.keyboard.press("Enter");
      assert.equal(await disclosure.getAttribute("open"), "");
    }
    if (composition === "Showcase" || composition === "Journal") {
      const links = output
        .getByRole("navigation", {
          name: composition === "Showcase" ? "Explore this page" : "On this page",
          exact: true,
        })
        .getByRole("link");
      assert.equal(await links.count(), exampleContent.features.length);
      const destination = await links.first().getAttribute("href");
      await links.first().focus();
      await output.keyboard.press("Enter");
      await output.waitForFunction((hash) => location.hash === hash, destination);
      assert.equal(await output.evaluate(() => document.activeElement?.id), destination.slice(1));
    }
    await output.setViewportSize({ width: 320, height: 850 });
    assert.equal(await output.evaluate(() => document.documentElement.scrollWidth), 320);
    await output.addStyleTag({
      content:
        "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}",
    });
    assert.equal(await output.evaluate(() => document.documentElement.scrollWidth), 320);
    await output.screenshot({
      path: `${dir}/${composition.toLowerCase()}-mobile-spacing.png`,
      fullPage: true,
    });
    assert.deepEqual(requests, [], "Responsive and keyboard checks must not load remote assets.");
    await output.close();
    results.push({
      composition,
      exactPreviewDownloadMatch: true,
      loadedFonts,
      networkRequests: 0,
      mobileOverflow: false,
      textSpacingOverflow: false,
    });
  }
  // Actual source ZIP, rather than a pack of instructions only.
  const readyZip = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download page ZIP", exact: true }).click();
  const zip = await JSZip.loadAsync(await readFile(await (await readyZip).path()));
  assert.ok(zip.file("index.html"));
  assert.ok(zip.file("styles.css"));
  assert.ok(zip.file("fonts/instrument-serif-OFL.txt"));
  assert.ok(zip.file("fonts/instrument-sans-OFL.txt"));
  assert.ok(zip.file("fonts/PROVENANCE.txt"));
  const zipCss = await zip.file("styles.css").async("string");
  const finalHtml = await readFile(`${dir}/journal.html`, "utf8");
  assert.ok(!finalHtml.includes(privateMarker));
  for (const file of Object.values(zip.files).filter((entry) => !entry.dir)) {
    assert.ok(
      !(await file.async("string")).includes(privateMarker),
      `Private link remained in ${file.name}`,
    );
  }
  assert.ok(finalHtml.includes(`<style>${zipCss}</style>`), "ZIP and HTML must use the same CSS.");
  const project = JSON.parse(await zip.file("focus-project.json").async("string"));
  assert.equal(project.studio.page.actionUrl, "https://example.com/studio");
  assert.equal(project.studio.page.composition, "journal");
  assert.equal(project.studio.content.brand, exampleContent.brand);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("Where should the main action lead?").inputValue(),
    "https://example.com/studio",
  );
  assert.equal(await page.getByRole("radio", { name: /^Journal/ }).isChecked(), true);
  await page.screenshot({ path: `${dir}/workspace.png`, fullPage: true });
  const language = page.getByLabel("Page language", { exact: true });
  assert.equal(await language.inputValue(), "en", "Legacy projects must begin in English.");
  await page.getByLabel("Where should the main action lead?").fill("");
  await language.selectOption("ja");
  const japaneseHeadline = "工房のコーヒーと器。京都の窯元を訪ねて、暮らしの道具が生まれるまで";
  const editor = page.getByRole("region", { name: "See it. Use it. Take it with you." });
  await editor.getByRole("button", { name: "Edit the page’s words" }).click();
  await editor.getByLabel("Headline", { exact: true }).fill(japaneseHeadline);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await language.inputValue(), "ja", "The page language must survive a reload.");
  const preview = page.frameLocator('iframe[title="Working page preview"]');
  await preview.getByRole("navigation", { name: "目次", exact: true }).waitFor();
  const japanesePreview = await readPreviewDocument(page.getByTitle("Working page preview"));
  await compare.click();
  await page.getByLabel("Compare", { exact: true }).selectOption("second");
  for (const [frame, width] of [
    [journalPhone, 320],
    [journalDesktop, 1024],
  ]) {
    await frame.getByRole("navigation", { name: "目次", exact: true }).waitFor();
    assert.equal(await frame.locator("html").getAttribute("lang"), "ja");
    assert.equal(await frame.locator("html").evaluate((el) => el.scrollWidth), width);
    assert.equal(await frame.getByRole("heading", { level: 1 }).textContent(), japaneseHeadline);
    assert.equal(await frame.locator(".hero-sub").textContent(), exampleContent.sub);
  }
  await compare.click();
  const japaneseHtmlDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download working HTML", exact: true }).click();
  const japaneseHtml = await readFile(await (await japaneseHtmlDownload).path(), "utf8");
  assert.equal(japaneseHtml, japanesePreview, "The localized preview must match the download.");
  const japaneseZipDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download page ZIP", exact: true }).click();
  const japaneseZip = await JSZip.loadAsync(
    await readFile(await (await japaneseZipDownload).path()),
  );
  const japaneseProject = JSON.parse(await japaneseZip.file("focus-project.json").async("string"));
  assert.equal(japaneseProject.studio.page.language, "ja");
  assert.equal(japaneseProject.studio.content.headline, japaneseHeadline);
  assert.ok(
    (await japaneseZip.file("index.html").async("nodebuffer")).includes(
      Buffer.from(japaneseHeadline, "utf8"),
    ),
  );
  const sourceDir = resolve(dir, "japanese-journal");
  await mkdir(sourceDir, { recursive: true });
  for (const name of ["index.html", "styles.css"]) {
    await writeFile(`${sourceDir}/${name}`, await japaneseZip.file(name).async("nodebuffer"));
  }
  const delivered = await browser.newPage({ viewport: { width: 320, height: 850 } });
  delivered.on("pageerror", (error) => pageErrors.push(error.message));
  // Read the two extracted files on an isolated origin, including in managed browsers that block file URLs.
  const deliveredOrigin = "https://focus-delivery.test";
  const deliveryRequests = [];
  await delivered.route("**/*", (route) => {
    const url = new URL(route.request().url());
    deliveryRequests.push(url.href);
    if (url.origin === deliveredOrigin && ["/index.html", "/styles.css"].includes(url.pathname))
      return route.fulfill({ path: resolve(sourceDir, url.pathname.slice(1)) });
    return route.abort();
  });
  await delivered.goto(deliveredOrigin + "/index.html");
  assert.equal(await delivered.locator("html").getAttribute("lang"), "ja");
  const deliveredHeadline = delivered.getByRole("heading", { level: 1 });
  assert.equal(await deliveredHeadline.textContent(), japaneseHeadline);
  assert.equal(await delivered.locator(".hero-sub").textContent(), exampleContent.sub);
  const typography = await deliveredHeadline.evaluate(async (heading) => {
    await document.fonts.ready;
    const range = document.createRange();
    const node = heading.firstChild;
    const bounds = heading.getBoundingClientRect();
    const lines = new Map();
    let allVisible = true;
    for (let i = 0; i < node.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const glyph = range.getBoundingClientRect();
      const midline = glyph.top + glyph.height / 2;
      allVisible &&=
        glyph.width > 0 &&
        glyph.height > 0 &&
        glyph.left >= bounds.left - 1 &&
        glyph.right <= bounds.right + 1 &&
        midline >= bounds.top &&
        midline <= bounds.bottom;
      lines.set(glyph.top, (lines.get(glyph.top) ?? "") + node.data[i]);
    }
    // Two different ideographs must draw ink and must not share the same missing-glyph box.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = `32px ${getComputedStyle(heading).fontFamily}`;
    const renderGlyph = (character) => {
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillText(character, 5, 45);
      return canvas.toDataURL();
    };
    const blank = canvas.toDataURL();
    const first = renderGlyph("工"),
      second = renderGlyph("房");
    return {
      lines: [...lines.values()],
      allVisible,
      distinctInk: first !== second && first !== blank && second !== blank,
      lineBreak: getComputedStyle(heading).lineBreak,
    };
  });
  assert.ok(
    typography.lines.length > 1 && typography.allVisible,
    "Every character must fit on a visible line at 320px.",
  );
  assert.equal(typography.lines.join(""), japaneseHeadline);
  assert.ok(
    typography.lines.every((line) => !/^[、。ー]/u.test(line)),
    "Japanese punctuation must not start a line in this headline.",
  );
  assert.equal(typography.lineBreak, "strict");
  assert.ok(
    typography.distinctInk,
    "Install Japanese system fonts for this browser check; both ideographs must render recognizably different glyphs.",
  );
  assert.equal(
    await delivered.getByRole("navigation", { name: "目次" }).getByRole("link").count(),
    exampleContent.features.length,
  );
  assert.equal(
    await delivered
      .locator(".hero-actions")
      .getByRole("link", { name: "詳しく見る", exact: true })
      .getAttribute("href"),
    "#details",
  );
  await delivered.keyboard.press("Tab");
  const skip = delivered.getByRole("link", { name: "本文へスキップ", exact: true });
  assert.equal(await skip.evaluate((el) => el === document.activeElement), true);
  await delivered.keyboard.press("Enter");
  await delivered.waitForFunction(() => document.activeElement?.id === "main");
  assert.equal(await delivered.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.deepEqual(deliveryRequests, [
    deliveredOrigin + "/index.html",
    deliveredOrigin + "/styles.css",
  ]);
  await delivered.close();
  await language.selectOption("en");
  await preview.getByRole("navigation", { name: "On this page", exact: true }).waitFor();
  assert.equal(await preview.locator("html").getAttribute("lang"), "en");
  assert.equal(await preview.getByRole("heading", { level: 1 }).textContent(), japaneseHeadline);
  // The working-page editor must reflow within the narrow app viewport too.
  await page.setViewportSize({ width: 320, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.deepEqual(pageErrors, []);
  const report = {
    at: new Date().toISOString(),
    target: url,
    browser: browserName,
    status: "passed",
    results,
    checks: [
      "legacy save migration",
      "task-based layout comparison, phone/desktop viewports and selected layout surviving reload",
      "exact preview/download parity",
      "embedded font faces loaded and licenses retained",
      "valid source ZIP",
      "private link held for repair and omitted from preview, downloaded HTML and every ZIP member",
      "native disclosure and section-link keyboard operation",
      "320px page and workspace reflow",
      "text spacing override",
      "no remote requests",
      "page settings persist after reload",
      "Japanese page language persists in layout comparisons, working HTML and extracted ZIP",
      "Japanese skip link, content index, fallback action, owner wording and switch back to English",
      "Japanese headline bytes, distinct CJK glyphs and complete 320px line wrapping in the opened source ZIP",
    ],
    pageErrors,
  };
  await writeFile(`${dir}/RESULTS.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
