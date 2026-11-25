import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import JSZip from "jszip";
import { launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1", "Use a disposable local Focus build.");
assert.equal(origin.protocol, "http:");
const dir = await mkdtemp(join(tmpdir(), "focus-booking-rehearsal-"));
const project = join(dir, "river-kiln");
const bundle = join(dir, "focus-source-trial");
const out = join(dir, "evidence");
const published = resolve("artifacts/booking-rehearsal");
const exec = promisify(execFile);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !name.startsWith("GIT_") && !["NODE_OPTIONS", "NODE_PATH"].includes(name),
  ),
);
const run = (exe, args) => exec(exe, args, { cwd: project, env, timeout: 120000 });
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const browser = await launchTestBrowser();
const errors = [];
const result = { builds: [] };
const catalog = JSON.parse(await readFile("assets/vendor-fonts/provenance.json", "utf8"));
const design = JSON.parse(await readFile("src/lib/directions.data.json", "utf8")).find(
  (d) => d.id === "graphite-precision",
);
const roles = [
  { role: "heading", selector: "main header h1", family: design.direction.tokens.headingFont },
  { role: "body", selector: "main header p", family: design.direction.tokens.bodyFont },
  {
    role: "action",
    selector: "main form button[type=submit]",
    family: design.direction.tokens.bodyFont,
  },
];

async function unzipOwned(bytes, root) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    assert(file.name.startsWith(root + "/"));
    assert(file.name.split("/").every((p) => /^[\w.-]+$/.test(p) && ![".", ".."].includes(p)));
    const dest = join(dir, file.name);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await file.async("nodebuffer"), { flag: "wx" });
  }
}

async function download(page, label) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  return readFile(await (await waiting).path());
}

async function receivePackages() {
  const owner = "booking-rehearsal-owner";
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin.origin) return route.abort();
    if (url.pathname === "/api/hosted/session")
      return route.fulfill({
        json: { mode: "hosted", user: { id: owner, email: null }, storageAvailable: false },
      });
    return route.continue();
  });
  const id = "booking-rehearsal";
  const entry = {
    id,
    title: design.direction.name,
    collection: "",
    favorite: false,
    created: "2026-01-11T00:00:00Z",
    updated: "2026-01-11T00:00:00Z",
    state: { libraryId: id, tokens: design.direction.tokens, content: design.content },
  };
  await context.addInitScript(
    ({ app, owner, entry }) => {
      if (location.origin === app && window.top === window) {
        const key = "focus:owner:v1:" + encodeURIComponent("sites:" + owner) + ":";
        localStorage.setItem(
          key + "refraction:library:v1",
          JSON.stringify({ version: 1, entries: [entry] }),
        );
      }
    },
    { app: origin.origin, owner, entry },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(new URL("/target", origin).href);
  await page.getByText("Practice with a pottery booking app", { exact: true }).click();
  const practice = await download(page, "Download booking practice ZIP");
  assert.deepEqual(await download(page, "Download booking practice ZIP"), practice);
  await unzipOwned(practice, "river-kiln");
  result.practiceZipSha256 = digest(practice);
  await writeFile(join(out, "focus-booking-rehearsal.zip"), practice);

  await page.getByLabel("Which saved Vision should guide this?").selectOption(id);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Fill the genuine Target wizard, save it, and return after a reload.
  const answer = async (label, value) => page.getByLabel(label).fill(value);
  await answer("Which page or screen will you start with?", "River Kiln booking page");
  const fields = page.locator("textarea:not([readonly])");
  await fields.nth(0).fill("Make the primary booking action easier to find.");
  await fields
    .nth(1)
    .fill("Find the total, recover from a full class, reserve once after a lost reply.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fields.nth(0).fill("Fresh practice ZIP and a separate copy of local work.");
  await fields.nth(1).fill("Private loopback preview with made-up reservations.");
  await fields
    .nth(2)
    .fill("Check exact hashes and undo the patch, preserving a separate notes file.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("heading", { name: "Prepare the handoff", exact: true }).waitFor();
  await page.reload();
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Include a proposed code change · optional", { exact: true }).click();
  await page.getByLabel("What runs this page?").selectOption("vite");
  for (const [fileLabel, pathLabel, file] of [
    ["Page file (.tsx)", "Page file path in the project", "src/Booking.tsx"],
    [
      "Matching style file (.module.css)",
      "Style file path in the project",
      "src/Booking.module.css",
    ],
  ]) {
    await page.getByLabel(fileLabel, { exact: true }).setInputFiles(join(project, file));
    await page.getByLabel(pathLabel).fill(file);
  }
  await page.getByRole("button", { name: "Check whether this page is supported" }).click();
  assert(await page.getByRole("radio", { name: "Keep the page’s fonts" }).isChecked());
  assert(await page.getByRole("radio", { name: "Keep the compact picker" }).isChecked());
  const previewPicker = page.getByRole("region", { name: "Class picker preview" });
  const compactPicker = previewPicker.getByRole("combobox", { name: "Class" });
  await compactPicker.selectOption("glaze");
  assert.match(await previewPicker.innerText(), /Total including materials: \$56/);
  await page.getByRole("radio", { name: "Use my design’s fonts" }).check();
  await page.getByRole("radio", { name: "Compare times and totals" }).check();
  assert.equal(await previewPicker.getByRole("radio").count(), 2);
  await previewPicker.getByRole("radio", { name: /Wheel basics/ }).check();
  assert.match(await previewPicker.innerText(), /Total including materials: \$48/);
  await page.getByRole("checkbox", { name: /These are the page parts/ }).check();
  await page.getByRole("button", { name: "Prepare proposed edits" }).click();
  const proposal = await download(page, "Download proposed code change");
  result.proposalZipSha256 = digest(proposal);
  // This proposal contains only this script’s owned sample page and fixture plan.
  await writeFile(join(out, "river-kiln-sample-proposal.zip"), proposal);
  await unzipOwned(proposal, "focus-source-trial");
  await context.close();
}

// Read the face used to draw real glyphs. The CSS declaration alone also succeeds on fallback.
async function measurePaint(page) {
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const report = {};
    for (const { role, selector, family } of roles) {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      assert(nodeId, "Missing text for " + role);
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      assert(fonts.length && fonts.every((font) => font.glyphCount > 0), "No glyphs for " + role);
      const chosen = catalog.families.find((entry) => entry.name === family);
      const expectedFace = chosen.faces[0].metadata.names["6"];
      report[role] = {
        family,
        declared: await page.locator(selector).evaluate((e) => getComputedStyle(e).fontFamily),
        faces: fonts.map(({ postScriptName, glyphCount, isCustomFont }) => ({
          name: postScriptName,
          glyphs: glyphCount,
          custom: isCustomFont,
        })),
        matchesChosenFace: fonts.every(
          (font) => font.isCustomFont && font.postScriptName === expectedFace,
        ),
      };
    }
    return report;
  } finally {
    await cdp.detach();
  }
}

async function checkReflow(page, cssZoom = 1) {
  return page.evaluate((zoom) => {
    document.documentElement.style.zoom = String(zoom);
    return {
      cssZoom: Number(getComputedStyle(document.documentElement).zoom),
      viewport: innerWidth,
      fits:
        document.documentElement.scrollWidth <= innerWidth &&
        [
          ...document.querySelectorAll("main :is(h1, p, label, select, input, button, strong)"),
        ].every((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.right <= innerWidth + 1 && rect.left >= -1;
        }),
    };
  }, cssZoom);
}

// A fresh Chromium context cannot use any network. Only exact files from the recipient's
// production build are served in memory. Deliberately withhold a face in a second fresh context.
async function checkOfflineBuild(app, width, withholdFont, shippedFonts) {
  const context = await browser.newContext({ offline: true, viewport: { width, height: 850 } });
  try {
    const dist = join(project, "dist");
    const root = await readdir(join(dist, "assets"));
    const files = new Map([
      ["/", "index.html"],
      ...root.map((f) => ["/assets/" + f, "assets/" + f]),
    ]);
    const requests = [];
    const withheld = [];
    const served = [];
    await context.route("**/*", async (route) => {
      const { origin, pathname } = new URL(route.request().url());
      const file = origin === app && files.get(pathname);
      if (!file) {
        requests.push(route.request().url());
        return route.abort();
      }
      const ext = extname(file);
      if (ext === ".woff2" && withholdFont) {
        withheld.push(file);
        return route.abort();
      }
      const bytes = await readFile(join(dist, file));
      if (ext === ".woff2") served.push(digest(bytes));
      return route.fulfill({
        contentType: {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".woff2": "font/woff2",
        }[ext],
        body: bytes,
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(app);
    await page.getByRole("heading", { level: 1 }).waitFor();
    const paint = await measurePaint(page);
    assert.deepEqual(requests, [], "The offline page requested an unshipped resource.");
    assert.equal(withheld.length > 0, withholdFont);
    assert.deepEqual([...new Set(served)].sort(), withholdFont ? [] : [...shippedFonts].sort());
    for (const measured of Object.values(paint)) {
      assert.equal(measured.matchesChosenFace, !withholdFont, JSON.stringify(measured));
      if (withholdFont) assert(measured.faces.every((face) => !face.custom));
    }
    const layout = await checkReflow(page, width === 1280 ? 2 : 1);
    assert.equal(layout.cssZoom, width === 1280 ? 2 : 1);
    assert(layout.fits, "Offline layout clipped at " + width);
    return { width, withheld, served, layout, paint };
  } finally {
    await context.close();
  }
}

async function book(page, app, width, phase) {
  const compare = phase === "applied";
  const replies = [];
  const observeResponse = (response) => {
    if (response.url() === app + "/api/practice-bookings") replies.push(response.status());
  };
  page.on("response", observeResponse);
  await page.setViewportSize({ width, height: 850 });
  await page.goto(app);
  const field = page.getByLabel("Practice email");
  const form = page.getByRole("form", { name: "Practice booking" });
  const action = form.getByRole("button", { name: "Reserve a place" });
  const status = form.getByRole("status");
  const email = "student-" + width + "@example.test";
  const select = form.getByRole("combobox", { name: "Class" });
  const wheel = form.getByRole("radio", { name: /Wheel basics/ });
  const glaze = form.getByRole("radio", { name: /Glaze studio/ });
  if (compare) {
    const group = form.getByRole("group", { name: "Class" });
    assert.equal(await group.getByRole("radio").count(), 2);
    for (const [control, expected] of [
      [wheel, /Wheel basics[\s\S]*10 am[\s\S]*\$48/],
      [glaze, /Glaze studio[\s\S]*2 pm[\s\S]*\$56/],
    ]) {
      assert.match(await control.evaluate((e) => e.labels[0].innerText), expected);
    }
    assert(await wheel.isChecked());
    await page.screenshot({ path: join(out, "choices-" + width + ".png"), fullPage: true });
    await wheel.focus();
    await page.keyboard.press("ArrowDown");
    assert(await glaze.isChecked());
  } else {
    assert.equal(await form.getByRole("radio").count(), 0);
    await select.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await select.inputValue(), "glaze");
  }
  const total = form.locator("[aria-live=polite]").filter({ hasText: /Total including materials/ });
  assert.match(await total.innerText(), /\$56/);
  await field.fill(email);
  await field.press("Tab");
  assert(
    await action.evaluate(
      (e) => document.activeElement === e && getComputedStyle(e).outlineStyle !== "none",
    ),
  );
  await page.keyboard.press("Enter");
  await status.getByText("Checking availability…").waitFor();
  assert(await action.isDisabled());
  await status.getByText(/Glaze studio just filled/).waitFor();
  assert(
    await action.evaluate((button) => button === document.activeElement),
    "Recovery lost keyboard focus.",
  );
  await (compare ? glaze : select).focus();
  await page.keyboard.press("ArrowUp");
  if (compare) assert(await wheel.isChecked());
  else assert.equal(await select.inputValue(), "wheel");
  assert.equal(await field.inputValue(), email);
  assert.match(await total.innerText(), /\$48/);
  await page.getByText("Practice conditions", { exact: true }).click();
  await page.getByLabel("Lose the first confirmation").check();
  await action.press("Enter");
  await status.getByText(/confirmation didn’t reach you/).waitFor();
  assert.equal(await field.inputValue(), email);
  await action.press("Enter");
  await status.getByText(/Booking confirmed/).waitFor();
  const confirmed = await status.innerText();
  assert.match(confirmed, /RK-\d{3} · Total \$48/);
  assert(await action.isDisabled());
  await page.reload();
  await field.fill(email);
  await action.press("Enter");
  await status.getByText(/Booking confirmed/).waitFor();
  assert.equal(await status.innerText(), confirmed);
  await page.getByText("Practice conditions", { exact: true }).click();
  await page.getByText("Check saved reservations", { exact: true }).click();
  const lookup = page.getByLabel("Address used for the booking");
  const countButton = page.getByRole("button", { name: "Count reservations" });
  const count = page.getByRole("form", { name: "Reservation count" }).getByRole("status");
  await lookup.fill("unbooked@example.test");
  await countButton.click();
  await count.getByText("Saved reservations for this address: 0.", { exact: true }).waitFor();
  await lookup.fill(email);
  await countButton.click();
  await count.getByText("Saved reservations for this address: 1.", { exact: true }).waitFor();
  page.off("response", observeResponse);
  assert.deepEqual(
    replies,
    [409, 503, 200, 200],
    "Unexpected full, lost, retry, or reload result.",
  );
  const layout = await checkReflow(page);
  assert(layout.fits, "Overflow at " + width);
  const paint = await measurePaint(page);
  if (compare)
    assert(
      Object.values(paint).every((role) => role.matchesChosenFace),
      JSON.stringify(paint),
    );
  return {
    width,
    confirmed,
    savedReservations: 1,
    bookingResponseStatuses: replies,
    treatment: compare ? "compare" : "compact",
    paint,
    radius: await action.evaluate((e) => getComputedStyle(e).borderRadius),
  };
}

async function checkBuild(phase, shippedFonts = []) {
  await run("npm", ["run", "build"]);
  // Import the Vite version actually installed into the extracted customer's project.
  const { preview } = await import(
    pathToFileURL(join(project, "node_modules/vite/dist/node/index.js")).href
  );
  const server = await preview({
    root: project,
    logLevel: "error",
    preview: { host: "127.0.0.1", port: 0 },
  });
  try {
    const address = server.httpServer.address();
    const app = "http://127.0.0.1:" + address.port;
    const context = await browser.newContext();
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === app ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const sizes = [];
    for (const width of [320, 1280]) {
      sizes.push(await book(page, app, width, phase));
      await page.screenshot({ path: join(out, phase + "-" + width + ".png"), fullPage: true });
    }
    // Each user books once, even after a lost reply and a page reload.
    assert.match(sizes[0].confirmed, /RK-001/);
    assert.match(sizes[1].confirmed, /RK-002/);
    // A rapid duplicate submission reaches the service twice with one operation key.
    const simultaneous = await page.evaluate(async () => {
      const key = crypto.randomUUID();
      const send = (email) =>
        fetch("/api/practice-bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, session: "wheel", key, scenario: "normal" }),
        });
      const pair = await Promise.all([send("pair@example.test"), send("pair@example.test")]);
      const bodies = await Promise.all(pair.map((response) => response.json()));
      const changed = await send("different@example.test");
      return {
        statuses: pair.map((response) => response.status).sort(),
        bodies,
        conflict: changed.status,
      };
    });
    assert.deepEqual(simultaneous.statuses, [200, 201]);
    assert.deepEqual(simultaneous.bodies, [
      { number: "RK-003", total: 48 },
      { number: "RK-003", total: 48 },
    ]);
    assert.equal(simultaneous.conflict, 409);
    await context.close();
    if (phase === "applied") {
      result.offlineRecipient = [];
      for (const width of [320, 1280]) {
        result.offlineRecipient.push(await checkOfflineBuild(app, width, false, shippedFonts));
      }
      result.missingFont = await checkOfflineBuild(app, 320, true, shippedFonts);
    }
    result.builds.push({ phase, sizes });
    return sizes;
  } finally {
    await server.close();
  }
}

try {
  await mkdir(out, { recursive: true });
  await receivePackages();
  await run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  await run("git", ["init", "--quiet"]);
  const verify = (phase) => run(process.execPath, [join(bundle, "verify.mjs"), phase, project]);
  const patch = async (file) => {
    await run("git", ["apply", "--check", join(bundle, file)]);
    await run("git", ["apply", join(bundle, file)]);
  };
  await verify("before");
  const contract = JSON.parse(await readFile(join(bundle, "trial-contract.json"), "utf8"));
  assert.equal(contract.version, 2);
  assert.equal(contract.typography, "portable");
  assert.equal(contract.bookingLayout, "compare");
  result.trial = {
    version: contract.version,
    typography: contract.typography,
    bookingLayout: contract.bookingLayout,
  };
  const shippedFonts = contract.assets.filter((file) => file.path.endsWith(".woff2"));
  assert(shippedFonts.length, "The received proposal contains no font.");
  const owned = shippedFonts[0];
  const newFont = join(project, owned.path);
  const fontDir = dirname(newFont);
  const bytes = await readFile(join(bundle, "assets", basename(owned.path)));
  assert.equal(digest(bytes), owned.sha256);
  // Even identical bytes at this name belong to the customer until this proposal creates them.
  await mkdir(fontDir, { recursive: true });
  await writeFile(newFont, bytes, { flag: "wx" });
  await assert.rejects(verify("before"), /asset path already exists/);
  await assert.rejects(run("git", ["apply", "--check", join(bundle, "forward.patch")]));
  assert.deepEqual(await readFile(newFont), bytes);
  await rm(newFont);
  await rmdir(fontDir);
  await verify("before");
  const before = await checkBuild("original");
  await patch("forward.patch");
  await verify("after");
  const after = await checkBuild(
    "applied",
    shippedFonts.map((file) => file.sha256),
  );
  const builtAssets = join(project, "dist", "assets");
  const notices = (await readdir(builtAssets)).filter((name) => name.endsWith(".txt"));
  const expectedNotices = contract.assets.filter((asset) => asset.path.endsWith(".txt"));
  assert(expectedNotices.length > 0);
  result.productionLicenses = await Promise.all(
    notices.map(async (name) => ({
      name,
      sha256: digest(await readFile(join(builtAssets, name))),
    })),
  );
  assert.deepEqual(
    result.productionLicenses.map((notice) => notice.sha256).sort(),
    expectedNotices.map((notice) => notice.sha256).sort(),
    "The deployable website must carry the original notices for the fonts it serves.",
  );
  assert.notEqual(after[0].radius, before[0].radius, "A shipped style must actually change.");
  await writeFile(join(project, "studio-notes.txt"), "Clay delivery on Monday.\n", { flag: "wx" });
  const neighbor = join(fontDir, "customer-notes.txt");
  await writeFile(neighbor, "Customer artwork lives here.\n", { flag: "wx" });
  const changedFont = Buffer.from(bytes);
  changedFont[changedFont.length - 1] ^= 1;
  await writeFile(newFont, changedFont);
  await assert.rejects(verify("after"), /asset changed/);
  await assert.rejects(run("git", ["apply", "--check", join(bundle, "rollback.patch")]));
  assert.deepEqual(await readFile(newFont), changedFont);
  await writeFile(newFont, bytes);
  // A colleague’s later edit to a scoped file must stop the exact-file undo.
  const pageFile = join(project, "src/Booking.tsx");
  const proposed = await readFile(pageFile);
  const editedPage = Buffer.concat([proposed, Buffer.from("\n// Later rehearsal edit.\n")]);
  await writeFile(pageFile, editedPage);
  await assert.rejects(verify("after"), /differs from the expected snapshot/);
  assert.deepEqual(await readFile(pageFile), editedPage);
  await writeFile(pageFile, proposed); // Restore only this check’s owned test input.
  await verify("after");
  await patch("rollback.patch");
  await verify("before");
  const restored = await checkBuild("restored");
  assert.deepEqual(restored, before);
  assert.equal(
    await readFile(join(project, "studio-notes.txt"), "utf8"),
    "Clay delivery on Monday.\n",
  );
  assert.equal(await readFile(neighbor, "utf8"), "Customer artwork lives here.\n");
  for (const asset of contract.assets)
    await assert.rejects(readFile(join(project, asset.path)), { code: "ENOENT" });
  result.assetGuards = {
    existingIdenticalAssetRefused: true,
    modifiedAssetUndoRefused: true,
    unrelatedNeighborsPreserved: true,
  };
  result.rollback = {
    changedBookingSource:
      "Verification stopped before rollback; the edited file remained byte-identical.",
    unchangedBookingSource:
      "Rollback restored the booking task and preserved both later edits in other files.",
  };
  assert.deepEqual(errors, []);
  await writeFile(join(out, "result.json"), JSON.stringify(result, null, 2) + "\n");
  const kit = new JSZip();
  const deliveries = [
    ["START-HERE.md", resolve("docs/RIVER-KILN-TRIAL.md")],
    ["01-original.zip", join(out, "focus-booking-rehearsal.zip")],
    ["02-focus-proposal.zip", join(out, "river-kiln-sample-proposal.zip")],
    ["evidence/receipt.json", join(out, "result.json")],
    ["evidence/phone-original.png", join(out, "original-320.png")],
    ["evidence/phone-class-comparison.png", join(out, "choices-320.png")],
    ["evidence/desktop-class-comparison.png", join(out, "choices-1280.png")],
  ];
  const checksums = [];
  for (const [path, source] of deliveries) {
    const bytes = await readFile(source);
    kit.file(path, bytes);
    checksums.push(digest(bytes) + "  " + path);
  }
  kit.file("SHA256SUMS", checksums.join("\n") + "\n");
  await writeFile(
    join(out, "river-kiln-colleague-kit.zip"),
    await kit.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    }),
  );
  // Publish only a fully passing run. Write the receipt last.
  await mkdir(published, { recursive: true });
  for (const name of await readdir(out)) {
    if (name !== "result.json") await copyFile(join(out, name), join(published, name));
  }
  await copyFile(join(out, "result.json"), join(published, "result.json"));
  console.log(
    "Booking rehearsal passed. The downloaded proposal rendered the selected heading, body and button fonts offline at 320/1280, detected a withheld face, and fit at 200% CSS zoom. Original, compared and restored bookings each saved one reservation after keyboard recovery and retry. Verification stopped before rollback when Booking.tsx had a later edit and preserved its exact bytes. With the expected Booking.tsx restored, rollback completed and retained both later edits in other files.",
  );
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
