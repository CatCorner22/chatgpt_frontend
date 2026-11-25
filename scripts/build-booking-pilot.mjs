// Build the portable observer study from the already-rehearsed customer delivery.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";
import { rolldown } from "rolldown";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(repo, "artifacts/booking-pilot");
const work = await mkdtemp(join(tmpdir(), "focus-booking-pilot-"));
const kit = join(work, "kit");
const app = join(work, "river-kiln");
const proposal = join(work, "focus-source-trial");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const json = (data) => JSON.stringify(data, null, 2) + "\n";
const time = new Date("2026-11-25T00:00:00Z");

async function collect(directory, prefix = "") {
  const files = new Map();
  for (const name of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const path = join(directory, name.name);
    const relative = prefix + name.name;
    if (name.isDirectory()) {
      for (const entry of await collect(path, relative + "/")) files.set(...entry);
    } else {
      assert(name.isFile(), "Expected a regular package file: " + relative);
      files.set(relative, await readFile(path));
    }
  }
  return files;
}

async function archive(files) {
  const zip = new JSZip();
  for (const [name, data] of files) zip.file(name, data, { date: time, createFolders: false });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function extractReceived(bytes, digest, root) {
  assert.equal(hash(bytes), digest, "Received archive differs from the recorded recipient trial.");
  const z = await JSZip.loadAsync(bytes, { checkCRC32: true });
  for (const entry of Object.values(z.files)) {
    if (entry.dir) continue;
    assert(entry.name.startsWith(root + "/") && entry.name === entry.unsafeOriginalName);
    assert(
      entry.name
        .split("/")
        .every((part) => /^[a-zA-Z0-9._-]+$/.test(part) && part !== ".." && part !== "."),
    );
    const target = resolve(work, entry.name);
    assert(target.startsWith(join(work, root) + sep));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await entry.async("nodebuffer"), { flag: "wx" });
  }
}

function run(exe, args, cwd) {
  execFileSync(exe, args, { cwd, stdio: "inherit", timeout: 180_000 });
}

async function compile(entry, dest) {
  const build = await rolldown({ input: join(repo, entry), platform: "node", logLevel: "silent" });
  try {
    await build.write({ file: dest, format: "esm", minify: true });
  } finally {
    await build.close();
  }
}

async function pathInKit(relative, bytes) {
  const path = join(kit, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: "wx" });
}

try {
  await mkdir(kit);
  const sourceBytes = await readFile(join(repo, "docs/examples/river-kiln-colleague-kit.zip"));
  const source = await JSZip.loadAsync(sourceBytes, { checkCRC32: true });
  const receiptBytes = await readFile(join(repo, "docs/examples/river-kiln-recipient.json"));
  assert.deepEqual(await source.file("evidence/receipt.json").async("nodebuffer"), receiptBytes);
  const receipt = JSON.parse(receiptBytes);
  const original = await source.file("01-original.zip").async("nodebuffer");
  const edits = await source.file("02-focus-proposal.zip").async("nodebuffer");
  await extractReceived(original, receipt.practiceZipSha256, "river-kiln");
  await extractReceived(edits, receipt.proposalZipSha256, "focus-source-trial");
  const contract = JSON.parse(await readFile(join(proposal, "trial-contract.json"), "utf8"));
  assert.equal(contract.version, 2);
  assert.equal(contract.typography, "portable");
  assert.equal(contract.bookingLayout, "compare");

  const verify = (stage) => run(process.execPath, [join(proposal, "verify.mjs"), stage, app], app);
  run("git", ["init", "--quiet"], app);
  verify("before");
  run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], app);
  const service = await readFile(join(app, "booking-service.mjs"));
  await pathInKit("booking-service.mjs", service);
  for (const pkg of ["react", "react-dom", "scheduler"]) {
    await pathInKit(
      "licenses/" + pkg + ".txt",
      await readFile(join(app, "node_modules", pkg, "LICENSE")),
    );
  }
  await pathInKit("licenses/zod.txt", await readFile(join(repo, "node_modules/zod/LICENSE")));

  const runtimePath = join(work, "benchmark.mjs");
  await compile("scripts/benchmark/runtime.ts", runtimePath);
  const { createPilotPlan, createPilotPacket, pilotManifestSchema } = await import(
    pathToFileURL(runtimePath).href
  );
  const pilot = createPilotPlan("draft", "booking-pair-v1");
  pilot.tasks[0].brief =
    "For each page, use a different made-up address ending in @example.test. Under Practice conditions, select Lose the first confirmation. Start timing after this setup and stop when you finish or decide to stop.";
  const frozen = await archive(
    new Map([
      ["river-kiln.zip", original],
      ["task.json", json(pilot.tasks[0])],
    ]),
  );
  await pathInKit("private/frozen-inputs.zip", frozen);
  const artifactHashes = [];
  for (const group of ["original", "guided"]) {
    if (group === "guided") {
      verify("before");
      const patch = join(proposal, "forward.patch");
      run("git", ["apply", "--check", patch], app);
      run("git", ["apply", patch], app);
      verify("after");
    }
    run("npm", ["run", "build"], app);
    verify(group === "guided" ? "after" : "before");
    const tree = await collect(join(app, "dist"));
    assert(tree.has("index.html"));
    if (group === "guided") {
      const hashes = new Set([...tree.values()].map(hash));
      for (const asset of contract.assets)
        assert(hashes.has(asset.sha256), "Built output lacks licensed asset " + asset.path);
    }
    await cp(join(app, "dist"), join(kit, "samples", group), { recursive: true });
    tree.set("booking-service.mjs", service);
    const artifact = await archive(tree);
    const artifactSha256 = hash(artifact);
    artifactHashes.push(artifactSha256);
    await pathInKit("private/submissions/" + group + ".zip", artifact);
    const id = "page-" + artifactSha256.slice(0, 18);
    pilot.samples.push({
      id,
      taskId: pilot.tasks[0].id,
      group,
      kind: "interactive",
      assetRef: "http://127.0.0.1:1/" + id,
      creatorCode: group === "original" ? "river-kiln-fixture" : "focus-source-trial",
      provenance:
        group === "original"
          ? "Owned Focus River Kiln sample from the archived recipient delivery. The stored submission contains the Vite build and unchanged local service."
          : "Owned Focus River Kiln sample after applying the verified source proposal. The stored submission contains the Vite build and unchanged local service. Original authoring time and revision count are unmeasured.",
      inputsSha256: hash(frozen),
      artifactSha256,
      work: null,
    });
  }
  run(
    process.execPath,
    [join(repo, "scripts/build-pilot-reviewer.mjs"), join(kit, "reviewer")],
    repo,
  );
  await compile("scripts/booking-pilot-score.ts", join(kit, "score.mjs"));
  const reviewerHash = hash(await archive(await collect(join(kit, "reviewer"))));
  pilot.id =
    "river-kiln-" + hash(json([hash(frozen), ...artifactHashes, reviewerHash])).slice(0, 24);
  const organizer = pilotManifestSchema.parse(pilot);
  const packet = createPilotPacket(
    organizer,
    organizer.samples.map((s) => s.id),
  );
  await pathInKit("private/organizer-template.json", json(organizer));
  await pathInKit("private/packet-template.json", json(packet));
  await pathInKit(
    "private/source-receipt.json",
    json({
      colleagueKitSha256: hash(sourceBytes),
      originalZipSha256: hash(original),
      proposalZipSha256: hash(edits),
      frozenInputsSha256: hash(frozen),
      reviewerBuildSha256: reviewerHash,
      samples: organizer.samples.map(({ id, group, artifactSha256 }) => ({
        id,
        group,
        artifactSha256,
      })),
    }),
  );
  await copyFile(join(repo, "scripts/river-kiln-pilot-server.mjs"), join(kit, "start.mjs"));
  await copyFile(join(repo, "docs/RIVER-KILN-PILOT.md"), join(kit, "START-HERE.md"));

  const all = await collect(kit);
  const manifest = [...all].map(([path, data]) => hash(data) + "  " + path).join("\n") + "\n";
  all.set("SHA256SUMS", manifest);
  const bytes = await archive(all);
  const finalZip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  for (const [path, expected] of all)
    assert.deepEqual(await finalZip.file(path).async("nodebuffer"), Buffer.from(expected));
  await mkdir(output, { recursive: true });
  const path = join(output, "river-kiln-pilot.zip");
  const staging = path + "." + process.pid;
  await writeFile(staging, bytes, { flag: "wx" });
  await rename(staging, path);
  console.log("Ready:", path, bytes.length, "bytes", hash(bytes), "study", organizer.id);
} finally {
  await rm(work, { recursive: true, force: true });
}
