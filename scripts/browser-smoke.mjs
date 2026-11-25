/** Run against a local packaged Focus Worker with npm run test:browser. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";
import { useLoopbackSession } from "./fixtures/saved-studio.mjs";

const base = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(base.protocol, "http:");
assert(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use a loopback preview.");
const browser = await launchTestBrowser();
const errors = [];
const serverRequests = [];
const brand = "Clay House";
const headline = "Make something with your hands.";

async function newVisitor(owner, width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 320 ? 812 : 1000 },
    acceptDownloads: true,
    serviceWorkers: "block",
  });
  await context.routeWebSocket("**/*", () => {});
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("_server")) serverRequests.push(request.url());
  });
  await useLoopbackSession(page, base.href, owner);
  await page.goto(base.href);
  await page.getByRole("heading", { name: "Where do we start?" }).waitFor();
  return page;
}

async function enterNewWebsite(page) {
  await page.getByRole("radio", { name: "New app or website" }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("link", { name: "Work on the page content" }).click();
  assert(await page.getByRole("radio", { name: /^A new site or app/ }).isChecked());
}

async function downloaded(page, name) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile(await (await waiting).path());
}

function checkHandoff(markdown) {
  const blocks = [...markdown.matchAll(/^```json\n([\s\S]*?)\n```$/gm)];
  const copy = blocks
    .map((block) => JSON.parse(block[1]))
    .find((v) => v.format === "focus-content-v1");
  assert.equal(copy?.content.brand, brand);
  assert.equal(copy.content.headline, headline);
  assert.match(markdown, /do not invent testimonials/i);
}

try {
  await mkdir("artifacts", { recursive: true });
  const page = await newVisitor("smoke-create", 1440);
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await enterNewWebsite(page);
  await page
    .getByLabel("Your idea, in your words")
    .fill("An independent ceramics studio teaching pottery workshops in Portland.");
  await page.getByRole("button", { name: "Find my direction", exact: true }).click();
  await page.getByRole("heading", { name: "Which direction is closest?" }).waitFor();
  const directions = page.getByRole("main").getByRole("button");
  assert.equal(await directions.count(), 3);
  await directions.first().click();
  assert.equal(await page.getByRole("button", { name: "Show three different options" }).count(), 0);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Choose 1", exact: true }).click();
  await page.getByRole("heading", { name: "Check your 3 answers" }).waitFor();
  await page.getByRole("button", { name: "Create my Vision" }).click();
  await page.getByRole("button", { name: "Design specification & handoff tools" }).click();
  await page.getByText("Make the words yours", { exact: true }).click();
  await page.getByLabel("Business or project name").fill(brand);
  await page.getByLabel("Headline", { exact: true }).fill(headline);
  checkHandoff((await downloaded(page, "Download DESIGN.md")).toString());
  const pack = await JSZip.loadAsync(await downloaded(page, "Download design pack"), {
    checkCRC32: true,
  });
  checkHandoff(await pack.file("DESIGN.md").async("string"));
  const tokens = JSON.parse(await pack.file("tokens.json").async("string"));
  assert.equal(typeof tokens.bg, "string");
  assert((await pack.file("tokens.css").async("string")).includes("--color-bg: " + tokens.bg));

  const preview = page.getByTitle("Working page preview");
  const heading = preview.contentFrame().getByRole("heading", { name: headline, exact: true });
  await heading.waitFor();
  assert.equal(
    (await downloaded(page, "Download working HTML")).toString(),
    await preview.getAttribute("srcdoc"),
  );
  await page.reload();
  await heading.waitFor();
  await page.getByRole("link", { name: "Focus home", exact: true }).click();
  await page.getByRole("heading", { name: "Gather your content" }).waitFor();
  await page.getByRole("link", { name: "Work on the page content" }).click();
  await heading.waitFor();
  await page.getByRole("link", { name: "Skip to content", exact: true }).press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "MAIN");
  await page.screenshot({ path: "artifacts/design-export.png", fullPage: true });

  const skipped = await newVisitor("smoke-skipped", 1440);
  await enterNewWebsite(skipped);
  await skipped.getByText("Or browse the design collection", { exact: true }).click();
  await skipped.getByRole("button", { name: /Purr & Paper/ }).click();
  for (let i = 0; i < 3; i++)
    await skipped.getByRole("button", { name: "Skip", exact: true }).click();
  await skipped.getByRole("button", { name: "Create my Vision" }).click();
  await skipped.getByRole("link", { name: "My designs", exact: true }).click();
  await skipped.getByRole("button", { name: "Open its Vision", exact: true }).click();
  await skipped.getByRole("heading", { name: "See it. Use it. Take it with you." }).waitFor();

  const mobile = await newVisitor("smoke-quality", 320);
  const mobileWidths = await mobile.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.equal(mobileWidths.viewport, mobileWidths.document);
  await mobile.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  await mobile
    .getByRole("navigation", { name: "Main" })
    .getByText("Tools", { exact: true })
    .click();
  await mobile.getByRole("link", { name: "Quality lab", exact: true }).click();
  const editor = mobile.getByLabel("Page HTML");
  const ownPage = "<main><h1>Saturday pottery classes</h1></main>";
  await editor.fill(ownPage);
  await mobile.getByRole("button", { name: "Check this HTML", exact: true }).click();
  await mobile.getByRole("button", { name: "Flawed sample", exact: true }).click();
  await mobile.getByRole("heading", { name: "3 findings to work through." }).waitFor();
  assert.equal(await editor.inputValue(), ownPage);
  const receipt = JSON.parse((await downloaded(mobile, "Download receipt")).toString());
  assert.equal(receipt.format, "north-star-static-receipt-v1");
  assert.equal(receipt.page, "Flawed sample");
  assert.equal(receipt.receipt.measured.filter((item) => item.status === "fails").length, 3);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 320);
  await mobile.screenshot({ path: "artifacts/quality-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(serverRequests, []);
  const report = {
    date: new Date().toISOString(),
    target: base.href,
    browser: browserName,
    outcome: "passed",
    checks: [
      "Garden first visit to new website Studio",
      "local brief to three directions and three choices",
      "edited brand and headline in downloaded Markdown and design ZIP",
      "exported HTML identical to working preview",
      "edited headline after reload and returning through the Garden",
      "skipped choices resumed from My designs",
      "keyboard skip link",
      "320px Garden and Quality lab layouts",
      "quality sample preserved private HTML and exported three measured findings",
    ],
    mobileWidths,
    pageErrors: errors,
    localFlowServerRequests: serverRequests,
  };
  await writeFile("artifacts/BROWSER-SMOKE.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
