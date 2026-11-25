#!/usr/bin/env node
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { randomInt, randomUUID } from "node:crypto";
import { rolldown } from "rolldown";

const help = `North Star benchmark organizer

  node scripts/north-star-benchmark.mjs init organizer.json
  node scripts/north-star-benchmark.mjs init-pilot organizer.json
  node scripts/north-star-benchmark.mjs init-booking-pair organizer.json
  node scripts/north-star-benchmark.mjs packet organizer.json reviewer.json [--order order.json]
  node scripts/north-star-benchmark.mjs score organizer.json report.json answers-a.json [answers-b.json ...]

init   Write a draft containing six task briefs and no invented pages or reviewers.
init-pilot Start a matched one-shot, Focus and expert comparison for booking and editorial tasks.
init-booking-pair Start a two-page River Kiln review comparing the original and its redesign.
packet Validate organizer data and export a separate neutral reviewer packet.
       Without --order, shuffle sample IDs using system randomness. For a fixed
       counterbalancing plan, supply a JSON array containing each sample ID once.
score  Merge downloaded reviewer answer bundles and evaluate after collection.

Existing output files are never overwritten. Organizer files contain source
labels and must stay private. Give reviewers only the reviewer packet.\n`;

async function json(path) {
  const content = await readFile(resolve(path), "utf8");
  if (content.length > 16 * 1024 * 1024) throw new Error(`JSON input is too large: ${path}`);
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in ${path}.`);
  }
}
async function save(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  return target;
}
async function loadRuntime() {
  // The application already installs Rolldown through Vite. The portable kit
  // keeps its own three-package contract and never imports this organizer CLI.
  const directory = await mkdtemp(join(tmpdir(), "north-star-benchmark-runtime-"));
  let bundle;
  try {
    bundle = await rolldown({
      input: fileURLToPath(new URL("./benchmark/runtime.ts", import.meta.url)),
      platform: "node",
      logLevel: "silent",
    });
    const generated = await bundle.generate({ format: "esm" });
    const chunk = generated.output.find((item) => item.type === "chunk" && item.isEntry);
    if (!chunk) throw new Error("Could not compile the benchmark runtime.");
    const output = join(directory, "runtime.mjs");
    await writeFile(output, chunk.code);
    const runtime = await import(pathToFileURL(output).href);
    return { runtime, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  } finally {
    await bundle?.close();
  }
}

async function main(args) {
  if (!args.length || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(help);
    return;
  }
  const [command, ...paths] = args;
  if (!["init", "init-pilot", "init-booking-pair", "packet", "score"].includes(command))
    throw new Error(`Unknown command: ${command}. Use --help.`);
  const init = command.startsWith("init");
  if (init && paths.length !== 1) throw new Error("init needs exactly one output file.");
  if (
    command === "packet" &&
    !(paths.length === 2 || (paths.length === 4 && paths[2] === "--order"))
  )
    throw new Error(
      "packet needs organizer.json reviewer.json, optionally followed by --order order.json.",
    );
  if (command === "score" && paths.length < 3)
    throw new Error("score needs organizer.json report.json and one or more answer files.");
  const { runtime, cleanup } = await loadRuntime();
  try {
    if (init) {
      const plan =
        command !== "init"
          ? runtime.createPilotPlan(
              randomUUID(),
              command === "init-booking-pair" ? "booking-pair-v1" : "matched-three-v1",
            )
          : runtime.createBenchmarkPlan();
      const path = await save(paths[0], plan);
      process.stdout.write(
        `Draft organizer plan written to ${path}\nNo sample pages or participant answers were invented. Add matched artifacts and genuine source provenance before making a reviewer packet.\n`,
      );
      return;
    }
    const raw = await json(paths[0]);
    const pilot = raw?.protocol === "matched-three-v1" || raw?.protocol === "booking-pair-v1";
    const manifest = (pilot ? runtime.pilotManifestSchema : runtime.benchmarkManifestSchema).parse(
      raw,
    );
    if (command === "packet") {
      for (const sample of manifest.samples) {
        let url;
        try {
          url = new URL(sample.assetRef);
        } catch {
          throw new Error(
            `Sample ${sample.id} needs an HTTP or HTTPS asset address for the review room.`,
          );
        }
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
          throw new Error(
            `Sample ${sample.id} needs an HTTP or HTTPS address without embedded credentials.`,
          );
      }
      const order =
        paths[2] === "--order" ? await json(paths[3]) : manifest.samples.map((sample) => sample.id);
      if (!Array.isArray(order) || order.some((id) => typeof id !== "string"))
        throw new Error("The order file must be a JSON array of sample IDs.");
      if (paths[2] !== "--order")
        for (let index = order.length - 1; index > 0; index--) {
          const other = randomInt(index + 1);
          [order[index], order[other]] = [order[other], order[index]];
        }
      const packet = (pilot ? runtime.createPilotPacket : runtime.createReviewerPacket)(
        manifest,
        order,
      );
      const path = await save(paths[1], packet);
      process.stdout.write(
        `Reviewer packet written to ${path}\n${packet.samples.length} samples; organizer labels and provenance excluded. Inspect the actual assets for source clues before collection.\n`,
      );
      return;
    }
    const evaluations = [];
    for (const path of paths.slice(2)) {
      const bundle = runtime.blindEvaluationBundleSchema.parse(await json(path));
      if (bundle.benchmarkId !== manifest.id)
        throw new Error(`Answer file belongs to another benchmark: ${path}`);
      evaluations.push(...bundle.evaluations);
    }
    const report = (pilot ? runtime.scorePilot : runtime.evaluateBenchmark)(manifest, evaluations);
    const path = await save(paths[1], report);
    process.stdout.write(
      `Evaluation written to ${path}\n${report.statement}\n${report.counts.completeReviewers} complete reviewer codes; ${report.counts.evaluations} ratings. Reviewer codes alone do not establish independent participants.\n`,
    );
  } finally {
    await cleanup();
  }
}

main(process.argv.slice(2)).catch((error) => {
  const message =
    error?.code === "EEXIST"
      ? "The output file already exists. Choose a new filename to preserve the existing record."
      : error?.issues
        ? error.issues
            .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
            .join("\n")
        : error instanceof Error
          ? error.message
          : "Unknown error";
  process.stderr.write(`Benchmark error: ${message}\n`);
  process.exitCode = 1;
});
