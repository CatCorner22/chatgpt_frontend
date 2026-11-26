/** Exercise the actual customer ZIP, extracted and opened offline in a fresh browser. */
import { readPreviewDocument } from "./fixtures/preview-source.mjs";
import { launchTestBrowser, browserName } from "./browser-engine.mjs";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import JSZip from "jszip";

const url = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const artifactDir = `artifacts/customer-handoff/${browserName}`;
await mkdir(artifactDir, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "focus-customer-handoff-"));
const browser = await launchTestBrowser();
const deliveryMode = browserName === "firefox" ? "offline-file" : "isolated-loopback";
const server = createServer(async (request, response) => {
  const match = new URL(request.url, "http://localhost").pathname.match(
    /^\/(studio|editorial|product|showcase|journal)\/(index\.html|standalone\.html|styles\.css)$/,
  );
  if (!match) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(join(temporary, match[1], match[2]));
    response.writeHead(200, {
      "Content-Type": match[2].endsWith(".css") ? "text/css" : "text/html",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const recipientOrigin = `http://127.0.0.1:${server.address().port}`;
const errors = [];
const requests = [];
const results = [];
const content = {
  brand: "Customer workshop",
  headline: "Careful work for everyday life.",
  sub: "A real recipient needs the complete page, its words, and its image.",
  cta: "Contact the workshop",
  features: [
    { title: "Our process", body: "We plan each project with you." },
    { title: "Your next step", body: "Send your project details to the workshop." },
  ],
  quote: "",
};
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=",
  "base64",
);
const imageData = `data:image/png;base64,${imageBytes.toString("base64")}`;
const imageAlt = "A test ceramic tile";
try {
  const source = await browser.newPage({ acceptDownloads: true });
  source.on("pageerror", (e) => errors.push(e.message));
  await source.goto(url, { waitUntil: "networkidle" });
  const directions = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
  const tokens = directions.find((d) => d.id === "garden-ledger").direction.tokens;
  await source.evaluate(
    ({ tokens, content }) => {
      localStorage.setItem(
        "refraction:v1",
        JSON.stringify({
          version: 2,
          stage: "rx",
          brief: "A customer handoff fixture",
          content,
          tokens,
          direction: "Garden Ledger",
          libraryId: "customer-handoff-fixture",
          quick: true,
          picks: [],
          history: [],
          directions: [],
          stepIndex: 3,
        }),
      );
    },
    { tokens, content },
  );
  await source.reload({ waitUntil: "networkidle" });
  await source.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();
  await source.getByLabel("Where should the main action lead?").fill("mailto:studio@example.com");
  await source.getByText("Add your own image", { exact: true }).click();
  await source.getByLabel("Describe the image").fill(imageAlt);
  await source.locator("#page-image").setInputFiles({
    name: "tile.png",
    mimeType: "image/png",
    buffer: imageBytes,
  });
  await source
    .frameLocator('iframe[title="Working page preview"]')
    .getByRole("img", { name: imageAlt })
    .waitFor();

  for (const composition of ["Studio", "Editorial", "Product", "Showcase", "Journal"]) {
    await source.getByRole("radio", { name: new RegExp("^" + composition) }).check();
    const zipDownload = source.waitForEvent("download");
    await source.getByRole("button", { name: "Download page ZIP", exact: true }).click();
    const bytes = await readFile(await (await zipDownload).path());
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    assert.deepEqual(Object.keys(zip.files).sort(), [
      "README.txt",
      "focus-project.json",
      "index.html",
      "styles.css",
    ]);
    const name = composition.toLowerCase();
    await writeFile(`${artifactDir}/${name}.zip`, bytes);
    const folder = join(temporary, name);
    await mkdir(folder);
    for (const [filename, entry] of Object.entries(zip.files)) {
      await writeFile(join(folder, filename), await entry.async("nodebuffer"));
    }
    const instructions = await readFile(join(folder, "README.txt"), "utf8");
    assert.ok(instructions.includes("Extract the whole ZIP"));
    assert.ok(instructions.includes("not an\n  importable library backup"));
    assert.ok(instructions.includes("upload only index.html and styles.css"));
    const project = JSON.parse(await readFile(join(folder, "focus-project.json"), "utf8"));
    assert.deepEqual(project.studio.content, content);
    assert.equal(project.embeddedImage.src, imageData);
    assert.equal(project.embeddedImage.alt, imageAlt);

    const htmlDownload = source.waitForEvent("download");
    await source.getByRole("button", { name: "Download working HTML", exact: true }).click();
    const standalone = await readFile(await (await htmlDownload).path());
    await writeFile(join(folder, "standalone.html"), standalone);
    assert.equal(
      standalone.toString(),
      await readPreviewDocument(source.getByTitle("Working page preview")),
    );

    // No Focus storage, app server or previously installed assets. Firefox opens
    // local files offline. Managed Chromium blocks file://, so it receives only
    // the extracted files via an isolated loopback host, with external requests blocked.
    const recipient = await browser.newContext({
      offline: deliveryMode === "offline-file",
      viewport: { width: 1280, height: 900 },
    });
    if (deliveryMode === "isolated-loopback") {
      await recipient.route("**/*", (route) =>
        route
          .request()
          .url()
          .startsWith(recipientOrigin + "/")
          ? route.continue()
          : route.abort(),
      );
    }
    const recipientUrl = (file) =>
      deliveryMode === "offline-file"
        ? pathToFileURL(join(folder, file)).href
        : `${recipientOrigin}/${name}/${file}`;
    const page = await recipient.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(recipientOrigin + "/"))
        requests.push(r.url());
    });
    await page.goto(recipientUrl("index.html"), { waitUntil: "load" });
    assert.equal(await page.evaluate(() => document.styleSheets.length), 1);
    assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), content.headline);
    const image = page.getByRole("img", { name: imageAlt });
    assert.equal(await image.getAttribute("src"), imageData);
    assert.equal(await image.evaluate((el) => el.complete && el.naturalWidth > 0), true);
    for (const feature of content.features) {
      assert.ok((await page.locator("body").textContent()).includes(feature.body));
    }
    assert.equal(
      await page.getByRole("link", { name: content.cta, exact: true }).first().getAttribute("href"),
      "mailto:studio@example.com",
    );
    const sourceScreenshot = await page.screenshot({ fullPage: true });
    await page.goto(recipientUrl("standalone.html"), { waitUntil: "load" });
    assert.deepEqual(
      await page.screenshot({ fullPage: true }),
      sourceScreenshot,
      "Extracted source and standalone must look identical.",
    );
    await page.goto(recipientUrl("index.html"), { waitUntil: "load" });
    await page.getByRole("link", { name: "Explore details", exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => location.hash), "#details");
    if (composition === "Product") {
      const disclosure = page.locator("details").nth(1);
      await disclosure.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await disclosure.getAttribute("open"), "");
    }
    await page.setViewportSize({ width: 320, height: 850 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    await page.screenshot({ path: `${artifactDir}/${name}-offline-mobile.png`, fullPage: true });
    // Follow README's editing instructions against the unzipped source.
    const cssPath = join(folder, "styles.css");
    await writeFile(
      cssPath,
      (await readFile(cssPath, "utf8")) +
        "\nbody { background-color: rgb(247, 230, 203) !important; }\n",
    );
    await page.reload({ waitUntil: "load" });
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      "rgb(247, 230, 203)",
    );
    const indexPath = join(folder, "index.html");
    await writeFile(
      indexPath,
      (await readFile(indexPath, "utf8")).replace(
        `<h1>${content.headline}</h1>`,
        "<h1>An edited customer headline.</h1>",
      ),
    );
    await page.reload({ waitUntil: "load" });
    assert.equal(
      await page.getByRole("heading", { level: 1 }).innerText(),
      "An edited customer headline.",
    );
    await page.close();
    await recipient.close();
    results.push({
      composition,
      downloadedZipExtracted: true,
      freshRecipientContext: true,
      deliveryMode,
      cssLoadedAndEditable: true,
      exportedCopyEditable: true,
      originalImageBytesAndAltRetained: true,
      contentRetained: true,
      standaloneVisualParity: true,
      nativeLinks: true,
      mobileOverflow: false,
    });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const report = {
    at: new Date().toISOString(),
    target: url,
    browser: browserName,
    deliveryMode,
    status: "passed",
    results,
    pageErrors: errors,
    remoteRequests: requests,
    limits: [
      "Fixture mailto destination checked, not sent.",
      "No public deployment or customer account migration.",
      "App source ZIP installation is a separate parent-owned gate.",
      "Managed Chromium prohibits file://; its extracted source is verified on an isolated loopback host. Firefox uses file:// with offline mode.",
    ],
  };
  await writeFile(`${artifactDir}/RESULTS.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
