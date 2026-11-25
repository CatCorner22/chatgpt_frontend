import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1");
assert.equal(origin.protocol, "http:");
const owner = "garden-journey-browser";
const id = "garden-journey-editorial";
const otherId = "garden-journey-other";
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
    brand: "River Kiln",
    headline: "Classes on the river",
    sub: "Read about our weekend classes.",
    cta: "View classes",
    quote: "",

    features: [
      { title: "Wheel basics", body: "10 am · $48 including materials" },
      { title: "Glaze studio", body: "2 pm · $56 including materials" },
    ],
  },
  page: {
    composition: "studio",
    actionUrl: "https://example.test/classes",
    imageId: null,
    imageAlt: "",
  },
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
    ({ state, otherId, owner, origin }) => {
      if (
        location.origin !== origin ||
        window.top !== window ||
        sessionStorage.getItem("fixture-initialized")
      )
        return;
      sessionStorage.setItem("fixture-initialized", "true");
      const otherState = {
        ...state,
        libraryId: otherId,
        content: { ...state.content, headline: "Another studio’s schedule" },
      };
      for (const prefix of ["", "focus:owner:v1:" + encodeURIComponent("sites:" + owner) + ":"]) {
        localStorage.setItem(prefix + "refraction:v1", JSON.stringify(otherState));
        localStorage.setItem(
          prefix + "refraction:library:v1",
          JSON.stringify({
            version: 1,
            entries: [state, otherState].map((design) => ({
              id: design.libraryId,
              title: design.content.brand,
              state: design,
            })),
          }),
        );
      }
    },
    { state, otherId, owner, origin: origin.origin },
  );
  const visit = (path) => page.goto(new URL(path, origin).href);
  const button = (name) => page.getByRole("button", { name, exact: true });
  async function download(name) {
    const result = page.waitForEvent("download");
    await button(name).click();
    return readFile(await (await result).path());
  }
  await visit("/?view=studio");
  const studioPreview = page.frameLocator('iframe[title="Working page preview"]');
  assert.equal(await studioPreview.locator("h1").innerText(), "Another studio’s schedule");
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
  await page.getByLabel("Brief for", { exact: true }).selectOption({
    label: "River Kiln — Classes on the river",
  });
  await button("Copy my unassigned brief into this design").click();
  await button("3. Arrange the page").click();
  await page.getByLabel("Preferred approach").selectOption("scannable-sections");
  await page.getByLabel("What must the visitor see before they decide?").fill("Price and duration");
  let portable = JSON.parse((await download("Download journey brief")).toString());
  assert.equal(portable.brief.designId, id);
  assert.equal(portable.brief.task, "Find class prices & times");
  assert.equal(portable.stops[0].status, "needs-project-check");
  await page.reload();
  await button("Open my journey brief").click();
  assert.equal(await page.getByLabel("Preferred approach").inputValue(), "scannable-sections");
  await page
    .getByRole("link", { name: "Arrange the page", exact: true })
    .or(button("Arrange the page"))
    .press("Enter");
  assert.equal(
    await studioPreview.locator("h1").innerText(),
    "Classes on the river",
    "Arrange the page should open the design selected under Brief for.",
  );
  await button("Apply Journal from my brief").click();
  await page.getByText("This website already uses Journal.").waitFor();
  await visit("/?view=studio");
  const html = (await download("Download working HTML")).toString();
  assert.match(html, /class="journal"/);
  assert.match(html, /Classes on the river/);
  await visit("/");
  await button("Open my journey brief").click();
  await page.getByLabel("Preferred approach").selectOption("compare-options");
  portable = JSON.parse((await download("Download journey brief")).toString());
  assert.equal(portable.authoredWebsiteLayoutSuggestion.layout, "comparison");
  await button("Preview my options together").click();
  const preview = page.frameLocator('iframe[title="Your option comparison preview"]');
  const expectedOptions = state.content.features.map(({ title, body }) => [title, body]);
  async function readOptions(scope) {
    const rows = scope.locator(".option-list li");
    await rows.last().waitFor();
    return rows.evaluateAll((items) =>
      items.map((item) => [
        item.querySelector("h3").textContent,
        item.querySelector("p").textContent,
      ]),
    );
  }
  assert.deepEqual(await readOptions(preview), expectedOptions);
  const section = await preview.locator(".option-comparison").evaluate((node) => node.outerHTML);
  await button("Review and apply in Studio").click();
  const currentPage = page.frameLocator('iframe[title="Working page preview"]');
  await currentPage.locator("body.journal").waitFor();
  const originalStyle = await currentPage.locator("body").evaluate((node) => {
    const css = getComputedStyle(node);
    return [
      css.fontFamily,
      css.backgroundColor,
      getComputedStyle(node.querySelector("h1")).fontFamily,
    ];
  });
  await button("Apply Comparison from my brief").click();
  await currentPage.locator("body.comparison").waitFor();
  assert.deepEqual(await readOptions(currentPage), expectedOptions);
  assert.equal(
    await currentPage.locator(".option-comparison").evaluate((node) => node.outerHTML),
    section,
  );
  assert.deepEqual(
    await currentPage.locator("body").evaluate((node) => {
      const css = getComputedStyle(node);
      return [
        css.fontFamily,
        css.backgroundColor,
        getComputedStyle(node.querySelector("h1")).fontFamily,
      ];
    }),
    originalStyle,
  );
  await page.getByTitle("Undo the last step (Ctrl+Z)").click();
  await currentPage.locator("body.journal").waitFor();
  await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
  await currentPage.locator("body.comparison").waitFor();
  await visit("/?view=studio");
  const workingHtml = (await download("Download working HTML")).toString();
  const editable = await JSZip.loadAsync(await download("Download page ZIP"));
  const editableHtml = await editable.file("index.html").async("string");
  for (const delivered of [workingHtml, editableHtml]) {
    const outputSection = await page.evaluate(
      (html) =>
        new DOMParser().parseFromString(html, "text/html").querySelector(".option-comparison")
          .outerHTML,
      delivered,
    );
    assert.equal(outputSection, section);
  }
  assert.equal(
    JSON.parse(await editable.file("focus-project.json").async("string")).studio.page.composition,
    "comparison",
  );
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
  assert.match(guide, /Selected website layout: \*\*Comparison\*\*/);
  for (const { title, body } of state.content.features) {
    assert.ok(guide.includes(title) && guide.includes(body));
  }
  const included = JSON.parse(
    guide.split("## Garden journey brief")[1].split("```json")[1].split("```")[0],
  );
  assert.deepEqual(included, portable);
  await visit("/library");
  const library = JSON.parse((await download("Back up library")).toString());
  const other = library.entries.find((entry) => entry.id === otherId);
  assert.equal(other.state.content.headline, "Another studio’s schedule");
  assert.equal(other.state.page.composition, "studio");
  assert.equal(
    library.entries.find((entry) => entry.id === id).state.page.composition,
    "comparison",
  );
  const recipient = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const colleague = await recipient.newPage();
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
  assert.equal(await colleague.getByLabel("Preferred approach").inputValue(), "compare-options");
  // A second tab may update the current draft while its owner is choosing a Garden start.
  await colleague.goto(new URL("/?view=studio", origin).href);
  await colleague.locator("#brief").fill("A returning owner's first brief");
  await colleague.getByRole("link", { name: "Focus home" }).click();
  await colleague.getByRole("button", { name: "Change starting point" }).click();
  await colleague.getByRole("radio", { name: "New app or website" }).check();
  await colleague.getByRole("button", { name: "Continue", exact: true }).click();
  await colleague.getByRole("link", { name: "Work on the page content" }).click();
  await colleague.getByRole("heading", { name: "You have a saved draft" }).waitFor();

  const secondTab = await recipient.newPage();
  await secondTab.routeWebSocket("**/*", () => {});
  await restrictToFixture(secondTab, "garden-journey-recipient");
  await secondTab.goto(new URL("/?view=studio", origin).href);
  const updatedBrief = "Revised appointment page for the studio";
  await secondTab.locator("#brief").fill(updatedBrief);
  await secondTab.reload();
  assert.equal(await secondTab.locator("#brief").inputValue(), updatedBrief);
  await colleague.getByRole("button", { name: "Start a separate draft" }).click();
  await colleague.getByRole("alert").filter({ hasText: "changed in another tab" }).waitFor();
  await colleague.getByRole("link", { name: "Resume saved work" }).click();
  assert.equal(await colleague.locator("#brief").inputValue(), updatedBrief);
  await colleague.goBack();
  await colleague.getByRole("heading", { name: "Gather your content" }).waitFor();
  await secondTab.close();

  assert.deepEqual(errors, []);
  console.log(
    browserName +
      " passed the Garden handoff, including a themed offer preview, Apply, Undo, Redo and matching content in the working HTML, editable ZIP and Target guide.",
  );
} finally {
  await browser.close();
}
