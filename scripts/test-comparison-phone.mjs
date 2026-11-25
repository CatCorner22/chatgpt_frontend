import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";
import { openSavedStudio } from "./fixtures/saved-studio.mjs";

const target = new URL(
  process.env.FOCUS_TEST_URL || process.env.BASE_URL || "http://127.0.0.1:3000",
);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
  "Use a local packaged preview.",
);
const [direction] = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
const actionUrl = "https://booking.example.test/choose-a-session";
const first = "Twilight wheel session";
const second = "Glaze & fire workshop";
const revised = "Evening handbuilding";
const content = {
  brand: "Harbor Kiln",
  headline: "Choose your evening at the kiln",
  sub: "Choose a session. Studio membership costs $280 separately.",
  cta: "Choose a session",
  features: [
    { title: first, body: "A private session is $1 200 for up to six people. Tools are included." },
    { title: second, body: "The group rate is 1\u202f250,50 €. Add a second firing for 12 €." },
  ],
  quote: "",
};

const browser = await launchTestBrowser();
try {
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  const externalActions = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("popup", () => externalActions.push("popup"));
  page.on("download", () => externalActions.push("download"));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === target.origin) return route.continue();
    if (url.href === actionUrl) externalActions.push(url.href);
    return route.abort();
  });
  const studioUrl = await openSavedStudio(page, target, {
    libraryId: "phone-comparison-studio",
    brief: "Help visitors compare pottery classes.",
    direction: direction.direction.name,
    tokens: direction.direction.tokens,
    content,
    page: { composition: "studio", actionUrl, imageId: null, imageAlt: "" },
  });

  const editor = page.getByRole("region", { name: "See it. Use it. Take it with you." });
  const check = editor.getByRole("button", { name: "Check at 320 px", exact: true });
  const panel = editor.getByRole("region", { name: "Phone layout check" });
  const status = panel.getByRole("status");
  const preview = editor.getByTitle("Working page preview");
  const rendered = preview.contentFrame();
  await editor.getByRole("radio", { name: /^Studio/ }).waitFor();
  assert.equal(await check.count(), 0);
  await editor.getByRole("radio", { name: /^Comparison/ }).check();
  await rendered.getByRole("heading", { name: first, exact: true }).waitFor();
  const html = await preview.getAttribute("srcdoc");
  const stored = () => page.evaluate(() => Object.entries(localStorage).sort());
  const before = await stored();

  // The layout measurement is transient. Observe its frame as it mounts, before the result replaces it.
  const measuredFrame = await page.evaluateHandle(() => {
    const snapshot = {};
    const observer = new MutationObserver(() => {
      const node = document.querySelector('iframe[title="320 px layout measurement"]');
      if (!node) return;
      observer.disconnect();
      Object.assign(snapshot, {
        sandbox: node.getAttribute("sandbox"),
        tabIndex: node.tabIndex,
        hiddenFromAssistiveTechnology: !!node.closest('[aria-hidden="true"]'),
        inert: !!node.closest("[inert]"),
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return snapshot;
  });
  await check.click();
  await status.filter({ hasText: first }).waitFor();
  const summary = await status.innerText();
  const readRows = () =>
    status.evaluate((node) => Array.from(node.querySelectorAll("li"), (row) => row.textContent));
  assert.deepEqual(await readRows(), [
    `${first} · Price text fits: ${content.features[0].body}`,
    `${second} · Price text fits: ${content.features[1].body}`,
  ]);
  assert.ok(!summary.includes("$280"), "Membership is outside both option cards.");
  assert.match(summary, /fits horizontally at 320 px/);
  assert.match(summary, /2 of 2 options fit/);
  await page.getByTitle("320 px layout measurement").waitFor({ state: "detached" });
  assert.deepEqual(await measuredFrame.jsonValue(), {
    sandbox: "allow-same-origin",
    tabIndex: -1,
    hiddenFromAssistiveTechnology: true,
    inert: true,
  });
  await measuredFrame.dispose();
  assert.equal(page.url(), studioUrl);
  assert.deepEqual(externalActions, []);
  assert.deepEqual(await stored(), before, "The phone check changed saved browser state.");
  assert.equal(await preview.getAttribute("srcdoc"), html);

  // Simulate a future stylesheet regression in the test browser only. The second card remains
  // measurable, so this distinguishes clipping inside one card from horizontal page overflow.
  await page.evaluate(() => {
    function addClipping(event) {
      const frame = event.target;
      if (
        frame.title !== "320 px layout measurement" ||
        !frame.contentDocument?.querySelector(".option-list")
      )
        return;
      document.removeEventListener("load", addClipping, true);
      const style = frame.contentDocument.createElement("style");
      style.textContent = `
        .option-list li:first-child p { width: 1px; overflow: hidden; white-space: nowrap; }
        body::after { content: 'Wide footer'; display: block; width: 480px; height: 2rem; }
      `;
      frame.contentDocument.head.append(style);
    }
    document.addEventListener("load", addClipping, true);
  });
  await check.click();
  await status.filter({ hasText: "1 of 2 options fit" }).waitFor();
  assert.match(await status.innerText(), /scrolls sideways at 320 px/);
  assert.deepEqual(await readRows(), [
    `${first} · Inspect the text in the phone preview`,
    `${second} · Price text fits: ${content.features[1].body}`,
  ]);
  await check.click();
  await status.filter({ hasText: "2 of 2 options fit" }).waitFor();

  const download = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Download working HTML", exact: true }).click();
  const deliveredHtml = await readFile(await (await download).path(), "utf8");
  assert.equal(
    deliveredHtml,
    html,
    "The checked version must match the delivered page byte for byte.",
  );
  const delivered = await browser.newPage({ viewport: { width: 320, height: 700 } });
  const deliveredUrl = "https://delivery.example.test/working.html";
  await delivered.route("**/*", (route) =>
    route.request().url() === deliveredUrl
      ? route.fulfill({ contentType: "text/html; charset=utf-8", body: deliveredHtml })
      : route.abort(),
  );
  await delivered.goto(deliveredUrl);
  await delivered.evaluate(() => document.fonts.ready);
  assert.equal(await delivered.evaluate(() => document.documentElement.scrollWidth), 320);
  const options = delivered.locator("section.option-comparison li");
  assert.deepEqual(await options.locator("h3").allTextContents(), [first, second]);
  assert.deepEqual(
    await options.locator("p").allTextContents(),
    content.features.map((feature) => feature.body),
  );
  for (const [index, prices] of [
    [0, ["$1 200"]],
    [1, ["1\u202f250,50 €", "12 €"]],
  ]) {
    const fits = await options.nth(index).evaluate((row, prices) => {
      const bounds = row.getBoundingClientRect();
      const text = row.querySelector("p").firstChild;
      return prices.every((price) => {
        const start = text.textContent.indexOf(price);
        if (start < 0) return false;
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + price.length);
        const rects = [...range.getClientRects()];
        return (
          rects.length > 0 &&
          rects.every(
            (rect) =>
              rect.width > 0 &&
              rect.height > 0 &&
              rect.left >= Math.max(0, bounds.left) &&
              rect.right <= Math.min(innerWidth, bounds.right) &&
              rect.top >= bounds.top &&
              rect.bottom <= bounds.bottom,
          )
        );
      });
    }, prices);
    assert.ok(fits, `Downloaded option ${index + 1} must display its own prices at 320 px.`);
  }
  assert.equal(
    await delivered.locator(".option-comparison .action").getAttribute("href"),
    actionUrl,
  );
  await delivered.close();

  await editor.getByRole("button", { name: "Edit the page’s words" }).click();
  await editor.getByLabel("Headline", { exact: true }).fill("Evenings at Harbor Kiln");
  await rendered.getByRole("heading", { name: "Evenings at Harbor Kiln", exact: true }).waitFor();
  assert.equal(
    await status.filter({ hasText: first }).count(),
    0,
    "An unrelated HTML edit left a stale result.",
  );
  await editor.getByLabel("Feature 1", { exact: true }).fill(revised);
  await editor.getByLabel("Feature 1 description").fill("Two hours, with a break for tea.");
  await editor.getByLabel("Feature 2 description").fill("Ask about access before choosing.");
  await rendered.getByText("Ask about access before choosing.", { exact: true }).waitFor();
  await check.click();
  await status.filter({ hasText: revised }).waitFor();
  const updated = await status.innerText();
  assert.ok(updated.includes(second), updated);
  assert.ok(!updated.includes(first), updated);
  assert.doesNotMatch(updated, /[$€]/u);
  assert.deepEqual(await readRows(), [`${revised} · Text fits`, `${second} · Text fits`]);
  const japanesePrice = "材料費込みで￥３，２００です。";
  const arabicPrice = "تكلفة الحصة ٤٨ €";
  await editor.getByLabel("Feature 1 description").fill(japanesePrice);
  await editor.getByLabel("Feature 2 description").fill(arabicPrice);
  await rendered.getByText(arabicPrice, { exact: true }).waitFor();
  await check.click();
  await status.filter({ hasText: revised }).waitFor();
  assert.deepEqual(await readRows(), [
    `${revised} · Price text fits: ${japanesePrice}`,
    `${second} · Price text fits: ${arabicPrice}`,
  ]);
  assert.deepEqual(errors, []);
  console.log(
    `${browserName} passed the 320 px comparison check, download parity, edit invalidation and price-free recheck.`,
  );
} finally {
  await browser.close();
}
