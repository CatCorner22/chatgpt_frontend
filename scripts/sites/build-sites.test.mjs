import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { prepareSitesArtifact, validateSitesArtifact } from "../build-sites.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "focus-sites-build-"));
  for (const dir of [".openai", ".output/server/chunks", ".output/public/assets"])
    mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(
    join(root, ".openai/hosting.json"),
    JSON.stringify({ project_id: "fixture-site", d1: null, r2: "BUCKET" }),
  );
  writeFileSync(
    join(root, ".output/server/index.mjs"),
    'import { answer } from "./chunks/value.mjs"; var public_assets_data_default = {"/assets/app.js": {path: "../public/assets/app.js"}, "/robots.txt": {path: "../public/robots.txt"}}; export default {fetch(){ return new Response(String(answer)); }};',
  );
  writeFileSync(join(root, ".output/server/chunks/value.mjs"), "export const answer = 42;");
  writeFileSync(join(root, ".output/public/assets/app.js"), 'document.title = "Fixture";');
  writeFileSync(join(root, ".output/public/robots.txt"), "User-agent: *\nDisallow: /\n");
  writeFileSync(
    join(root, ".output/server/wrangler.json"),
    JSON.stringify({
      name: "fixture",
      main: "index.mjs",
      compatibility_date: "2026-11-15",
      compatibility_flags: ["nodejs_compat"],
      no_bundle: true,
      assets: { binding: "ASSETS", directory: "../public" },
    }),
  );
  return root;
}

function useFixture(fn) {
  const root = fixture();
  const clean = () => rmSync(root, { recursive: true, force: true });
  try {
    const result = fn(root);
    if (result?.then) return result.finally(clean);
    clean();
    return result;
  } catch (error) {
    clean();
    throw error;
  }
}

test("preserves every module and public asset plus logical storage declarations", async () => {
  await useFixture(async (root) => {
    const result = await prepareSitesArtifact(root);
    assert.equal(result.serverFiles, 2);
    assert.equal(result.publicFiles, 2);
    assert.equal(
      readFileSync(join(root, "dist/server/chunks/value.mjs"), "utf8"),
      "export const answer = 42;",
    );
    assert.equal(
      readFileSync(join(root, "dist/public/assets/app.js"), "utf8"),
      'document.title = "Fixture";',
    );
    const config = JSON.parse(readFileSync(join(root, "dist/server/wrangler.json"), "utf8"));
    assert.equal(config.main, "index.js");
    assert.equal(config.assets.directory, "../client");
    assert.equal(
      readFileSync(join(root, "dist/client/assets/app.js"), "utf8"),
      'document.title = "Fixture";',
    );
    assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
    assert.equal(config.r2_buckets, undefined, "physical bucket provisioning belongs to Sites");
    assert.deepEqual(JSON.parse(readFileSync(join(root, "dist/.openai/hosting.json"), "utf8")), {
      project_id: "fixture-site",
      d1: null,
      r2: "BUCKET",
    });
    const worker = await import(join(root, "dist/server/index.js"));
    assert.equal(await worker.default.fetch().text(), "42");
  });
});

test("rejects a missing imported server chunk", () =>
  useFixture((root) => {
    rmSync(join(root, ".output/server/chunks/value.mjs"));
    assert.throws(() => prepareSitesArtifact(root), /Missing Worker module/);
  }));

test("detects copied asset corruption and missing manifest", () =>
  useFixture((root) => {
    prepareSitesArtifact(root);
    writeFileSync(join(root, "dist/public/assets/app.js"), "corrupted");
    assert.throws(() => validateSitesArtifact(root), /Asset bytes changed/);
    rmSync(join(root, ".openai/hosting.json"));
    assert.throws(() => prepareSitesArtifact(root), /hosting.json/);
  }));

test("refuses static or incompatible Worker configuration", () =>
  useFixture((root) => {
    writeFileSync(
      join(root, ".openai/hosting.json"),
      JSON.stringify({ project_id: "fixture-site", static: { directory: "dist" } }),
    );
    assert.throws(() => prepareSitesArtifact(root), /Worker deployment/);
    writeFileSync(
      join(root, ".openai/hosting.json"),
      JSON.stringify({ project_id: "fixture-site" }),
    );
    writeFileSync(
      join(root, ".output/server/wrangler.json"),
      JSON.stringify({ main: "index.mjs" }),
    );
    assert.throws(() => prepareSitesArtifact(root), /ASSETS/);
  }));

for (const binding of ["d1", "r2"]) {
  test(`validates ${binding} as a logical binding string or null`, () =>
    useFixture((root) => {
      const manifest = join(root, ".openai/hosting.json");
      for (const value of [{ binding: "BUCKET" }, [], true, 42, "", "   ", " BUCKET "]) {
        writeFileSync(manifest, JSON.stringify({ project_id: "fixture-site", [binding]: value }));
        assert.throws(() => prepareSitesArtifact(root), /logical binding name/);
      }
      for (const value of [null, binding === "r2" ? "BUCKET" : "DB"]) {
        writeFileSync(manifest, JSON.stringify({ project_id: "fixture-site", [binding]: value }));
        prepareSitesArtifact(root);
        assert.equal(
          JSON.parse(readFileSync(join(root, "dist/.openai/hosting.json"), "utf8"))[binding],
          value,
        );
      }
    }));
}

test("rejects a missing client asset even when the Nitro public copy exists", () =>
  useFixture((root) => {
    prepareSitesArtifact(root);
    rmSync(join(root, "dist/client/assets/app.js"), { force: true });
    assert.throws(() => validateSitesArtifact(root), /Client asset bytes changed or missing/);
  }));

test("rejects a Nitro-declared URL that has no packaged public asset", () =>
  useFixture((root) => {
    const entry = join(root, ".output/server/index.mjs");
    writeFileSync(entry, readFileSync(entry, "utf8").replace('"/robots.txt"', '"/missing.css"'));
    assert.throws(() => prepareSitesArtifact(root), /Missing declared public asset/);
  }));
