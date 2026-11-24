/**
 * Run against the current loopback Focus Sites build. The browser drives production UI.
 * Only Sites identity and object storage are simulated. Requests use the actual
 * handleHostedRequest implementation, including validation, conditional writes and owner scoping.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const workerFile = new URL("../.output/server/index.mjs", import.meta.url);
const { default: worker } = await import(workerFile.href);
const events = [],
  errors = [];
const objects = new Map();
const bucket = {
  async get(key) {
    const saved = objects.get(key);
    return saved ? { ...saved, body: new Response(saved.value).body } : null;
  },
  async put(key, value, { onlyIf }) {
    const saved = objects.get(key);
    if (onlyIf.get("if-none-match") === "*" && saved) return null;
    if (onlyIf.has("if-match") && onlyIf.get("if-match") !== saved?.httpEtag) return null;
    const etag = hash(value);
    const next = { value, etag, httpEtag: '"' + etag + '"', size: Buffer.byteLength(value) };
    objects.set(key, next);
    return next;
  },
  async delete(key) {
    objects.delete(key);
  },
};

const id = "river-kiln-owned-library";
const title = "River Kiln owner rehearsal";
const visitorTask = "Find a pottery class, see its total, and reserve once.";
const preserve =
  "Keep existing reservations and preserve the student's details when a class fills.";
const directionNote = "Show the full price before the reservation action.";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=";
const imageId = hash(Buffer.from(png, "base64"));
const catalog = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
const tokens = catalog[0].direction.tokens;
const content = {
  brand: title,
  headline: "Saturday at the pottery studio",
  sub: "Everything is included.",
  cta: "Find a class",
  quote: "",
  features: [{ title: "Wheel basics", body: "Clay, firing, and materials included." }],
};
const original = {
  kind: "focus-library-backup",
  version: 1,
  entries: [
    {
      id,
      title,
      collection: "Pottery",
      favorite: false,
      created: "2026-11-24",
      updated: "2026-11-24",
      state: {
        libraryId: id,
        stage: "rx",
        tokens,
        content,
        page: { imageId, imageAlt: "Practice glaze tile" },
        past: [{ page: { imageId } }],
        future: [],
      },
    },
  ],
  assets: { version: 1, images: { [imageId]: "data:image/png;base64," + png } },
};

let browser;
async function ownerPage(owner) {
  const ctx = await browser.newContext({ acceptDownloads: true, serviceWorkers: "block" });
  await ctx.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin.origin) return route.abort();
    if (!url.pathname.startsWith("/api/hosted/")) return route.continue();
    const headers = new Headers(await request.allHeaders());
    // Identity is supplied by this separate test adapter for this browser context only.
    headers.set("oai-authenticated-user-id", owner);
    headers.set("oai-authenticated-user-email", owner + "@example.test");
    const http = new Request(url, {
      method: request.method(),
      headers,
      body: request.postDataBuffer(),
    });
    const answer = await worker.fetch(http, { BUCKET: bucket }, { waitUntil() {} });
    assert(answer instanceof Response);
    events.push({ owner, method: request.method(), path: url.pathname, status: answer.status });
    await route.fulfill({
      status: answer.status,
      headers: Object.fromEntries(answer.headers),
      body: Buffer.from(await answer.arrayBuffer()),
    });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
const goto = (page, path) => page.goto(new URL(path, origin).href);
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function downloaded(page, name) {
  const promise = page.waitForEvent("download");
  await button(page, name).click();
  return readFile(await (await promise).path());
}
async function openJourney(page) {
  await goto(page, "/");
  await button(page, "1. Choose your goal").click();
  await button(page, "Open my journey brief").click();
  await page.getByLabel("Brief for").selectOption(id);
}
async function savedBriefAndBackup(page) {
  await goto(page, "/library");
  await page.getByText(/You have no online library yet/).waitFor();
  const cssPath = await page
    .locator('link[rel="stylesheet"][href^="/assets/"]')
    .first()
    .getAttribute("href");
  assert.match(cssPath, /^\/assets\/[a-zA-Z0-9_.-]+\.css$/);
  const css = await page.request.get(new URL(cssPath, origin).href);
  assert(css.ok());
  assert.equal(
    hash(await css.body()),
    hash(await readFile(".output/public" + cssPath)),
    "Serve the current production build.",
  );
  await page.getByLabel("Library backup JSON file").setInputFiles({
    name: "owned-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await page.getByText(/Restored 1 design and retained 1 referenced image/).waitFor();
  await openJourney(page);
  await page.getByLabel("Project starting point").selectOption("existing");
  await page.getByLabel("What should someone be able to do?").fill(visitorTask);
  await page.getByLabel("What needs to keep working?").fill(preserve);
  await button(page, "3. Arrange the page").click();
  await page.getByLabel("Preferred approach").selectOption("guided-sequence");
  await page.getByLabel("What must the visitor see before they decide?").fill(directionNote);
  await goto(page, "/library");
  await button(page, "Save library online").click();
  await page.getByText(/Saved 1 design online/).waitFor();
}

function assertBackup(copy) {
  assert.equal(copy.entries.length, 1);
  assert.equal(copy.entries[0].id, id);
  assert.equal(copy.entries[0].title, title);
  assert.deepEqual(copy.entries[0].state.content, content);
  assert.equal(copy.entries[0].state.tokens.accent, tokens.accent);
  assert.equal(copy.entries[0].state.page.imageId, imageId);
  assert.deepEqual(copy.assets.images, original.assets.images);
  assert.equal(copy.entries[0].state.past[0].page.imageId, imageId);
  assert.equal(copy.journeys.length, 1);
  assert.equal(copy.journeys[0].designId, id);
  assert.equal(copy.journeys[0].task, visitorTask);
  assert.equal(copy.journeys[0].preserve, preserve);
  assert.deepEqual(copy.journeys[0].decisions.plan, {
    choice: "guided-sequence",
    note: directionNote,
  });
}

async function checkTarget(page) {
  await goto(page, "/target");
  await page.getByLabel("Which saved Vision should guide this?").selectOption(id);
  await button(page, "Continue").click();
  await page.getByRole("button", { name: /Garden brief/ }).click();
  assert.equal(
    await page.getByLabel("What should look or feel clearer?").inputValue(),
    visitorTask,
  );
  assert.equal(await page.getByLabel("What must keep working?").inputValue(), preserve);
  await page.getByLabel("Which page or screen will you start with?").fill("Booking form");
  await button(page, "Continue").click();
  await page
    .getByLabel("Where is the protected copy of today's work?")
    .fill("Separate owned practice copy");
  await page
    .getByLabel("Where will the isolated trial run?")
    .fill("Local practice preview with made-up reservations");
  await page
    .getByLabel("How will you undo only this trial?")
    .fill("Verify the scoped inverse patch on the same copy");
  await button(page, "Continue").click();
  await button(page, "Include my Garden brief").click();
  await page.getByText("Your Garden choices and checks will be included in DESIGN.md.").waitFor();
  const bytes = await downloaded(page, "Prepare and download trial ZIP");
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const text = await zip.file("focus-restyle/DESIGN.md").async("string");
  const section = text.slice(text.indexOf("## Garden journey brief"));
  const json = section.match(/\x60\x60\x60json\n([\s\S]*?)\n\x60\x60\x60/);
  assert(json, "Target must include a machine-readable Garden brief in the actual download");
  const packet = JSON.parse(json[1]);
  assert.equal(packet.format, "focus-garden-journey-v1");
  assert.equal(packet.brief.designId, id);
  assert.equal(packet.brief.task, visitorTask);
  assert.equal(packet.brief.preserve, preserve);
  assert.equal(packet.brief.decisions.plan.note, directionNote);
  return hash(bytes);
}

try {
  browser = await launchTestBrowser();
  const source = await ownerPage("river-owner");
  await savedBriefAndBackup(source);
  const saved = [...objects.entries()].filter(([key]) => key.includes("/snapshots/"));
  assert.equal(saved.length, 1);
  const savedRaw = saved[0][1].value;
  assertBackup(JSON.parse(savedRaw));
  await source.context().close();

  const restored = await ownerPage("river-owner");
  await goto(restored, "/library");
  await restored.getByRole("heading", { name: "Your next design belongs here." }).waitFor();
  await button(restored, "Restore online library").click();
  await restored.getByText(/Restored 1 design and 1 referenced images?/).waitFor();
  assertBackup(JSON.parse(await downloaded(restored, "Back up library")));
  await openJourney(restored);
  assert.equal(
    await restored.getByLabel("What should someone be able to do?").inputValue(),
    visitorTask,
  );
  assert.equal(await restored.getByLabel("What needs to keep working?").inputValue(), preserve);
  const zipHash = await checkTarget(restored);
  await restored.context().close();

  const separate = await ownerPage("other-owner");
  await goto(separate, "/library");
  await separate.getByText(/You have no online library yet/).waitFor();
  assert(await button(separate, "Restore online library").isDisabled());
  assert.equal(await separate.getByText(title, { exact: true }).count(), 0);
  const latest = events.filter((event) => event.path === "/api/hosted/library");
  assert(latest.some((e) => e.owner === "river-owner" && e.method === "PUT" && e.status === 200));
  assert(latest.some((e) => e.owner === "river-owner" && e.method === "GET" && e.status === 200));
  assert(latest.some((e) => e.owner === "other-owner" && e.method === "GET" && e.status === 404));
  assert.equal(objects.size, 2);
  assert.deepEqual(errors, []);
  const report = {
    scope:
      "Local UI with real hosted handlers, simulated Sites identities and an in-memory test bucket",
    workerEntrySha256: hash(await readFile(workerFile)),
    backupSha256: hash(savedRaw),
    targetZipSha256: zipHash,
    events,
  };
  await mkdir("artifacts/hosted-journey", { recursive: true });
  await writeFile("artifacts/hosted-journey/result.json", JSON.stringify(report, null, 2) + "\n");
  console.log(
    "Hosted journey passed. Two clean contexts shared one owner's project, image, history, and Garden brief through the real storage handlers. The restored Target ZIP contained the brief. The second owner saw an empty online library.",
  );
} finally {
  await browser?.close();
}
