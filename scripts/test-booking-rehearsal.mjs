import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
const out = resolve("artifacts/booking-rehearsal");
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
  const directions = JSON.parse(await readFile("src/lib/directions.data.json", "utf8"));
  const design = directions.find((d) => d.id === "graphite-precision");
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
  await page.getByRole("checkbox", { name: /These are the page parts/ }).check();
  await page.getByRole("button", { name: "Prepare proposed edits" }).click();
  const proposal = await download(page, "Download proposed code change");
  result.proposalZipSha256 = digest(proposal);
  // This proposal contains only this script’s owned sample page and fixture plan.
  await writeFile(join(out, "river-kiln-sample-proposal.zip"), proposal);
  await unzipOwned(proposal, "focus-source-trial");
  await context.close();
}

async function book(page, owner, width) {
  await page.setViewportSize({ width, height: 850 });
  await page.goto(owner);
  const field = page.getByLabel("Practice email");
  const session = page.getByLabel("Class", { exact: true });
  const action = page.getByRole("button", { name: "Reserve a place" });
  const status = page.getByRole("status");
  const email = "student-" + width + "@example.test";
  await session.selectOption("glaze");
  assert.match(await page.locator("strong").innerText(), /\$56/);
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
  await session.selectOption("wheel");
  assert.equal(await field.inputValue(), email);
  assert.match(await page.locator("strong").innerText(), /\$48/);
  await page.getByText("Practice conditions", { exact: true }).click();
  await page.getByLabel("Lose the first confirmation").check();
  await action.click();
  await status.getByText(/confirmation didn’t reach you/).waitFor();
  assert.equal(await field.inputValue(), email);
  await action.click();
  await status.getByText(/Booking confirmed/).waitFor();
  const confirmed = await status.innerText();
  assert.match(confirmed, /RK-\d{3} · Total \$48/);
  assert(await action.isDisabled());
  await page.reload();
  await field.fill(email);
  await action.click();
  await status.getByText(/Booking confirmed/).waitFor();
  assert.equal(await status.innerText(), confirmed);
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Overflow at " + width,
  );
  return {
    width,
    confirmed,
    heading: await page.locator("h1").evaluate((e) => getComputedStyle(e).fontFamily),
    radius: await action.evaluate((e) => getComputedStyle(e).borderRadius),
  };
}

async function checkBuild(phase) {
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
      sizes.push(await book(page, app, width));
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
  const before = await checkBuild("original");
  await patch("forward.patch");
  await verify("after");
  const after = await checkBuild("applied");
  assert.notEqual(after[0].radius, before[0].radius, "A shipped style must actually change.");
  await writeFile(join(project, "studio-notes.txt"), "Clay delivery on Monday.\n", { flag: "wx" });
  // A colleague’s later edit to a scoped file must stop the exact-file undo.
  const pageFile = join(project, "src/Booking.tsx");
  const proposed = await readFile(pageFile);
  await writeFile(pageFile, Buffer.concat([proposed, Buffer.from("\n// Later rehearsal edit.\n")]));
  await assert.rejects(verify("after"), /differs from the expected snapshot/);
  assert.match(await readFile(pageFile, "utf8"), /Later rehearsal edit/);
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
  assert.deepEqual(errors, []);
  await writeFile(join(out, "result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(
    "Booking rehearsal passed: actual Target downloads, original/applied/undone production builds at 320/1280, failed confirmation retry, stable booking references, keyboard activation, and unrelated edit retention.",
  );
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
