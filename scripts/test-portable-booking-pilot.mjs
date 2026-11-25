import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import JSZip from "jszip";
import { launchTestBrowser } from "./browser-engine.mjs";

const archive = resolve(process.argv[2] ?? "artifacts/booking-pilot/river-kiln-pilot.zip");
const scratch = await mkdtemp(join(tmpdir(), "focus-portable-pilot-"));
const kit = join(scratch, "received");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = promisify(execFile);
const testLabel = "Automated acceptance fixture. Exclude from human results.";
const preferenceQuestion = "Which booking page would you choose to use again?";
const recipientEnv = {
  PATH: join(scratch, "no-commands-here"),
  SystemRoot: process.env.SystemRoot ?? "",
};

async function receive() {
  const zip = await JSZip.loadAsync(await readFile(archive), { checkCRC32: true });
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const manifest = await zip.file("SHA256SUMS").async("string");
  const hashes = new Map(
    manifest
      .trimEnd()
      .split(/\r?\n/)
      .map((line) => {
        const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
        assert(match, "Malformed checksum record");
        return [match[2], match[1]];
      }),
  );
  assert.deepEqual(
    [...hashes.keys()].sort(),
    entries
      .map((entry) => entry.name)
      .filter((name) => name !== "SHA256SUMS")
      .sort(),
  );
  for (const entry of entries) {
    assert.equal(entry.unsafeOriginalName, entry.name);
    assert(
      entry.name
        .split("/")
        .every((part) => /^[\w.-]+$/.test(part) && ![".", "..", "node_modules"].includes(part)),
    );
    const content = await entry.async("nodebuffer");
    if (entry.name !== "SHA256SUMS")
      assert.equal(hash(content), hashes.get(entry.name), entry.name);
    const target = join(kit, entry.name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: "wx" });
  }
  // Only execute the owned launcher under test. The subject project requires no installed tools.
  assert.deepEqual(
    await readFile(join(kit, "start.mjs")),
    await readFile(new URL("./river-kiln-pilot-server.mjs", import.meta.url)),
  );
}

async function start() {
  const child = spawn(process.execPath, [join(kit, "start.mjs")], {
    cwd: kit,
    env: recipientEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exit = once(child, "exit");
  let output = "";
  let errors = "";
  child.stderr.on("data", (chunk) => (errors += chunk));
  async function stop() {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exit;
  }
  let timer;
  try {
    const { reviewerUrl, organizerPath } = await Promise.race([
      new Promise((accept, reject) => {
        timer = setTimeout(
          () => reject(new Error("Pilot launcher startup timed out. " + errors)),
          15000,
        );
        child.stdout.on("data", (chunk) => {
          output += chunk;
          const reviewer = /^Reviewer URL: (http:\/\/127\.0\.0\.1:\d+\/)\r?$/m.exec(output);
          const organizer = /^Private organizer file: (.+)\r?\n/m.exec(output);
          if (reviewer && organizer)
            accept({ reviewerUrl: reviewer[1], organizerPath: organizer[1].trim() });
        });
      }),
      exit.then(() => {
        throw new Error("Pilot launcher closed during startup. " + errors);
      }),
    ]);
    assert.equal(dirname(organizerPath), join(kit, "private"));
    return { reviewerUrl, organizerPath, stop };
  } catch (error) {
    await stop();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function localJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
  assert.equal(response.status, 200);
  return response.json();
}

async function observeSample(page, width, email) {
  await page.setViewportSize({ width, height: 850 });
  const form = page.getByRole("form", { name: "Practice booking" });
  const action = form.getByRole("button", { name: "Reserve a place" });
  const status = form.getByRole("status");
  await form.waitFor();
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Sample overflows",
  );
  await page.getByText("Practice conditions", { exact: true }).click();
  await page.getByLabel("Lose the first confirmation").check();
  const started = performance.now();
  const compact = (await form.getByRole("combobox", { name: "Class" }).count()) === 1;
  const picker = compact
    ? form.getByRole("combobox")
    : form.getByRole("radio", { name: /Wheel basics/ });
  await picker.focus();
  await page.keyboard.press("ArrowDown");
  const total = form.locator("[aria-live=polite]").filter({ hasText: /Total including materials/ });
  assert.match(await total.innerText(), /\$56/);
  await page.keyboard.press("ArrowUp");
  assert.match(await total.innerText(), /\$48/);
  const address = form.getByLabel("Practice email");
  await address.fill(email);
  const observed = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/practice-bookings")
      observed.push(response.status());
  });
  await action.press("Enter");
  await status.getByText(/confirmation didn’t reach you/).waitFor();
  assert.equal(await address.inputValue(), email);
  await action.press("Enter");
  await status.getByText(/Booking confirmed/).waitFor();
  const elapsedSeconds = Math.max(1, Math.round((performance.now() - started) / 1000));
  assert.match(await status.innerText(), /RK-\d{3} · Total \$48/);
  assert.deepEqual(observed, [503, 200]);
  await page.getByText("Check saved reservations", { exact: true }).click();
  const counter = page.getByRole("form", { name: "Reservation count" });
  await counter.getByLabel("Address used for the booking").fill(email);
  await counter.getByRole("button", { name: "Count reservations" }).click();
  await counter.getByText("Saved reservations for this address: 1.", { exact: true }).waitFor();
  return { treatment: compact ? "compact" : "compare", elapsedSeconds };
}

async function exportFile(page, button, path) {
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const file = await downloaded;
  await file.saveAs(path);
  return file.suggestedFilename();
}

async function review(browser, live, packet, width) {
  const origins = new Set(
    [live.reviewerUrl, ...packet.samples.map((s) => s.assetRef)].map((url) => new URL(url).origin),
  );
  assert.equal(origins.size, 3);
  const context = await browser.newContext({
    acceptDownloads: true,
    serviceWorkers: "block",
    viewport: { width, height: 850 },
  });
  const attempts = [];
  const pageErrors = [];
  context.on("page", (page) => page.on("pageerror", (error) => pageErrors.push(error.message)));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && origins.has(url.origin)) return route.continue();
    attempts.push(url.origin);
    return route.abort();
  });
  try {
    const reviewer = await context.newPage();
    await reviewer.goto(live.reviewerUrl);
    const code = "automated-fixture-" + width;
    await reviewer.getByLabel("Your reviewer code").fill(code);
    await reviewer.getByRole("button", { name: "Start review" }).click();
    assert.equal(await reviewer.getByRole("button", { name: /private organizer/i }).count(), 0);
    const treatments = [];
    const measurements = new Map();
    for (const [index, sample] of packet.samples.entries()) {
      const link = reviewer.getByRole("link", { name: /Open sample page/ });
      assert.equal(await link.getAttribute("href"), sample.assetRef);
      const opening = context.waitForEvent("page");
      await link.click();
      const page = await opening;
      await page.waitForURL(sample.assetRef);
      const { treatment, elapsedSeconds } = await observeSample(
        page,
        width,
        code + "-" + index + "@example.test",
      );
      await page.close();
      treatments.push(treatment);
      measurements.set(sample.id, elapsedSeconds);
      await reviewer.getByRole("radio", { name: "Completed", exact: true }).check();
      await reviewer.getByLabel("Class you first submitted").selectOption("wheel");
      await reviewer.getByLabel("First submission result").selectOption("lost-confirmation");
      await reviewer.getByLabel(/Price you stated before submitting/).fill("48");
      await reviewer.getByLabel("Did someone help you?").selectOption("no");
      await reviewer.getByLabel(/Time until you finished or stopped/).fill(String(elapsedSeconds));
      await reviewer
        .getByLabel("What happened after the lost confirmation?")
        .selectOption("recovered");
      await reviewer.getByLabel("Saved reservations for this practice address").fill("1");
      await reviewer.reload();
      assert.equal(await reviewer.getByLabel("Your reviewer code").inputValue(), code);
      assert.equal(
        await reviewer.getByLabel(/Price you stated before submitting/).inputValue(),
        "48",
      );
      assert.equal(
        await reviewer.getByLabel("Saved reservations for this practice address").inputValue(),
        "1",
      );
      for (const { title } of packet.dimensions)
        await reviewer.getByLabel("4 of 7 for " + title).check();
      await reviewer.getByRole("radio", { name: "Unsure", exact: true }).check();
      await reviewer.getByLabel(/What stood out/).fill(testLabel);
      await reviewer.getByRole("button", { name: index ? "Finish review" : "Save & next" }).click();
    }
    assert.deepEqual(treatments.sort(), ["compact", "compare"]);
    const preference = reviewer.getByRole("group", { name: preferenceQuestion, exact: true });
    assert.equal(await preference.count(), 0, "Preference was offered before the primary export.");
    const path = join(scratch, code + ".json");
    assert.equal(await exportFile(reviewer, "Download all answers", path), "review-answers.json");
    const primary = await readFile(path);
    const answers = JSON.parse(primary);
    assert.equal(answers.benchmarkId, packet.benchmarkId);
    assert.deepEqual(
      answers.evaluations.map((row) => row.sampleId).sort(),
      [...measurements.keys()].sort(),
    );
    for (const row of answers.evaluations) {
      assert.equal(row.reviewerCode, code);
      assert.equal(row.note, testLabel);
      assert.equal(row.taskOutcome, "completed");
      assert.deepEqual(row.bookingObservation, {
        firstClass: "wheel",
        firstResponse: "lost-confirmation",
        statedDollars: 48,
        helpUsed: false,
        elapsedSeconds: measurements.get(row.sampleId),
        recovery: "recovered",
        savedReservations: 1,
      });
    }
    const chooseSample = width === 320;
    const selected = packet.samples[0];
    assert.equal(await preference.getByRole("radio", { checked: true }).count(), 0);
    await preference
      .getByRole("radio", { name: chooseSample ? selected.label : "No preference", exact: true })
      .check();
    const ballotPath = join(scratch, code + "-preference.json");
    assert.equal(
      await exportFile(reviewer, "Download preference", ballotPath),
      "review-preference.json",
    );
    const ballot = JSON.parse(await readFile(ballotPath, "utf8"));
    assert.deepEqual(ballot, {
      version: 1,
      kind: "booking-preference",
      benchmarkId: packet.benchmarkId,
      reviewerCode: code,
      sampleIds: answers.evaluations.map((row) => row.sampleId),
      answersSha256: hash(primary),
      choice: chooseSample ? { kind: "sample", sampleId: selected.id } : { kind: "no-preference" },
    });
    const repeated = join(scratch, code + "-redownload.json");
    await exportFile(reviewer, "Download all answers", repeated);
    assert.deepEqual(
      await readFile(repeated),
      primary,
      "A secondary ballot changed the primary answers.",
    );
    assert.deepEqual(attempts, [], "Study pages requested unshipped resources");
    assert.deepEqual(pageErrors, []);
    return { primary: path, ballot: ballotPath };
  } finally {
    await context.close();
  }
}

let live;
let browser;
try {
  await receive();
  live = await start();
  const packet = await localJson(new URL("/packet.json", live.reviewerUrl));
  assert.equal(packet.samples.length, 2);
  const organizer = JSON.parse(await readFile(live.organizerPath, "utf8"));
  assert.equal(organizer.id, packet.benchmarkId);
  const comparisonGroup = organizer.protocol === "booking-designer-v1" ? "expert" : "original";
  assert.deepEqual(
    organizer.samples.map((s) => s.group).sort(),
    [comparisonGroup, "guided"].sort(),
  );
  for (const s of packet.samples) {
    assert.deepEqual(Object.keys(s).sort(), ["assetRef", "id", "kind", "label", "taskId"]);
    assert.doesNotMatch(
      [s.id, s.label, s.assetRef].join(" "),
      /original|guided|expert|redesign|control/i,
    );
    assert.equal(new URL(s.assetRef).hostname, "127.0.0.1");
  }
  for (const url of [live.reviewerUrl, ...packet.samples.map((s) => s.assetRef)]) {
    for (const name of ["organizer-template.json", basename(live.organizerPath)]) {
      const res = await fetch(new URL("/private/" + name, url), { redirect: "error" });
      assert([403, 404].includes(res.status), "Study server exposed a private file.");
      await res.body?.cancel();
    }
  }
  browser = await launchTestBrowser();
  const records = [];
  for (const width of [320, 1280]) records.push(await review(browser, live, packet, width));
  const answers = records.map((record) => record.primary);
  const ballots = records.map((record) => record.ballot);
  const report = join(scratch, "automated-scorer-check.json");
  await run(
    process.execPath,
    [
      fileURLToPath(new URL("./north-star-benchmark.mjs", import.meta.url)),
      "score",
      live.organizerPath,
      report,
      ...answers,
    ],
    { timeout: 30000 },
  );
  const findings = JSON.parse(await readFile(report, "utf8"));
  assert.equal(findings.counts.completeReviewers, 2);
  assert.equal(findings.counts.evaluations, 4);
  assert.equal(findings.humanEquivalence, "inconclusive");
  const scoreAtHome = (files) =>
    run(process.execPath, [join(kit, "score.mjs"), ...files], {
      cwd: scratch,
      env: recipientEnv,
      timeout: 15000,
    });
  const privateResults = async () =>
    (await readdir(join(kit, "private"))).filter((name) => /^results-.+\.json$/.test(name)).sort();
  assert.deepEqual(await privateResults(), []);
  const { stdout } = await scoreAtHome(answers);
  assert.match(stdout, /2 reviewer codes/);
  const results = await privateResults();
  assert.equal(results.length, 1);
  const scoreFile = JSON.parse(await readFile(join(kit, "private", results[0]), "utf8"));
  if (comparisonGroup === "expert") {
    const { secondaryPreference, ...primary } = scoreFile;
    assert.deepEqual(primary, findings);
    assert.equal(secondaryPreference.ballots, 0);
    assert.equal(secondaryPreference.unanswered, 2);
  } else assert.deepEqual(scoreFile, findings);
  const withPreferences = [...ballots, ...answers];
  await scoreAtHome(withPreferences);
  const combinedResults = await privateResults();
  assert.equal(combinedResults.length, 2);
  const combinedName = combinedResults.find((name) => !results.includes(name));
  const combined = JSON.parse(await readFile(join(kit, "private", combinedName), "utf8"));
  const preferredGroup = organizer.samples.find(
    (sample) => sample.id === packet.samples[0].id,
  ).group;
  assert.deepEqual(combined, {
    ...findings,
    secondaryPreference: {
      ballots: 2,
      eligibleReviewers: 2,
      unanswered: 0,
      [comparisonGroup]: Number(preferredGroup === comparisonGroup),
      guided: Number(preferredGroup === "guided"),
      noPreference: 1,
      couldNotCompare: 0,
    },
  });
  for (const name of combinedResults) {
    const privateURL = new URL("/private/" + name, live.reviewerUrl);
    const privateResponse = await fetch(privateURL);
    assert([403, 404].includes(privateResponse.status), "Participant could access the findings.");
    await privateResponse.body?.cancel();
  }
  await assert.rejects(scoreAtHome([answers[0], answers[0]]), /only once|duplicate/i);
  await assert.rejects(scoreAtHome([...withPreferences, ballots[0]]), /one preference ballot/i);
  await assert.rejects(scoreAtHome([answers[1], ballots[0]]), /exact completed answers file/i);
  const reserialized = join(scratch, "same-answers-different-bytes.json");
  await writeFile(reserialized, (await readFile(answers[0], "utf8")) + "\n");
  await assert.rejects(scoreAtHome([reserialized, ballots[0]]), /exact completed answers file/i);
  const empty = join(scratch, "empty-answers.json");
  await writeFile(
    empty,
    JSON.stringify({ version: 1, benchmarkId: packet.benchmarkId, evaluations: [] }),
  );
  await assert.rejects(scoreAtHome([empty]), /no completed reviews/i);
  assert.deepEqual(await privateResults(), combinedResults);
  // A reviewer who declines this optional question contributed primary answers only.
  await scoreAtHome([...answers, ballots[1]]);
  const partialName = (await privateResults()).find((name) => !combinedResults.includes(name));
  const partial = JSON.parse(await readFile(join(kit, "private", partialName), "utf8"));
  assert.deepEqual(partial.secondaryPreference, {
    eligibleReviewers: 2,
    ballots: 1,
    unanswered: 1,
    [comparisonGroup]: 0,
    guided: 0,
    noPreference: 1,
    couldNotCompare: 0,
  });
  const previous = live.organizerPath;
  await live.stop();
  live = await start();
  assert.notEqual(live.organizerPath, previous);
  const restarted = await localJson(new URL("/packet.json", live.reviewerUrl));
  assert.equal(restarted.benchmarkId, packet.benchmarkId);
  assert.deepEqual(
    restarted.samples.map((s) => s.id).sort(),
    packet.samples.map((s) => s.id).sort(),
  );
  console.log(
    "Extracted pilot passed with Node alone: masked pages, 320/1280 widths, four recovered bookings, stored counts, draft recovery, separate preference and tie ballots, and scoring bound to exact primary exports. Duplicate ballots and changed or missing primary files produced no report. The browser used only loopback. All synthetic responses were temporary.",
  );
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      await live?.stop();
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
}
