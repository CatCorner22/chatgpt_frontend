// Rehearse static submission intake in a disposable directory with a marked software fixture.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const repo = fileURLToPath(new URL("../", import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), "river-kiln-designer-fixture-"));
try {
  const returned = join(scratch, "dist");
  const baseline = await JSZip.loadAsync(
    await readFile(join(repo, "public/examples/river-kiln-booking-pilot.zip")),
    { checkCRC32: true },
  );
  for (const file of baseline.file(/^samples\/original\//)) {
    const path = join(returned, file.name.slice("samples/original/".length));
    await mkdir(dirname(path), { recursive: true });
    const bytes = await file.async("nodebuffer");
    await writeFile(
      path,
      file.name.endsWith(".css")
        ? Buffer.concat([bytes, Buffer.from("\n/* Disposable intake regression fixture. */\n")])
        : bytes,
    );
  }
  const receipt = join(scratch, "submission.json");
  const inputs = await readFile(join(repo, "docs/examples/river-kiln-builder.zip"));
  await writeFile(
    receipt,
    JSON.stringify({
      inputsSha256: createHash("sha256").update(inputs).digest("hex"),
      creatorCode: "software-fixture",
      provenance: "Temporary software test. Exclude this fixture from all participant studies.",
      permissionForStudy: true,
      builtIndependently: true,
      work: { tools: "Test fixture", minutes: 0, revisionPasses: 0 },
    }),
  );
  const kit = join(scratch, "fixture.zip");
  for (const args of [
    ["scripts/build-booking-pilot.mjs", "--designer", returned, receipt, kit],
    ["scripts/test-portable-booking-pilot.mjs", kit],
  ])
    execFileSync(process.execPath, args, { cwd: repo, stdio: "inherit", timeout: 180000 });
} finally {
  await rm(scratch, { recursive: true, force: true });
}
