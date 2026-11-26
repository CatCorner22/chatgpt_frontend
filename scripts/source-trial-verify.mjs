#!/usr/bin/env node
// Read-only recipient checker. Packaging replaces only the fixed digest marker below.
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { basename, dirname, join, parse, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const EXPECTED_BUNDLE_HASHES = /* FOCUS_BUNDLE_HASHES */ null;
const COMPANIONS = [
  "AGENT-HANDOFF.md",
  "START-HERE.md",
  "TRIAL-PLAN.md",
  "github-trial.mjs",
  "forward.patch",
  "rollback.patch",
  "trial-contract.json",
];
const LIMITS = {
  component: 131072,
  stylesheet: 65536,
  growth: 2048,
  v2Growth: 8192,
  font: 192 * 1024,
  license: 16 * 1024,
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
  const v2 = contract?.version === 2;
  const growth = v2 ? LIMITS.v2Growth : LIMITS.growth;
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
    ...(v2 ? ["typography", "bookingLayout", "assets"] : []),
  ]);
  if (
    ![1, 2].includes(contract.version) ||
    contract.adapter !== (v2 ? "react-vite-css-module-v2" : "react-vite-css-module-v1") ||
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
      file.afterBytes > file.beforeBytes + growth
    )
      fail("Invalid trial byte bounds.");
    digest(file.beforeSha256);
    digest(file.afterSha256);
    if (file.beforeSha256 === file.afterSha256) fail("The trial must change both declared files.");
  });
  if (
    contract.files.reduce((total, file) => total + file.afterBytes, 0) >
    LIMITS.component + LIMITS.stylesheet + growth
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
    const expected =
      v2 && contract.typography === "preserve"
        ? properties[role].filter((property) => property !== "font-family")
        : properties[role];
    if (JSON.stringify(effective.changedProperties[role]) !== JSON.stringify(expected))
      fail("Unsupported trial property changes.");
  }
  if (v2) validateAssets(contract);
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

function validateAssets(contract) {
  if (
    !["preserve", "portable"].includes(contract.typography) ||
    !["compact", "compare"].includes(contract.bookingLayout) ||
    !Array.isArray(contract.assets)
  )
    fail("Unsupported source-trial options.");
  if (contract.typography === "preserve") {
    if (contract.assets.length) fail("Preserved typography cannot create font files.");
    return;
  }
  const families = new Set(
    [contract.effective.headingFont, contract.effective.bodyFont].map((family) =>
      family.toLowerCase().replace(/ /g, "-"),
    ),
  );
  if (contract.assets.length !== families.size * 2) fail("Incomplete font and license set.");
  const css = contract.files[1].path;
  const prefix = css.slice(0, css.lastIndexOf("/") + 1);
  const entries = new Set();
  const identity = [
    contract.design.id,
    contract.design.fingerprint,
    contract.sourceFingerprint,
    contract.typography,
    contract.bookingLayout,
  ];
  const directory = "focus-assets-" + hash(JSON.stringify(identity)).slice(0, 12);
  for (const asset of contract.assets) {
    keys(asset, ["path", "bytes", "sha256"]);
    digest(asset.sha256);
    if (typeof asset.path !== "string" || !asset.path.startsWith(prefix))
      fail("Unexpected font asset path.");
    const match =
      /^(focus-assets-[a-f0-9]{12})\/([a-z0-9]+(?:-[a-z0-9]+)*)-([a-f0-9]{12})\.(woff2|txt)$/.exec(
        asset.path.slice(prefix.length),
      );
    if (
      !match ||
      match[0].length > 120 ||
      match[1] !== directory ||
      !families.has(match[2]) ||
      match[3] !== asset.sha256.slice(0, 12)
    )
      fail("Unexpected font asset identity.");
    const key = match[2] + "." + match[4];
    if (entries.has(key)) fail("Duplicate font asset.");
    entries.add(key);
    if (
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes < 1 ||
      asset.bytes > (match[4] === "woff2" ? LIMITS.font : LIMITS.license)
    )
      fail("Invalid font asset byte bounds.");
  }
}

// Inspect all ancestors as well as the final entry; never follow an accepted symlink.
async function inspectPath(path, kind, allowMissing = false) {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  const parts = absolute.slice(root.length).split(/[\\/]/).filter(Boolean);
  for (let index = 0; index <= parts.length; index += 1) {
    if (index > 0) current = join(current, parts[index - 1]);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (allowMissing && error.code === "ENOENT") return null;
      throw error;
    }
    if (info.isSymbolicLink()) fail("Symlinks are not supported by this verifier.");
    const final = index === parts.length;
    if (final && kind === "file" ? !info.isFile() : !info.isDirectory())
      fail("Expected ordinary directories and regular files.");
    if (final) return info;
  }
  fail("Invalid filesystem path.");
}

async function readBounded(
  path,
  maximum,
  sizeError = "A required file is empty or exceeds its byte limit.",
  checkAssetMode = false,
) {
  const checked = await inspectPath(path, "file");
  if (checked.size < 1 || checked.size > maximum) fail(sizeError);
  if (checkAssetMode && process.platform !== "win32" && checked.mode & 0o111)
    fail("An owned font asset now has executable permissions. Preserve the change for review.");
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
    if (length > maximum) fail(sizeError);
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

function validatePatch(bytes, files, assets, reverse) {
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
  for (const asset of assets) {
    const { path, bytes } = asset;
    const zero = "0".repeat(40);
    const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (
      lines[index++] !== `diff --git a/${path} b/${path}` ||
      lines[index++] !== (reverse ? "deleted file mode 100644" : "new file mode 100644") ||
      lines[index++] !== (reverse ? `index ${blob}..${zero}` : `index ${zero}..${blob}`) ||
      lines[index++] !== "GIT binary patch"
    )
      fail("Unexpected asset path, mode, or Git object identity.");
    const empty = Buffer.alloc(0);
    for (const expected of reverse ? [empty, bytes] : [bytes, empty]) {
      if (lines[index++] !== `literal ${expected.length}`) fail("Invalid binary patch length.");
      index = verifyLiteral(lines, index, expected);
    }
  }
  if (index !== lines.length) fail("The patch contains undeclared content.");
}

const base85 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~";
function verifyLiteral(lines, index, expected) {
  // Stored DEFLATE blocks need five bytes per 65,535 bytes plus the zlib header/checksum.
  const maximum = expected.length + 5 * Math.max(1, Math.ceil(expected.length / 65535)) + 6;
  const compressed = Buffer.alloc(maximum);
  let size = 0;
  while (index < lines.length && lines[index] !== "") {
    const line = lines[index++];
    const prefix = line.charCodeAt(0);
    const count =
      prefix >= 97 && prefix <= 122 ? prefix - 70 : prefix >= 65 && prefix <= 90 ? prefix - 64 : 0;
    if (!count || line.length !== 1 + 5 * Math.ceil(count / 4) || size + count > maximum)
      fail("Invalid Git binary literal encoding.");
    const end = size + count;
    for (let pos = 1; pos < line.length; pos += 5) {
      let word = 0;
      for (let j = pos; j < pos + 5; j++) {
        const digit = base85.indexOf(line[j]);
        if (digit < 0) fail("Invalid Git binary literal encoding.");
        word = word * 85 + digit;
      }
      if (word > 0xffffffff) fail("Invalid Git binary literal encoding.");
      for (const shift of [24, 16, 8, 0]) {
        if (size < end) compressed[size++] = (word >>> shift) & 0xff;
      }
    }
  }
  if (!size || lines[index++] !== "") fail("Invalid binary patch ending.");
  try {
    const inflated = inflateSync(compressed.subarray(0, size), {
      info: true,
      maxOutputLength: Math.max(1, expected.length),
    });
    if (inflated.engine.bytesWritten === size && inflated.buffer.equals(expected)) return index;
  } catch {
    /* Malformed or oversized data. */
  }
  fail("Binary patch content differs from the sealed asset.");
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
  const assets = [];
  for (const asset of contract.assets ?? []) {
    const bytes = await readBounded(join(bundle, "assets", basename(asset.path)), asset.bytes);
    if (
      bytes.length !== asset.bytes ||
      hash(bytes) !== asset.sha256 ||
      (asset.path.endsWith(".woff2") && bytes.subarray(0, 4).toString("ascii") !== "wOF2")
    )
      fail("Bundled font asset differs from its contract.");
    assets.push({ path: asset.path, bytes });
    const target = join(project, asset.path);
    if (direction === "before") {
      if (await inspectPath(target, "file", true))
        fail("A proposed asset path already exists. Keep existing files and review the collision.");
    } else {
      const actual = await readBounded(target, asset.bytes, undefined, true);
      if (!actual.equals(bytes))
        fail(
          "A project font asset changed. Keep your changes and review the differences before continuing.",
        );
    }
  }
  validatePatch(data["forward.patch"], contract.files, assets, false);
  validatePatch(data["rollback.patch"], contract.files, assets, true);
  for (const file of contract.files) {
    const expectedBytes = file[`${direction}Bytes`];
    const mismatch =
      "The project file differs from the expected snapshot. Keep your changes and review the differences before continuing.";
    const bytes = await readBounded(join(project, file.path), expectedBytes, mismatch);
    if (bytes.length !== expectedBytes || hash(bytes) !== file[`${direction}Sha256`])
      fail(mismatch);
  }
  process.stdout.write(
    `Verified bundle integrity and both ${direction} file snapshots${assets.length ? ` and ${assets.length} asset paths` : ""} at this check. No files changed. This point-in-time result is not an application guard, build, browser test, or release approval.\n`,
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
