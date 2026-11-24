import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadChecks, serveLocalFile, SCENARIOS } from "../north-star-audit.mjs";

test("loads ten standalone ES2022 functions without a runtime TypeScript helper", async () => {
  const checks = await loadChecks();
  assert.equal(checks.length, 10);
  assert.equal(new Set(checks.map((check) => check.ruleId)).size, 10);
  for (const check of checks) {
    assert.match(check.source, /^function check/);
    assert.doesNotMatch(check.source, /\b(?:import|export|Finding|__awaiter|__spreadArray)\b/);
  }
});

test("scenario matrix includes three widths and preference/spacing variants", () => {
  assert.deepEqual(
    SCENARIOS.slice(0, 3).map((scenario) => scenario.viewport.width),
    [320, 768, 1440],
  );
  assert.ok(SCENARIOS.some((scenario) => scenario.preferences.reducedMotion === "reduce"));
  assert.ok(SCENARIOS.some((scenario) => scenario.preferences.forcedColors === "active"));
  assert.ok(SCENARIOS.some((scenario) => scenario.textSpacing));
});

test("local fixture server rejects hidden paths and symlinks escaping the chosen directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "north-star-server-"));
  let server;
  try {
    await mkdir(join(directory, "site"));
    await writeFile(join(directory, "site", "page.html"), "<!doctype html><title>Example</title>");
    await writeFile(join(directory, "site", ".secret.json"), '{"private":true}');
    await writeFile(join(directory, "outside.json"), '{"outside":true}');
    await symlink(join(directory, "outside.json"), join(directory, "site", "escape.json"));
    server = await serveLocalFile(join(directory, "site", "page.html"));
    const original = "<!doctype html><title>Example</title>";
    assert.equal(server.entryHtml.sha256, createHash("sha256").update(original).digest("hex"));
    await writeFile(join(directory, "site", "page.html"), "Changed after the audit began");
    assert.equal(await (await fetch(server.url)).text(), original);
    const origin = new URL(server.url).origin;
    assert.equal((await fetch(`${origin}/.secret.json`)).status, 403);
    assert.equal((await fetch(`${origin}/escape.json`)).status, 403);
    assert.equal((await fetch(server.url, { method: "POST" })).status, 405);
  } finally {
    if (server) await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
