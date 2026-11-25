import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1");
assert.equal(origin.protocol, "http:");
const owner = "garden-journey-browser";
const id = "garden-journey-editorial";
const [direction] = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
const state = {
  version: 2,
  stage: "rx",
  integration: "new",
  libraryId: id,
  purpose: { experience: "website", audience: "", tone: "" },
  brief: "Make local studio classes easy to find.",
  direction: direction.direction.name,
  tokens: direction.direction.tokens,
  content: {
    brand: "River studio",
    headline: "Classes on the river",
    sub: "Read about our weekend classes.",
    cta: "View classes",
    quote: "",
    features: [{ title: "Local classes", body: "Wheel classes meet on Saturday." }],
  },
  page: { composition: "studio", actionUrl: "", imageId: null, imageAlt: "" },
};
async function restrictToFixture(page, sessionOwner) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin.origin) return route.abort();
    if (url.pathname === "/api/hosted/session")
      return route.fulfill({
        json: { mode: "hosted", user: { id: sessionOwner, email: null }, storageAvailable: false },
      });
    return route.continue();
  });
}
const browser = await launchTestBrowser();
try {
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
  });
  page.setDefaultTimeout(15000);
  await page.routeWebSocket("**/*", () => {});
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await restrictToFixture(page, owner);
  await page.addInitScript(
    ({ state, owner, origin }) => {
      if (
        location.origin !== origin ||
        window.top !== window ||
        sessionStorage.getItem("fixture-initialized")
      )
        return;
      sessionStorage.setItem("fixture-initialized", "true");
      for (const prefix of ["", "focus:owner:v1:" + encodeURIComponent("sites:" + owner) + ":"]) {
        localStorage.setItem(prefix + "refraction:v1", JSON.stringify(state));
      }
    },
    { state, owner, origin: origin.origin },
  );
  const visit = (path) => page.goto(new URL(path, origin).href);
  const button = (name) => page.getByRole("button", { name, exact: true });
  async function download(name) {
    const result = page.waitForEvent("download");
    await button(name).click();
    return readFile(await (await result).path());
  }
  await visit("/?view=studio");
  await page.getByTitle("Working page preview").waitFor();
  await visit("/");
  const newProject = page.getByRole("radio", { name: "New app or website", exact: true });
  await newProject.waitFor();
  await page.getByRole("radio", { name: "Existing app or website", exact: true }).waitFor();
  // This fixture blocks off-origin requests. A fallback font can draw the text even if
  // the stylesheet fails, so verify both the computed stack and the loaded font face.
  for (const [element, family] of [
    [page.getByRole("heading", { level: 1 }), "Focus Manrope"],
    [button("Continue"), "Focus DM Sans"],
  ]) {
    const loaded = await element.evaluate(async (node, family) => {
      await document.fonts.ready;
      const first = getComputedStyle(node).fontFamily.split(",")[0].replace(/["']/g, "");
      return (
        first === family &&
        [...document.fonts].some(
          (face) => face.family.replace(/["']/g, "") === family && face.status === "loaded",
        )
      );
    }, family);
    assert(loaded, family + " did not render on the first page.");
  }
  await button("Open my journey brief").click();
  await page.getByLabel("Project starting point").selectOption("new");
  await page.getByLabel("What should someone be able to do?").fill("Find class prices & times");
  await page.getByLabel("What needs to keep working?").fill("The class links");
  await page.getByLabel("Brief for", { exact: true }).selectOption(id);
  await button("Copy my unassigned brief into this design").click();
  await button("3. Arrange the page").click();
  await page.getByLabel("Preferred approach").selectOption("scannable-sections");
  await page.getByLabel("What must the visitor see before they decide?").fill("Price and duration");
  const portable = JSON.parse((await download("Download journey brief")).toString());
  assert.equal(portable.brief.designId, id);
  assert.equal(portable.brief.task, "Find class prices & times");
  assert.equal(portable.stops[0].status, "needs-project-check");
  await page.reload();
  await button("Open my journey brief").click();
  assert.equal(await page.getByLabel("Preferred approach").inputValue(), "scannable-sections");
  await page.getByRole("link", { name: "Arrange the page", exact: true }).click();
  await button("Apply Journal from my brief").click();
  await page.getByText("This website already uses Journal.").waitFor();
  await visit("/?view=studio");
  const html = (await download("Download working HTML")).toString();
  assert.match(html, /class="journal"/);
  assert.match(html, /Classes on the river/);
  await visit("/target");
  await page.getByLabel("Which saved Vision should guide this?").selectOption(id);
  await page.getByRole("radio", { name: /Start a separate new project/ }).check();
  await button("Continue").click();
  await page.locator("#target-page").fill("Class guide");
  await button("Fill empty answers from my Garden brief").click();
  assert.equal(await page.locator("#target-improvement").inputValue(), portable.brief.task);
  assert.equal(await page.locator("#target-tasks").inputValue(), portable.brief.preserve);
  await button("Continue").click();
  await page.locator("#target-backup").fill("A new empty named preview folder");
  await page.locator("#target-preview").fill("A disposable local copy");
  await page.locator("#target-rollback").fill("Revert only files introduced by this trial");
  await button("Continue").click();
  await button("Include my Garden brief").click();
  const pack = await JSZip.loadAsync(await download("Prepare and download trial ZIP"));
  const guide = await pack.file("DESIGN.md").async("string");
  const included = JSON.parse(
    guide.split("## Garden journey brief")[1].split("```json")[1].split("```")[0],
  );
  assert.deepEqual(included, portable);
  const colleague = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  colleague.setDefaultTimeout(15000);
  await colleague.routeWebSocket("**/*", () => {});
  await restrictToFixture(colleague, "garden-journey-recipient");
  await colleague.goto(origin.href);
  await colleague.getByRole("button", { name: "Open my journey brief" }).click();
  await colleague.getByText("Open a downloaded brief", { exact: true }).click();
  await colleague.getByLabel("Choose a Focus journey JSON file").setInputFiles({
    name: "focus-garden-journey.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(included)),
  });
  await colleague.getByText(/^Saved in this browser\./).waitFor();
  assert.equal(
    await colleague.getByLabel("What should someone be able to do?").inputValue(),
    portable.brief.task,
  );
  await colleague.reload();
  await colleague.getByRole("button", { name: "Open my journey brief" }).click();
  await colleague.getByRole("button", { name: "3. Arrange the page" }).click();
  assert.equal(await colleague.getByLabel("Preferred approach").inputValue(), "scannable-sections");
  assert.deepEqual(errors, []);
  console.log(
    browserName +
      " passed the Garden handoff: assign, reload, apply Journal, export HTML and decode the identical brief from the Target ZIP.",
  );
} finally {
  await browser.close();
}
