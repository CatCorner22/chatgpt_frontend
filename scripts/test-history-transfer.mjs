import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launchTestBrowser, browserName } from "./browser-engine.mjs";

// Run with a live app: FOCUS_TEST_URL=http://localhost:4173 node scripts/test-history-transfer.mjs
// Uses isolated browser contexts and self-contained full Studio-state fixtures.
const target = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const path = (name) => fileURLToPath(new URL("../artifacts/" + name, import.meta.url));
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
const directions = JSON.parse(
  await readFile(new URL("../src/lib/directions.data.json", import.meta.url), "utf8"),
);
const state = {
  stage: "rx",
  brief: "A preservation fixture",
  content: {
    brand: "History fixture",
    headline: "Current words",
    sub: "Keep every saved step.",
    cta: "Go",
    quote: "",
    features: [],
  },
  directions: [],
  direction: "Graphite Precision",
  tokens: directions.find((direction) => direction.id === "graphite-precision").direction.tokens,
  stepIndex: 3,
  picks: [],
  history: [],
  version: 2,
  purpose: { audience: "", tone: "" },
  cache: {},
  aiCalls: 0,
  fix: false,
  recheck: [],
  projectId: null,
  savedHash: null,
  nav: "top-menu",
  libraryId: "history-fixture",
  quick: true,
  page: { composition: "studio", actionUrl: "", imageId: null, imageAlt: "" },
};
const snapshot = structuredClone(state);
delete snapshot.cache;
snapshot.content.headline = "Earlier words";
const browser = await launchTestBrowser();
const cases = [];
try {
  for (const mode of ["missing-history", "retained-history", "legacy-reason", "legacy-defaults"]) {
    const history = mode === "retained-history";
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const saved = structuredClone(state);
    if (history) {
      saved.past = [structuredClone(snapshot)];
      saved.future = [structuredClone(snapshot)];
      saved.future[0].content.headline = "Future words";
    }
    if (mode === "legacy-reason") saved.picks = [{ step: "palette", label: "Warm" }];
    if (mode === "legacy-defaults") {
      saved.version = 1;
      for (const field of [
        "page",
        "purpose",
        "nav",
        "cache",
        "quick",
        "aiCalls",
        "fix",
        "recheck",
        "projectId",
        "savedHash",
        "directions",
        "direction",
        "history",
        "picks",
        "stepIndex",
      ])
        delete saved[field];
    }
    const raw = JSON.stringify({
      version: 1,
      entries: [
        {
          id: saved.libraryId,
          title: "History fixture",
          collection: "",
          favorite: false,
          created: "2026-11-18T12:00:00Z",
          updated: "2026-11-18T12:00:00Z",
          state: saved,
          versions: [],
        },
      ],
    });
    const fixture = {
      name: "history.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw),
    };
    await page.goto(new URL("/library", target).href, { waitUntil: "networkidle" });
    await page.getByLabel("Library backup JSON file").setInputFiles(fixture);
    await page.getByRole("status").filter({ hasText: "Restored 1 design" }).waitFor();
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem("refraction:library:v1")).entries[0],
    );
    await page.getByRole("button", { name: "Open its Vision", exact: true }).click();
    await page.locator(".authored-workspace").waitFor();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("refraction:library:v1")).entries[0].updated !==
        "2026-11-18T12:00:00Z",
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".authored-workspace").waitFor();
    const after = await page.evaluate(() => ({
      library: JSON.parse(localStorage.getItem("refraction:library:v1")).entries[0],
      studio: JSON.parse(localStorage.getItem("refraction:v1")),
    }));
    await page.getByRole("link", { name: "My designs", exact: true }).click();
    await page.getByLabel("Library backup JSON file").setInputFiles(fixture);
    await page
      .getByRole("status")
      .filter({ hasText: /Restored|already/ })
      .waitFor();
    const result = {
      mode,
      history,
      beforePast: before.state.past?.length ?? 0,
      beforeFuture: before.state.future?.length ?? 0,
      beforeVersions: before.versions?.length ?? 0,
      afterLibraryPast: after.library.state.past?.length ?? 0,
      afterLibraryFuture: after.library.state.future?.length ?? 0,
      afterVersions: after.library.versions?.length ?? 0,
      afterStudioPast: after.studio.past?.length ?? 0,
      afterStudioFuture: after.studio.future?.length ?? 0,
      afterRepeatEntries: await page.evaluate(
        () => JSON.parse(localStorage.getItem("refraction:library:v1")).entries.length,
      ),
      status: await page
        .getByRole("status")
        .filter({ hasText: /Restored|already/ })
        .innerText(),
      errors,
    };
    result.undoRedoUsable = null;
    if (history && result.afterRepeatEntries === 1) {
      await page.getByRole("button", { name: "Open its Vision", exact: true }).click();
      await page.getByTitle("Undo the last step (Ctrl+Z)").click();
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("refraction:v1")).content.headline === "Earlier words",
      );
      await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("refraction:v1")).content.headline === "Current words",
      );
      await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
      await page.waitForFunction(
        () => JSON.parse(localStorage.getItem("refraction:v1")).content.headline === "Future words",
      );
      result.undoRedoUsable = true;
    }
    cases.push(result);
    await context.close();
  }
  const report = { at: new Date().toISOString(), target, browser: browserName, cases };
  await writeFile(path("HISTORY-TRANSFER-BROWSER.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  for (const item of cases) {
    assert.equal(item.afterRepeatEntries, 1, item.mode + " remains idempotent after reopening");
    assert.deepEqual(item.errors, []);
  }
  assert.equal(
    cases[1].afterLibraryPast,
    1,
    "Opening must preserve imported undo history in the library",
  );
  assert.equal(
    cases[1].afterLibraryFuture,
    1,
    "Opening must preserve imported redo history in the library",
  );
  assert.equal(cases[1].undoRedoUsable, true, "Imported Undo and Redo remain usable");
} finally {
  await browser.close();
}
