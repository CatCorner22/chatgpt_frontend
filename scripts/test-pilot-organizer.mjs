// Local UI fixtures exercise the organizer's file transfers. They supply no human study evidence.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { launchTestBrowser } from "./browser-engine.mjs";

const origin = new URL(process.env.FOCUS_TEST_URL || "http://127.0.0.1:3000");
assert.equal(
  origin.hostname,
  "127.0.0.1",
  "Use an isolated loopback build for the organizer fixture.",
);
assert.equal(origin.protocol, "http:");
const browser = await launchTestBrowser();
const sampleFile = (name, contents) => ({
  name,
  mimeType: "application/octet-stream",
  buffer: Buffer.from(contents),
});
const jsonFile = (name, value) => ({
  ...sampleFile(name, JSON.stringify(value)),
  mimeType: "application/json",
});
const digest = (value) => createHash("sha256").update(value).digest("hex");
const errors = [];
try {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route("**/*", (route) => {
    const address = new URL(route.request().url());
    if (address.origin !== origin.origin) return route.abort();
    if (address.pathname === "/api/hosted/session")
      return route.fulfill({
        json: {
          mode: "hosted",
          user: { id: "pilot-fixture", email: null },
          storageAvailable: false,
        },
      });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  async function download(label) {
    const [event] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: label, exact: true }).click(),
    ]);
    return JSON.parse(await readFile(await event.path(), "utf8"));
  }
  await page.goto(new URL("/review-room", origin).href);
  await page.getByRole("button", { name: "Open private organizer workspace" }).click();
  await page.getByRole("button", { name: "Start booking and editorial pilot" }).click();
  const empty = await download("Download private draft");
  assert.equal(empty.samples.length, 0);
  const pilot = { ...empty, tasks: empty.tasks.slice(0, 1) };
  await page.getByLabel(/Open private organizer file/).setInputFiles(jsonFile("pilot.json", pilot));
  await page.getByText("1 task · 0 of 3 submissions recorded.").waitFor();
  await page.getByText("Add a real submission", { exact: true }).click();
  for (const [index, group] of ["one-shot", "guided", "expert"].entries()) {
    await page.locator('select[name="group"]').selectOption(group);
    await page.getByLabel("Neutral sample address").fill(`https://review.invalid/page-${index}`);
    await page.getByLabel("Creator code").fill(`private-maker-${index}`);
    await page.getByLabel("Source and permission").fill("Internal fixture for codec tests");
    await page.getByLabel("Tools used").fill("Fixture fabrication");
    await page.getByLabel("Time spent in minutes").fill("48");
    if (index) await page.getByLabel("Revision passes").fill("1");
    await page
      .getByLabel(/Frozen brief and assets/)
      .setInputFiles(sampleFile("brief.txt", "Protocol fixture"));
    await page
      .getByLabel(/Finished build or image/)
      .setInputFiles(sampleFile("candidate.html", `Fixture ${index}`));
    await page.getByRole("button", { name: "Record submission" }).click();
    await page.getByText(`1 task · ${index + 1} of 3 submissions recorded.`).waitFor();
  }
  const saved = await download("Download private draft");
  assert.equal(saved.samples[1].artifactSha256, digest("Fixture 1"));
  assert.equal(saved.samples[0].inputsSha256, digest("Protocol fixture"));
  const packet = await download("Download shuffled reviewer packet");
  assert.equal(packet.samples.length, 3);
  assert.doesNotMatch(
    JSON.stringify(packet),
    /private-maker|Fixture fabrication|artifactSha256|provenance/,
  );
  const answers = {
    version: 1,
    benchmarkId: pilot.id,
    evaluations: saved.samples.map((sample, index) => ({
      benchmarkId: pilot.id,
      reviewerCode: "fixture-reader",
      sampleId: sample.id,
      taskOutcome: "completed",
      judgedOrigin: "unsure",
      quality: {
        hierarchy: 4 + index,
        typography: 4,
        composition: 4,
        distinctiveness: 4,
        interaction: 4,
        content: 4,
      },
      note: "Synthetic test row.",
    })),
  };
  await page
    .getByLabel(/Calculate results from answer files/)
    .setInputFiles(jsonFile("answers.json", answers));
  const findings = await download("Download findings");
  assert.equal(findings.tasks[0].completeTriples, 1);
  assert.equal(findings.tasks[0].quality.hierarchy.remainingExpertGap, 1);
  await page.getByRole("button", { name: "Return to reviewer room" }).click();
  await page.getByRole("button", { name: "Leave organizer", exact: true }).click();
  await page.getByLabel(/Reviewer packet · JSON/).setInputFiles(jsonFile("packet.json", packet));
  await page.getByRole("link", { name: /Open sample page/ }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Open private organizer workspace" }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Organizer UI passed local draft, real file fingerprints, masked packet, fixture answers, matched report, and participant isolation.",
  );
} finally {
  await browser.close();
}
