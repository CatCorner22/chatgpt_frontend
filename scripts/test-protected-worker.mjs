// Run browser journeys against the packaged Sites Worker, with disposable local state.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createTestHarness } from "wrangler";

const worker = createTestHarness({ workers: [{ configPath: "dist/server/wrangler.json" }] });
const abort = new AbortController();
const cancel = () => abort.abort();
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);

try {
  const { url } = await worker.listen();
  assert.equal(url.hostname, "127.0.0.1");
  const response = await fetch(url, { signal: abort.signal });
  assert.equal(response.status, 200, "Packaged Worker should serve the Garden");
  await response.body.cancel();

  for (const script of [
    "test-protected-design-journey.mjs",
    "test-comparison-phone.mjs",
    "test-garden-journey.mjs",
    "test-autosave-navigation.mjs",
    "test-copy-ownership.mjs",
    "test-authored-pages.mjs",
    "test-existing-transfer.mjs",
    "test-pilot-organizer.mjs",
  ]) {
    console.log(`\nRunning ${script} against ${url.origin}`);
    const child = spawn(process.execPath, [`scripts/${script}`], {
      stdio: "inherit",
      env: { ...process.env, FOCUS_TEST_URL: url.origin, FOCUS_BROWSER: "chromium" },
      signal: abort.signal,
    });
    const [code, signal] = await once(child, "exit");
    assert.equal(code, 0, `${script} failed (${signal ?? code})`);
  }
} finally {
  await worker.close();
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
