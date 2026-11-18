import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import JSZip from "jszip";
import { normalizeTokens } from "@/lib/design";
import { prepareSourceTrial } from "@/lib/source-trial";
import { buildSourceTrialPackage, SOURCE_TRIAL_KICKOFF } from "@/lib/source-trial-package";
import { EMPTY_TARGET_DRAFT, type TargetDraft } from "@/lib/target";

const files = [
  {
    path: "src/Booking.tsx",
    content:
      "import styles from './Booking.module.css'; export default function Booking(){ return <main className={styles.page}><h1 className={styles.heading}>Book</h1><p className={styles.body}>Choose a date.</p><a className={styles.action} href='/book'>Continue</a></main> }\n",
  },
  {
    path: "src/Booking.module.css",
    content:
      ".page{background-color:#f4f8fa}.heading{color:#111}.body{color:#222}.action{background-color:#333;color:#fff}\n",
  },
];
const draft: TargetDraft = {
  ...EMPTY_TARGET_DRAFT,
  designId: "design-trial-1",
  page: "Booking page",
  improvement: "Make the main action clearer",
  tasks: "Book, correct invalid information, and retry a failed submission",
  backup: "Named baseline and a separate copy of uncommitted work",
  preview: "An isolated local preview with test data and sandbox services",
  rollback: "Reverse only this trial after checking both resulting file hashes",
};
const temporary: string[] = [];
const bundleFiles = [
  "AGENT-HANDOFF.md",
  "START-HERE.md",
  "TRIAL-PLAN.md",
  "forward.patch",
  "rollback.patch",
  "trial-contract.json",
  "verify.mjs",
];
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function prepare(source = files) {
  return prepareSourceTrial(source, {
    id: draft.designId,
    tokens: normalizeTokens({ bg: "#F4F8FA", accent: "#2156B8", radius: 8 }),
  });
}

async function fixture(source = files) {
  const base = await mkdtemp(join(tmpdir(), "focus-source-trial-package-"));
  temporary.push(base);
  const project = join(base, "project");
  await mkdir(join(project, "src"), { recursive: true });
  for (const file of source) {
    await mkdir(dirname(join(project, file.path)), { recursive: true });
    await writeFile(join(project, file.path), file.content);
  }
  await writeFile(join(project, "unrelated.txt"), "Keep this later work.\n");
  const prepared = await prepare(source);
  const zip = await JSZip.loadAsync(
    await buildSourceTrialPackage(prepared, { draft, designTitle: "Clear booking" }),
    { checkCRC32: true },
  );
  const bundle = join(base, "focus-source-trial");
  await mkdir(bundle);
  for (const file of Object.values(zip.files).filter((file) => !file.dir)) {
    expect(file.name).toMatch(/^focus-source-trial\/[A-Za-z.-]+$/);
    await writeFile(join(base, file.name), await file.async("nodebuffer"), { flag: "wx" });
  }
  return { base, project, prepared, zip, bundle };
}

async function snapshot(root: string, prefix = ""): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(result, await snapshot(root, path));
    else if (entry.isFile()) result[path] = digest(await readFile(join(root, path)));
  }
  return result;
}

function verify(bundle: string, project: string, direction = "before") {
  return spawnSync(process.execPath, [join(bundle, "verify.mjs"), direction, project], {
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
}

function applyOwnedFixturePatch(bundle: string, project: string, patch: string, check = false) {
  return spawnSync(
    "git",
    ["-C", project, "apply", ...(check ? ["--check"] : []), join(bundle, patch)],
    {
      encoding: "utf8",
      timeout: 10_000,
    },
  );
}

/** Deliberately rebuild the non-authenticating integrity manifest to exercise validation too. */
async function reseal(bundle: string) {
  const hashes = Object.fromEntries(
    await Promise.all(
      bundleFiles
        .filter((name) => name !== "verify.mjs")
        .map(async (name) => [name, digest(await readFile(join(bundle, name)))]),
    ),
  );
  const raw = await readFile(resolve("scripts/source-trial-verify.mjs"), "utf8");
  await writeFile(
    join(bundle, "verify.mjs"),
    raw.replace("/* FOCUS_BUNDLE_HASHES */ null", JSON.stringify(hashes)),
  );
}

describe("source trial package: actual ZIP and read-only recipient verifier", () => {
  it("exports only seven fixed files in a separate folder and verifies both exact snapshots without writes", async () => {
    const f = await fixture();
    expect(
      Object.values(f.zip.files)
        .filter((file) => !file.dir)
        .map((file) => file.name)
        .sort(),
    ).toEqual(bundleFiles.map((name) => `focus-source-trial/${name}`).sort());
    const original = await snapshot(f.base);
    const before = verify(f.bundle, f.project);
    expect(before.status, before.stderr).toBe(0);
    expect(before.stdout).toMatch(/point-in-time|at this check/i);
    expect(await snapshot(f.base)).toEqual(original);
    expect(verify(f.bundle, f.project, "after").status).not.toBe(0);
    const applicable = applyOwnedFixturePatch(f.bundle, f.project, "forward.patch", true);
    expect(applicable.status, applicable.stderr).toBe(0);
    const applied = applyOwnedFixturePatch(f.bundle, f.project, "forward.patch");
    expect(applied.status, applied.stderr).toBe(0);
    await writeFile(join(f.project, "unrelated.txt"), "Later unrelated work survives.\n");
    const trial = await snapshot(f.base);
    const after = verify(f.bundle, f.project, "after");
    expect(after.status, after.stderr).toBe(0);
    expect(await snapshot(f.base)).toEqual(trial);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
    const reversible = applyOwnedFixturePatch(f.bundle, f.project, "rollback.patch", true);
    expect(reversible.status, reversible.stderr).toBe(0);
    const reversed = applyOwnedFixturePatch(f.bundle, f.project, "rollback.patch");
    expect(reversed.status, reversed.stderr).toBe(0);
    expect(verify(f.bundle, f.project).status).toBe(0);
    for (const file of f.prepared.files)
      expect(await readFile(join(f.project, file.path), "utf8")).toBe(file.before);
    expect(await readFile(join(f.project, "unrelated.txt"), "utf8")).toBe(
      "Later unrelated work survives.\n",
    );
  });

  it("rejects drift, partial application and missing files without changing anything", async () => {
    const f = await fixture();
    for (const file of f.prepared.files) {
      await writeFile(join(f.project, file.path), `${file.before}\nprivate-source-sentinel`);
      const before = await snapshot(f.base);
      const result = verify(f.bundle, f.project);
      expect(result.status).not.toBe(0);
      expect(result.stderr).not.toContain("private-source-sentinel");
      expect(await snapshot(f.base)).toEqual(before);
      await writeFile(join(f.project, file.path), file.before);
    }
    const first = f.prepared.files[0]!;
    await writeFile(join(f.project, first.path), first.after);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
    expect(verify(f.bundle, f.project, "after").status).not.toBe(0);
    await rm(join(f.project, first.path));
    expect(verify(f.bundle, f.project).status).not.toBe(0);
  });

  it("accepts deeply nested supported paths and normalized uppercase palette values", async () => {
    const nested = files.map((file) => ({
      ...file,
      path: file.path.replace("src/", "a/b/c/d/e/f/g/h/i/j/k/"),
    }));
    const f = await fixture(nested);
    const result = verify(f.bundle, f.project);
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    "AGENT-HANDOFF.md",
    "forward.patch",
    "rollback.patch",
    "trial-contract.json",
    "START-HERE.md",
    "TRIAL-PLAN.md",
  ])("rejects corrupted companion %s", async (name) => {
    const f = await fixture();
    await writeFile(join(f.bundle, name), "corrupted-bundle-sentinel");
    const before = await snapshot(f.base);
    const result = verify(f.bundle, f.project);
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain("corrupted-bundle-sentinel");
    expect(await snapshot(f.base)).toEqual(before);
  });

  it.each([
    "../outside.tsx",
    "/tmp/outside.tsx",
    "src/../Booking.tsx",
    "src\\Booking.tsx",
    "src/CON.tsx",
    "secrets/Booking.tsx",
    "-unsafe/Booking.tsx",
    "a/b/c/d/e/f/g/h/i/j/k/l/Booking.tsx",
    "src/Booking.tsx/",
  ])("rejects a self-consistent but unsafe contract path %s", async (unsafe) => {
    const f = await fixture();
    const contract = structuredClone(f.prepared.contract);
    contract.files[0]!.path = unsafe;
    await writeFile(join(f.bundle, "trial-contract.json"), JSON.stringify(contract));
    await reseal(f.bundle);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
  });

  it("rejects inconsistent patch hashes, excessive files and oversized files even when companion hashes match", async () => {
    const f = await fixture();
    const original = JSON.stringify(f.prepared.contract);
    const contract = structuredClone(f.prepared.contract);
    contract.patchSha256 = "0".repeat(64);
    await writeFile(join(f.bundle, "trial-contract.json"), JSON.stringify(contract));
    await reseal(f.bundle);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
    await writeFile(
      join(f.bundle, "trial-contract.json"),
      JSON.stringify({ ...contract, files: [...contract.files, contract.files[0]] }),
    );
    await reseal(f.bundle);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
    await writeFile(join(f.bundle, "trial-contract.json"), original);
    await reseal(f.bundle);
    await writeFile(join(f.project, files[0]!.path), Buffer.alloc(140_000));
    expect(verify(f.bundle, f.project).status).not.toBe(0);
  });

  it("rejects source symlinks, symlink ancestors, bundle symlinks and non-regular source entries", async () => {
    const f = await fixture();
    const target = join(f.project, files[0]!.path);
    const outside = join(f.base, "outside.tsx");
    await writeFile(outside, files[0]!.content);
    await rm(target);
    await symlink(outside, target);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
    await rm(target);
    await mkdir(target);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
    const linkedRoot = join(f.base, "linked-project");
    await symlink(f.project, linkedRoot);
    expect(verify(f.bundle, linkedRoot).status).not.toBe(0);
    await rm(target, { recursive: true });
    await writeFile(target, files[0]!.content);
    const originalSource = join(f.base, "original-source");
    await rename(join(f.project, "src"), originalSource);
    await symlink(originalSource, join(f.project, "src"));
    expect(verify(f.bundle, f.project).status).not.toBe(0);
    await rm(join(f.project, "src"));
    await rename(originalSource, join(f.project, "src"));
    const forward = join(f.bundle, "forward.patch");
    const forwardOutside = join(f.base, "outside.patch");
    await writeFile(forwardOutside, await readFile(forward));
    await rm(forward);
    await symlink(forwardOutside, forward);
    expect(verify(f.bundle, f.project).status).not.toBe(0);
  });

  it("keeps owner prose literal and labels the manual procedure and evidence limits", async () => {
    const prepared = await prepare();
    const zip = await JSZip.loadAsync(
      await buildSourceTrialPackage(prepared, {
        draft: {
          ...draft,
          improvement:
            "```sh\n$(touch owned)\n``` <script>secret</script> [click](https://evil.invalid)",
        },
        designTitle: "<img src=x> `shell`",
      }),
    );
    const guide = await zip.file("focus-source-trial/START-HERE.md")!.async("string");
    const plan = await zip.file("focus-source-trial/TRIAL-PLAN.md")!.async("string");
    expect(plan).not.toMatch(/```sh|<script>|<img|\[click\]\(https:/);
    expect(plan).toContain("&lt;script&gt;");
    expect(guide).toMatch(/git[^\n]+apply --check/);
    expect(guide).toMatch(/point-in-time/);
    expect(guide).toMatch(/does not authenticate|not authenticate/);
    expect(guide).toMatch(/after.*rollback|rollback.*after/s);
    expect(plan).toMatch(/not-run|not run/);
    expect(plan).toMatch(/browser.*pending|browser.*not run/i);
  });

  it("requests the exact mapped files and separate evidence without claiming a runtime result", async () => {
    const source = files.map((file) => ({
      path: file.path.replace("src/Booking", "src/flow/booking_page"),
      content: file.content.replace("./Booking.module.css", "./booking_page.module.css"),
    }));
    const prepared = await prepare(source);
    const zip = await JSZip.loadAsync(
      await buildSourceTrialPackage(prepared, { draft, designTitle: "Returned file comparison" }),
      { checkCRC32: true },
    );
    for (const name of ["START-HERE.md", "AGENT-HANDOFF.md"]) {
      const guide = await zip.file(`focus-source-trial/${name}`)!.async("string");
      for (const file of prepared.contract.files) expect(guide).toContain(`\`${file.path}\``);
      expect(guide).toMatch(/owner.*exact original TSX and CSS/i);
      expect(guide).toMatch(/return.*exact final TSX and CSS/i);
      expect(guide).toMatch(/do not reformat/i);
      expect(guide).toMatch(/evidence report separately/i);
      expect(guide).toMatch(/selected file byte identity/i);
      expect(guide).toMatch(/does not prove.*deployment.*tests/s);
      expect(guide).not.toContain("unavailable safe preview");
      expect(guide).toMatch(/independently authorized isolated source\/build checks/);
      expect(guide).toMatch(
        /rendered preview is unavailable.*browser and visitor checks as not-run/s,
      );
      expect(guide).toMatch(/not a completed trial/);
      if (name === "START-HERE.md")
        expect(guide).toContain("unrelated work, including later edits, is unchanged by reversal");
    }
    expect(SOURCE_TRIAL_KICKOFF).toMatch(/exact final TSX and CSS/);
    expect(SOURCE_TRIAL_KICKOFF).toMatch(/separate evidence report/);
    expect(
      Object.values(zip.files)
        .filter((file) => !file.dir)
        .map((file) => file.name)
        .sort(),
    ).toEqual(bundleFiles.map((name) => `focus-source-trial/${name}`).sort());
    expect(
      JSON.parse(await zip.file("focus-source-trial/trial-contract.json")!.async("string")),
    ).toEqual(prepared.contract);
  });

  it("refuses stale identity, unsupported context, incomplete scope and tampered prepared artifacts", async () => {
    const prepared = await prepare();
    for (const changes of [
      { designId: "another" },
      { integration: "new" as const },
      { platform: "wordpress" as const },
      { backup: "" },
      { tasks: "" },
    ]) {
      await expect(
        buildSourceTrialPackage(prepared, {
          draft: { ...draft, ...changes },
          designTitle: "Trial",
        }),
      ).rejects.toThrow();
    }
    await expect(
      buildSourceTrialPackage(
        { ...prepared, patch: `${prepared.patch}tamper` },
        { draft, designTitle: "Trial" },
      ),
    ).rejects.toThrow();
  });

  it("captures a coherent proposal and context before deferred digest checks", async () => {
    const prepared = await prepare();
    const originalPatch = prepared.patch;
    const originalContract = structuredClone(prepared.contract);
    const context = { draft: { ...draft }, designTitle: "Original title" };
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(async (algorithm, data) => {
      entered();
      await gate;
      return originalDigest(algorithm, data);
    });
    const pending = buildSourceTrialPackage(prepared, context);
    await started;
    prepared.patch += "mutated-patch-sentinel";
    prepared.contract.files[0].path = "../wrong.tsx";
    prepared.files[0].after += "mutated-source-sentinel";
    context.draft.page = "mutated-context-sentinel";
    context.designTitle = "mutated-title-sentinel";
    release();
    const zip = await JSZip.loadAsync(await pending, { checkCRC32: true });
    expect(await zip.file("focus-source-trial/forward.patch")!.async("string")).toBe(originalPatch);
    expect(
      JSON.parse(await zip.file("focus-source-trial/trial-contract.json")!.async("string")),
    ).toEqual(originalContract);
    const plan = await zip.file("focus-source-trial/TRIAL-PLAN.md")!.async("string");
    expect(plan).toContain("Original title");
    expect(plan).toContain(draft.page);
    expect(plan).not.toMatch(/mutated-.*-sentinel/);
  });
});
