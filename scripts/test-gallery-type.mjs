import { readPreviewDocument } from "./fixtures/preview-source.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1", "Run this fixture against a disposable loopback build.");
assert.equal(origin.protocol, "http:");
const directory = "artifacts/gallery-type";
await mkdir(directory, { recursive: true });
const originals = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
const catalog = JSON.parse(await readFile("assets/vendor-fonts/provenance.json", "utf8"));
const id = "gallery-type-fixture";
const copy = {
  brand: "Riverbend Bindery",
  headline: "A book you can make by hand.",
  sub: "Fold your pages, sew the spine, and leave with a pocket notebook. The first workshop starts at ten on Saturday.",
  cta: "Choose a workshop",
  features: [
    {
      title: "Pocket notebook",
      body: "A two-hour class for first-time bookbinders. Paper, thread, and tools are included.",
    },
    {
      title: "Open studio",
      body: "Bring a book in progress on Sunday and use the bindery’s worktables.",
    },
  ],
  quote: "",
};
const errors = [];
const results = [];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const browser = await launchTestBrowser();
try {
  for (const item of originals) {
    const { headingFont, bodyFont, heroLayout } = item.direction.tokens;
    const selected = [...new Set([headingFont, bodyFont])];
    const selectedIds = selected.map((name) => catalog.families.find((f) => f.name === name).id);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 900 },
    });
    const chunks = new Set();
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin.origin) return route.abort();
      if (url.pathname === "/api/hosted/session") {
        // The fixture exercises local editing and downloads. It never contacts a hosted account.
        return route.fulfill({
          json: { mode: "hosted", user: { id, email: null }, storageAvailable: false },
        });
      }
      const font = catalog.families.find(({ id }) =>
        new RegExp("^/assets/" + id + "-[^/]+\\.js$").test(url.pathname),
      );
      if (font) chunks.add(font.id);
      return route.continue();
    });
    const seed = {
      version: 2,
      stage: "rx",
      integration: "new",
      purpose: { experience: "website", audience: "", tone: "" },
      brief: "Community bookbinding workshops",
      libraryId: "type-" + item.id,
      direction: item.direction.name,
      tokens: item.direction.tokens,
      content: copy,
      page: {
        composition: {
          split: "studio",
          stacked: "product",
          poster: "showcase",
          editorial: "editorial",
        }[heroLayout],
        actionUrl: "",
        imageId: null,
        imageAlt: "",
      },
    };
    await context.addInitScript(
      ({ id, seed, appOrigin }) => {
        if (location.origin === appOrigin && window.top === window) {
          localStorage.setItem(
            "focus:owner:v1:" + encodeURIComponent("sites:" + id) + ":refraction:v1",
            JSON.stringify(seed),
          );
        }
      },
      { id, seed, appOrigin: origin.origin },
    );
    const studio = await context.newPage();
    studio.on("pageerror", (e) => errors.push(e.message));
    await studio.goto(new URL("/?view=studio", origin).href);
    const frame = studio.getByTitle("Working page preview");
    try {
      await frame.waitFor({ timeout: 10000 });
    } catch (error) {
      throw new Error(
        item.id +
          ": " +
          (await studio.locator("body").innerText()).slice(0, 1600) +
          " Page errors: " +
          errors.join(", "),
        { cause: error },
      );
    }
    assert.deepEqual(
      [...chunks].sort(),
      [...selectedIds].sort(),
      item.id + " downloaded unexpected font chunks",
    );
    const preview = await readPreviewDocument(frame);
    const download = async (name) => {
      const pending = studio.waitForEvent("download");
      await studio.getByRole("button", { name, exact: true }).click();
      return readFile(await (await pending).path());
    };
    const html = await download("Download working HTML");
    const zip = await JSZip.loadAsync(await download("Download page ZIP"));
    const css = await zip.file("styles.css").async("string");
    const linked = await zip.file("index.html").async("string");
    assert.equal(html.toString(), preview);
    assert.equal(
      linked.replace(
        '<link rel="stylesheet" href="./styles.css">',
        () => "<style>" + css + "</style>",
      ),
      preview,
    );
    assert.deepEqual(
      Object.keys(zip.files)
        .filter((k) => k.endsWith("-OFL.txt"))
        .sort(),
      selectedIds.map((i) => "fonts/" + i + "-OFL.txt").sort(),
    );
    for (const familyId of selectedIds) {
      assert.deepEqual(
        await zip.file("fonts/" + familyId + "-OFL.txt").async("nodebuffer"),
        await readFile("assets/vendor-fonts/licenses/" + familyId + "-OFL.txt"),
      );
    }
    assert.equal((css.match(/@font-face\s*\{/g) || []).length, selected.length);
    await context.close();

    const recipient = await browser.newContext({
      offline: true,
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await recipient.newPage();
    const requests = [];
    page.on("request", (r) => {
      if (!r.url().startsWith("data:")) requests.push(r.url());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setContent(html.toString());
    const cdp = await recipient.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const samples = [];
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, item.id);
      for (const [selector, family] of [
        ["h1", headingFont],
        [".hero-sub", bodyFont],
      ]) {
        const alias = '"Focus ' + family + ' v1"';
        assert.equal(
          await page
            .locator(selector)
            .evaluate((el) => getComputedStyle(el).fontFamily.split(",")[0]),
          alias,
        );
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        assert.ok(
          fonts.length && fonts.every((f) => f.isCustomFont && f.glyphCount > 0),
          item.id + " used a system fallback in the sample text",
        );
        const expectedFace = catalog.families.find((f) => f.name === family).faces[0].metadata
          .names["6"];
        assert.deepEqual(
          fonts.map((f) => f.postScriptName),
          [expectedFace],
          item.id + " painted the wrong face",
        );
        samples.push({
          width,
          selector,
          selected: family,
          platformFonts: fonts.map((f) => f.postScriptName),
        });
      }
      if (item.id === "ocean-drive" || item.id === "graphite-precision") {
        await page.screenshot({ path: join(directory, item.id + "-" + width + ".png") });
        await writeFile(join(directory, item.id + ".html"), html);
      }
    }
    await page.locator(".hero-actions a").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.hash === "#details");
    assert.deepEqual(requests, []);
    await recipient.close();
    results.push({
      id: item.id,
      fontChunks: [...chunks].sort(),
      htmlSha256: digest(html),
      htmlBytes: html.length,
      samples,
    });
    console.log(item.id + " passed");
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(directory, "RESULTS.json"),
    JSON.stringify(
      {
        browser: browser.version(),
        scope:
          "Built local Studio with a simulated session; offline standalone export. Compared ZIP markup, CSS, and license files.",
        count: results.length,
        results,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
