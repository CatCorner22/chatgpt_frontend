// Run against the packaged Focus worker: node scripts/test-copy-ownership.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserName, launchTestBrowser } from "./browser-engine.mjs";

const target = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:4492");
assert.equal(target.protocol, "http:");
assert.equal(target.hostname, "127.0.0.1");
const origin = target.origin;
const owner = "copy-ownership-fixture";
const prefix = "focus:owner:v1:" + encodeURIComponent("sites:" + owner) + ":";
const libraryKey = prefix + "refraction:library:v1";
const draftKey = prefix + "refraction:v1";

const directions = JSON.parse(
  await readFile(new URL("../src/lib/directions.data.json", import.meta.url), "utf8"),
);
const originalState = {
  version: 2,
  stage: "rx",
  integration: "new",
  libraryId: "original",
  projectId: "parent-account-project",
  savedHash: "parent-export-receipt",
  brief: "Workshop",
  direction: directions[0].direction.name,
  tokens: directions[0].direction.tokens,
  purpose: { audience: "", tone: "", experience: "website" },
  content: {
    brand: "Workshop",
    headline: "Fresh words",
    sub: "Morning classes",
    cta: "Book",
    quote: "",
    features: [],
  },
};
const earlier = {
  ...originalState,
  content: { ...originalState.content, headline: "Earlier words" },
};
const later = { ...originalState, content: { ...originalState.content, headline: "Later words" } };
const initialDate = "2026-11-01T00:00:00.000Z";
const original = {
  id: originalState.libraryId,
  title: "Original workshop",
  collection: "Workshop",
  favorite: false,
  created: initialDate,
  updated: initialDate,
  versions: [{ at: initialDate, label: "Initial", state: earlier }],
  state: { ...originalState, past: [earlier], future: [later] },
};
// This older copy has its own account association but still contains both parent history IDs.
const legacy = {
  ...original,
  id: "legacy",
  title: "Archive copy",
  created: "2026-11-02T00:00:00.000Z",
  state: {
    ...original.state,
    libraryId: "legacy",
    projectId: "legacy-child-account-project",
    savedHash: null,
  },
};

async function readEntries(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)).entries, libraryKey);
}

function assertParent(entries, before, phase) {
  assert.deepEqual(
    entries.find((row) => row.id === original.id),
    before,
    phase + " changed parent",
  );
}

async function openHeadlineEditor(page, isApp) {
  if (isApp) {
    await page.getByText("Make the words yours", { exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Edit the page’s words" }).click();
  }
  return page.getByRole("textbox", { name: "Headline", exact: true });
}

async function exerciseCopy(browser, route, age, journey) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  context.setDefaultTimeout(10_000);
  try {
    await context.routeWebSocket("**/*", () => {});
    await context.route("**/*", (request) => {
      const url = new URL(request.request().url());
      if (url.origin !== origin) return request.abort();
      if (url.pathname === "/api/hosted/session")
        return request.fulfill({
          json: { mode: "hosted", user: { id: owner, email: null }, storageAvailable: false },
        });
      return request.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      ({ key, origin, entries }) => {
        if (location.origin !== origin || sessionStorage.getItem("fixture-seeded")) return;
        localStorage.setItem(key, JSON.stringify({ version: 1, entries }));
        sessionStorage.setItem("fixture-seeded", "1");
      },
      { key: libraryKey, origin, entries: age === "new" ? [original] : [original, legacy] },
    );
    await page.goto(origin + "/" + route);
    const initialEntries = await readEntries(page);
    const before = initialEntries.find((row) => row.id === original.id);
    assert.deepEqual(before, original, "Parent must match the entire seed before the copy or open");
    if (age === "new") {
      assert.equal(initialEntries.length, 1);
      const action = route === "library" ? "Make a copy" : "Add an app";
      await page.getByRole("button", { name: action, exact: true }).click();
    }
    const entries = await readEntries(page);
    assertParent(entries, before, "Before opening");
    assert.equal(entries.length, 2);
    const child = entries.find((row) => row.id !== original.id);
    assert.ok(child?.id);
    const projectId = age === "legacy" ? legacy.state.projectId : null;
    assert.equal(child.state.libraryId, child.id);
    assert.equal(child.state.projectId, projectId);
    assert.equal(child.state.savedHash, null);
    if (route === "library") {
      await page.getByRole("textbox", { name: "Search designs" }).fill(child.title);
      await page.getByRole("button", { name: "Open its Vision", exact: true }).click();
    } else {
      await page
        .getByRole("listitem")
        .filter({ hasText: child.title })
        .getByRole("button", { name: "Open", exact: true })
        .click();
    }

    const undo = page.getByTitle("Undo the last step (Ctrl+Z)");
    const redo = page.getByTitle("Redo (Ctrl+Shift+Z)");
    async function checkSaved(headline, phase) {
      await undo.waitFor();
      // Wait for both local persistence paths before we reload or perform the next history action.
      await page.waitForFunction(
        ({ draftKey, libraryKey, id, headline }) => {
          const draft = JSON.parse(localStorage.getItem(draftKey));
          const entries = JSON.parse(localStorage.getItem(libraryKey)).entries;
          return (
            draft?.content?.headline === headline &&
            entries.find((row) => row.id === id)?.state.content.headline === headline
          );
        },
        { draftKey, libraryKey, id: child.id, headline },
      );
      const saved = await readEntries(page);
      assertParent(saved, before, phase);
      assert.deepEqual(saved.map((row) => row.id).sort(), [before.id, child.id].sort(), phase);
      const draft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), draftKey);
      for (const state of [draft, saved.find((row) => row.id === child.id).state]) {
        assert.equal(state.libraryId, child.id, phase + " selected library design");
        assert.equal(state.projectId, projectId, phase + " account association");
        assert.equal(state.savedHash, null, phase + " copied receipt");
        assert.equal(state.content.headline, headline, phase + " saved headline");
      }
    }
    const current = originalState.content.headline;
    await checkSaved(current, "Open");
    if (journey === "fresh edit") {
      const edited = `New workshop headline for ${route} ${age}`;
      const isApp = route === "brands" && age === "new";
      const editor = await openHeadlineEditor(page, isApp);
      assert.equal(await editor.inputValue(), current);
      await editor.fill(edited);
      await checkSaved(edited, "Fresh edit");
      await page.reload();
      const restored = await openHeadlineEditor(page, isApp);
      assert.equal(await restored.inputValue(), edited, "Reload restored the edited Studio field");
      await checkSaved(edited, "Reload");
      await undo.click();
      await checkSaved(current, "Undo edit");
      assert.equal(await restored.inputValue(), current);
      await redo.click();
      await checkSaved(edited, "Redo edit");
      assert.equal(await restored.inputValue(), edited);
    } else {
      // Fresh edits clear the future stack. Use a pristine copy to exercise both inherited branches.
      await undo.click();
      await checkSaved(earlier.content.headline, "Inherited Undo");
      await page.reload();
      await checkSaved(earlier.content.headline, "Reload inherited Undo");
      await redo.click();
      await checkSaved(current, "Redo inherited Undo");
      await redo.click();
      await checkSaved(later.content.headline, "Inherited future");
    }
    assert.deepEqual(errors, []);
    console.log(`${browserName} ${route} ${age} ${journey} passed`);
  } finally {
    await context.close();
  }
}

const browser = await launchTestBrowser();
try {
  for (const route of ["library", "brands"])
    for (const age of ["new", "legacy"])
      for (const journey of ["fresh edit", "inherited history"])
        await exerciseCopy(browser, route, age, journey);
} finally {
  await browser.close();
}
