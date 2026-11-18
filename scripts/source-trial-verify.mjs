#!/usr/bin/env node
// Read-only recipient checker. Packaging replaces only the fixed digest marker below.
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_BUNDLE_HASHES = /* FOCUS_BUNDLE_HASHES */ null;
const COMPANIONS = [
  "AGENT-HANDOFF.md",
  "START-HERE.md",
  "TRIAL-PLAN.md",
  "forward.patch",
  "rollback.patch",
  "trial-contract.json",
];
const LIMITS = {
  component: 131072,
  stylesheet: 65536,
  growth: 2048,
  patch: 524288,
  contract: 65536,
  document: 65536,
};
const SHA256 = /^[a-f0-9]{64}$/;
const HEX = /^#[a-f0-9]{6}$/;
const fail = (message) => {
  throw new Error(message);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function keys(value, names) {
  if (!object(value) || Object.keys(value).sort().join("|") !== [...names].sort().join("|"))
    fail("Invalid trial contract structure.");
}
function text(value, max) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > max ||
    /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\ufeff\ud800-\udfff]/u.test(value)
  )
    fail("Invalid trial contract text.");
}
function digest(value) {
  if (typeof value !== "string" || !SHA256.test(value)) fail("Invalid trial digest.");
}
function color(value) {
  if (typeof value !== "string" || !HEX.test(value)) fail("Invalid trial color.");
}
function stringList(value, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems)
    fail("Invalid trial list.");
  for (const item of value) text(item, maxLength);
}
function relativePath(value) {
  text(value, 200);
  const parts = value.split("/");
  const blocked = new Set(["node_modules", "dist", "build", "coverage", "vendor", "secrets"]);
  if (
    parts.length > 12 ||
    parts.some(
      (part) =>
        !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}$/.test(part) ||
        part.endsWith(".") ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) ||
        blocked.has(part.toLowerCase()),
    )
  )
    fail("Unsafe trial file path.");
  return value;
}
function validateContract(contract) {
  keys(contract, [
    "version",
    "adapter",
    "status",
    "design",
    "sourceFingerprint",
    "files",
    "patchSha256",
    "inversePatchSha256",
    "inspection",
    "effective",
    "limits",
    "tasks",
  ]);
  if (
    contract.version !== 1 ||
    contract.adapter !== "react-vite-css-module-v1" ||
    contract.status !== "static-checks-complete"
  )
    fail("Unsupported trial contract.");
  keys(contract.design, ["id", "fingerprint"]);
  text(contract.design.id, 200);
  if (contract.design.id.trim() !== contract.design.id) fail("Invalid trial design identity.");
  digest(contract.design.fingerprint);
  digest(contract.sourceFingerprint);
  digest(contract.patchSha256);
  digest(contract.inversePatchSha256);
  if (!Array.isArray(contract.files) || contract.files.length !== 2)
    fail("The trial must describe exactly two files.");
  const seen = new Set();
  contract.files.forEach((file, index) => {
    keys(file, ["path", "beforeBytes", "afterBytes", "beforeSha256", "afterSha256"]);
    const path = relativePath(file.path);
    if (seen.has(path.toLowerCase())) fail("Duplicate trial file paths.");
    seen.add(path.toLowerCase());
    if (!(index === 0 ? /\.tsx$/.test(path) : /\.module\.css$/.test(path)))
      fail("Unsupported trial file types or order.");
    const maximum = index === 0 ? LIMITS.component : LIMITS.stylesheet;
    if (
      !Number.isSafeInteger(file.beforeBytes) ||
      file.beforeBytes < 1 ||
      file.beforeBytes > maximum ||
      !Number.isSafeInteger(file.afterBytes) ||
      file.afterBytes < 1 ||
      file.afterBytes > file.beforeBytes + LIMITS.growth
    )
      fail("Invalid trial byte bounds.");
    digest(file.beforeSha256);
    digest(file.afterSha256);
    if (file.beforeSha256 === file.afterSha256) fail("The trial must change both declared files.");
  });
  if (
    contract.files.reduce((total, file) => total + file.afterBytes, 0) >
    LIMITS.component + LIMITS.stylesheet + LIMITS.growth
  )
    fail("The trial exceeds its combined byte limit.");
  keys(contract.inspection, [
    "componentName",
    "componentPath",
    "stylesheetPath",
    "ground",
    "roles",
  ]);
  const inspection = contract.inspection;
  text(inspection.componentName, 64);
  if (
    !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(inspection.componentName) ||
    inspection.componentPath !== contract.files[0].path ||
    inspection.stylesheetPath !== contract.files[1].path
  )
    fail("Invalid trial inspection identity.");
  color(inspection.ground);
  keys(inspection.roles, ["heading", "body", "action"]);
  for (const role of ["heading", "body", "action"]) {
    const item = inspection.roles[role];
    keys(item, role === "action" ? ["className", "label", "element"] : ["className", "label"]);
    text(item.className, 64);
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(item.className)) fail("Invalid trial role class.");
    text(item.label, 400);
    if (role === "action" && item.element !== "a" && item.element !== "button")
      fail("Invalid trial action role.");
  }
  const effective = contract.effective;
  keys(effective, [
    "ground",
    "colors",
    "headingFont",
    "bodyFont",
    "buttonRadius",
    "changedProperties",
  ]);
  color(effective.ground);
  if (effective.ground !== inspection.ground) fail("Mismatched trial ground.");
  keys(effective.colors, ["heading", "body", "actionText", "actionBackground"]);
  for (const value of Object.values(effective.colors)) color(value);
  text(effective.headingFont, 300);
  text(effective.bodyFont, 300);
  if (
    !Number.isInteger(effective.buttonRadius) ||
    !(
      effective.buttonRadius === 999 ||
      (effective.buttonRadius >= 0 && effective.buttonRadius <= 28)
    )
  )
    fail("Invalid trial radius.");
  keys(effective.changedProperties, ["heading", "body", "action"]);
  const properties = {
    heading: ["color", "font-family"],
    body: ["color", "font-family"],
    action: ["background-color", "color", "font-family", "border-radius"],
  };
  for (const role of Object.keys(properties)) {
    if (JSON.stringify(effective.changedProperties[role]) !== JSON.stringify(properties[role]))
      fail("Unsupported trial property changes.");
  }
  stringList(contract.limits, 20, 2000);
  if (!Array.isArray(contract.tasks) || contract.tasks.length < 1 || contract.tasks.length > 20)
    fail("Invalid trial tasks.");
  const taskIds = new Set();
  for (const task of contract.tasks) {
    keys(task, ["id", "expected", "status"]);
    text(task.id, 100);
    text(task.expected, 2000);
    if (task.status !== "not-run" || taskIds.has(task.id)) fail("Invalid trial task evidence.");
    taskIds.add(task.id);
  }
}

// Inspect all ancestors as well as the final entry; never follow an accepted symlink.
async function inspectPath(path, kind) {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  const parts = absolute.slice(root.length).split(/[\\/]/).filter(Boolean);
  for (let index = 0; index <= parts.length; index += 1) {
    if (index > 0) current = join(current, parts[index - 1]);
    const info = await lstat(current);
    if (info.isSymbolicLink()) fail("Symlinks are not supported by this verifier.");
    const final = index === parts.length;
    if (final && kind === "file" ? !info.isFile() : !info.isDirectory())
      fail("Expected ordinary directories and regular files.");
    if (final) return info;
  }
  fail("Invalid filesystem path.");
}

async function readBounded(path, maximum) {
  const checked = await inspectPath(path, "file");
  if (checked.size < 1 || checked.size > maximum)
    fail("A required file is empty or exceeds its byte limit.");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const start = await handle.stat();
    if (
      !start.isFile() ||
      start.dev !== checked.dev ||
      start.ino !== checked.ino ||
      start.size !== checked.size
    )
      fail("A required file changed during verification.");
    const buffer = Buffer.alloc(maximum + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maximum) fail("A required file exceeds its byte limit.");
    const end = await handle.stat();
    const stillAtPath = await inspectPath(path, "file");
    if (
      length !== start.size ||
      end.size !== start.size ||
      end.mtimeMs !== start.mtimeMs ||
      end.ctimeMs !== start.ctimeMs ||
      stillAtPath.dev !== start.dev ||
      stillAtPath.ino !== start.ino
    )
      fail("A required file changed during verification.");
    return buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
}

function decode(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("A bundle document is not valid UTF-8.");
  }
}

function validatePatch(bytes, files) {
  const lines = decode(bytes).split("\n");
  if (lines.pop() !== "") fail("Invalid patch ending.");
  let index = 0;
  for (const file of files) {
    const path = file.path;
    if (
      lines[index++] !== `diff --git a/${path} b/${path}` ||
      lines[index++] !== `--- a/${path}` ||
      lines[index++] !== `+++ b/${path}`
    )
      fail("Patch paths do not match the trial contract.");
    const hunk = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(lines[index++] ?? "");
    if (!hunk) fail("Unsupported patch structure.");
    const oldCount = Number(hunk[2]);
    const newCount = Number(hunk[4]);
    if (
      ![...hunk.slice(1).map(Number)].every(
        (number) => Number.isSafeInteger(number) && number >= 0 && number <= LIMITS.patch,
      )
    )
      fail("Invalid patch bounds.");
    let oldLines = 0;
    let newLines = 0;
    let changed = false;
    while (oldLines < oldCount || newLines < newCount) {
      const line = lines[index++];
      if (typeof line !== "string") fail("Incomplete patch.");
      if (line.startsWith(" ")) {
        oldLines += 1;
        newLines += 1;
      } else if (line.startsWith("-")) {
        oldLines += 1;
        changed = true;
      } else if (line.startsWith("+")) {
        newLines += 1;
        changed = true;
      } else fail("Unsupported patch content.");
      if (lines[index] === "\\ No newline at end of file") index += 1;
      if (oldLines > oldCount || newLines > newCount) fail("Invalid patch line counts.");
    }
    if (!changed) fail("The patch contains an unchanged file.");
  }
  if (index !== lines.length) fail("The patch contains undeclared content.");
}

async function main() {
  const [direction, suppliedProject, ...extra] = process.argv.slice(2);
  if ((direction !== "before" && direction !== "after") || !suppliedProject || extra.length)
    fail("Usage: node verify.mjs before|after <project-dir>");
  keys(EXPECTED_BUNDLE_HASHES, COMPANIONS);
  for (const value of Object.values(EXPECTED_BUNDLE_HASHES)) digest(value);
  const bundle = dirname(fileURLToPath(import.meta.url));
  const project = resolve(suppliedProject);
  await inspectPath(bundle, "directory");
  await inspectPath(project, "directory");
  const data = {};
  for (const name of COMPANIONS) {
    const maximum = name.endsWith(".patch")
      ? LIMITS.patch
      : name.endsWith(".json")
        ? LIMITS.contract
        : LIMITS.document;
    const bytes = await readBounded(join(bundle, name), maximum);
    if (hash(bytes) !== EXPECTED_BUNDLE_HASHES[name])
      fail("Bundle integrity check failed. Obtain an intact copy before continuing.");
    data[name] = bytes;
  }
  let contract;
  try {
    contract = JSON.parse(decode(data["trial-contract.json"]));
  } catch {
    fail("The trial contract is unreadable.");
  }
  validateContract(contract);
  if (
    hash(data["forward.patch"]) !== contract.patchSha256 ||
    hash(data["rollback.patch"]) !== contract.inversePatchSha256
  )
    fail("Patch digests do not match the contract.");
  validatePatch(data["forward.patch"], contract.files);
  validatePatch(data["rollback.patch"], contract.files);
  for (const file of contract.files) {
    const expectedBytes = file[`${direction}Bytes`];
    const bytes = await readBounded(join(project, file.path), expectedBytes);
    if (bytes.length !== expectedBytes || hash(bytes) !== file[`${direction}Sha256`])
      fail(
        "The project does not match both expected whole-file snapshots. Stop and review the changed files.",
      );
  }
  process.stdout.write(
    `Verified bundle integrity and both ${direction} file snapshots at this check. No files changed. This point-in-time result is not an application guard, build, browser test, or release approval.\n`,
  );
}

main().catch((error) => {
  // Filesystem/JSON errors can contain paths or fragments. Report only our fixed messages.
  const message =
    error instanceof Error && !error.code && !error.name.includes("Syntax")
      ? error.message
      : "A required file could not be checked. Stop and inspect the bundle and isolated project paths.";
  process.stderr.write(`Verification failed: ${message.slice(0, 300)}\n`);
  process.exitCode = 1;
});
