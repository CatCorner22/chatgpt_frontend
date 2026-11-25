import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { readDesignerReturn } from "./river-kiln-return.mjs";

test("ships the working neutral starter and consent template without the proposal or organizer map", async () => {
  const bytes = await readFile(
    new URL("../../docs/examples/river-kiln-builder.zip", import.meta.url),
  );
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const source = new URL("../../examples/booking-rehearsal/", import.meta.url);
  for (const path of [
    "src/Booking.tsx",
    "src/Booking.module.css",
    "src/main.tsx",
    "index.html",
    "booking-service.mjs",
    "vite.config.mjs",
  ]) {
    assert.deepEqual(
      await zip.file(path).async("nodebuffer"),
      await readFile(new URL(path, source)),
    );
  }
  assert.doesNotMatch(
    Object.keys(zip.files).join("\n"),
    /private|focus|proposal|screenshot|patch|results|guided/i,
  );
  assert.doesNotMatch(
    await zip.file("START-HERE.md").async("string"),
    /Focus|one-shot|Graphite Precision/,
  );
  for (const [name, sourceName] of [
    ["START-HERE.md", "BUILDER-BRIEF.md"],
    ["submission.json", "submission.json"],
  ]) {
    assert.deepEqual(
      await zip.file(name).async("nodebuffer"),
      await readFile(new URL("../../examples/river-kiln-study/" + sourceName, import.meta.url)),
    );
  }
  const task = JSON.parse(await zip.file("task.json").async("string"));
  assert.deepEqual(task.viewport, { width: 390, height: 844 });
  assert.match(task.observationProtocol, /lost-confirmation/);
  const form = JSON.parse(await zip.file("submission.json").async("string"));
  assert.equal(form.permissionForStudy, false);
  assert.equal(form.builtIndependently, false);
  const font = zip.file(/^type\/.*\.woff2$/)[0];
  assert.match(
    font.name,
    new RegExp(
      createHash("sha256")
        .update(await font.async("nodebuffer"))
        .digest("hex")
        .slice(0, 12),
    ),
  );
  assert.match(await zip.file(/^type\/.*\.txt$/)[0].async("string"), /SIL OPEN FONT LICENSE/i);
});

test("accepts only a returned static build with permission and the same inputs", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "river-kiln-return-test-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const dist = join(root, "dist");
  const path = join(root, "submission.json");
  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(join(dist, "index.html"), "Test fixture only");
  await writeFile(join(dist, "assets", "index.js"), "// fixture");
  const digest = "a".repeat(64);
  const record = { inputsSha256: digest, builtIndependently: true, permissionForStudy: false };
  await writeFile(path, JSON.stringify(record));
  await assert.rejects(readDesignerReturn(dist, path, digest), /permission/);
  record.permissionForStudy = true;
  await writeFile(path, JSON.stringify(record));
  await assert.rejects(readDesignerReturn(dist, path, "b".repeat(64)), /different frozen/);
  assert.deepEqual(
    [...(await readDesignerReturn(dist, path, digest)).files.keys()],
    ["assets/index.js", "index.html"],
  );
  await symlink(path, join(dist, "assets", "notes.txt"));
  await assert.rejects(readDesignerReturn(dist, path, digest), /regular static files/);
});
