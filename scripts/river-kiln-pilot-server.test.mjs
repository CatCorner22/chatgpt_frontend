import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { startPilot } from "./river-kiln-pilot-server.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "focus-pilot-server-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const samples = ["original", "guided"].map((group, i) => ({
    group,
    id: "page-" + i,
    taskId: "clay",
    kind: "interactive",
    assetRef: "https://fixture.invalid/" + i,
    provenance: "private-canary",
  }));
  const files = {
    "booking-service.mjs": await readFile(
      new URL("../examples/booking-rehearsal/booking-service.mjs", import.meta.url),
    ),
    "private/organizer-template.json": JSON.stringify({
      id: "study",
      protocol: "booking-pair-v1",
      samples,
    }),
    "private/packet-template.json": JSON.stringify({
      version: 1,
      benchmarkId: "study",
      samples: samples.map(({ id, taskId, kind, assetRef }) => ({
        id,
        taskId,
        kind,
        assetRef,
        label: "Sample",
      })),
    }),
    "samples/original/index.html": "compact fixture",
    "samples/original/assets/entry.js": "compact module",
    "samples/guided/index.html": "comparison fixture",
    "samples/guided/assets/entry.js": "comparison module",
    "reviewer/index.html": "review form",
    "reviewer/assets/entry.js": "reviewer module",
  };
  const manifest = [];
  for (const [path, value] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), value);
    manifest.push(createHash("sha256").update(value).digest("hex") + "  " + path);
  }
  await writeFile(join(root, "SHA256SUMS"), manifest.join("\n") + "\n");
  return root;
}

test("serves two independent practice services and a masked reviewer, then closes every port", async (t) => {
  const root = await fixture(t);
  const { reviewerUrl, organizerPath, close } = await startPilot(root);
  t.after(close);
  const packet = await (await fetch(reviewerUrl + "packet.json")).json();
  assert.equal(packet.benchmarkId, "study");
  assert.deepEqual(
    packet.samples.map((s) => s.label),
    ["Sample A", "Sample B"],
  );
  const organizer = JSON.parse(await readFile(organizerPath, "utf8"));
  const urls = [reviewerUrl, ...packet.samples.map((s) => s.assetRef)];
  assert.equal(new Set(urls).size, 3);
  assert(urls.every((url) => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(url)));
  assert.doesNotMatch(
    JSON.stringify(packet),
    /provenance|private-canary|original|guided|fixture.invalid/,
  );
  assert.equal(await (await fetch(reviewerUrl)).text(), "review form");
  for (const url of urls) {
    for (const path of ["private/organizer-template.json", "booking-service.mjs"])
      assert.equal((await fetch(url + path)).status, 404);
    assert.match(
      (await fetch(url + "assets/entry.js", { method: "HEAD" })).headers.get("content-type"),
      /javascript/,
    );
  }
  for (const sample of packet.samples) {
    const s = organizer.samples.find((row) => row.id === sample.id);
    assert.equal(s.assetRef, sample.assetRef);
    assert.equal(
      await (await fetch(s.assetRef)).text(),
      s.group === "guided" ? "comparison fixture" : "compact fixture",
    );
    assert.equal((await fetch(s.assetRef + "packet.json")).status, 404);
  }
  const email = "potter@example.test";
  const key = randomUUID();
  const post = (url, route, data) =>
    fetch(url + route, {
      method: "POST",
      headers: { origin: new URL(url).origin, "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  for (const url of packet.samples.map((s) => s.assetRef)) {
    const count = () => post(url, "api/practice-booking-count", { email }).then((r) => r.json());
    const submit = () =>
      post(url, "api/practice-bookings", {
        email,
        session: "wheel",
        key,
        scenario: "lost-response",
      });
    assert.deepEqual(await count(), { reservations: 0 });
    assert.equal((await submit()).status, 503);
    assert.equal((await submit()).status, 200);
    assert.deepEqual(await count(), { reservations: 1 });
  }
  await close();
  for (const url of urls) await assert.rejects(fetch(url));
});

test("preserves earlier private organizer files and refuses a changed kit before starting", async (t) => {
  const root = await fixture(t);
  const first = await startPilot(root);
  t.after(first.close);
  const saved = await readFile(first.organizerPath);
  await first.close();
  const next = await startPilot(root);
  t.after(next.close);
  assert.notEqual(next.organizerPath, first.organizerPath);
  assert.deepEqual(await readFile(first.organizerPath), saved);
  await next.close();
  const existing = await readdir(join(root, "private"));
  await writeFile(join(root, "samples/guided/index.html"), "Damaged download");
  await assert.rejects(startPilot(root), /differs from the supplied kit/);
  assert.deepEqual(await readdir(join(root, "private")), existing);
});
