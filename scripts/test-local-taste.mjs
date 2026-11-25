import { useLoopbackSession } from "./fixtures/saved-studio.mjs";
import { launchChromium } from "./browser-engine.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const target = process.env.FOCUS_TEST_URL || "http://localhost:3000";
const browser = await launchChromium();
try {
  const page = await browser.newPage();
  await useLoopbackSession(page, target, "taste-fixture");
  const posts = [],
    errors = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${target}/taste`, { waitUntil: "networkidle" });
  await page.getByLabel("What do you love?").fill("Calm architecture and clear editorial pages");
  await page.getByLabel("What feels wrong for you? (optional)").fill("Cluttered navigation");
  assert.equal(
    await page.getByRole("button", { name: "Save my inspirations", exact: true }).count(),
    1,
  );
  await page.getByRole("button", { name: "Save my inspirations", exact: true }).click();
  await page.getByText("Inspirations saved in this browser", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Create my portrait", exact: true }).count(),
    0,
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("What do you love?").inputValue(),
    "Calm architecture and clear editorial pages",
  );
  assert.equal(
    await page.getByLabel("What feels wrong for you? (optional)").inputValue(),
    "Cluttered navigation",
  );
  assert.deepEqual(posts, []);
  assert.deepEqual(errors, []);
  const result = {
    at: new Date().toISOString(),
    target,
    status: "passed",
    checks: [
      "paused AI offers working local preference save",
      "both notes survive reload",
      "no server POST or paid call",
    ],
    pageErrors: errors,
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/LOCAL-TASTE-BROWSER.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
