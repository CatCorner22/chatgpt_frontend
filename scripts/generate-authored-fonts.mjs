import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const vendor = new URL("../assets/vendor-fonts/", import.meta.url);
const output = new URL("../src/lib/authored-families/", import.meta.url);
const catalogLimit = 1024 * 1024;
const expectedFamilies = [
  ["instrument-serif", "Instrument Serif", "serif"],
  ["instrument-sans", "Instrument Sans", "sans-serif"],
  ["space-grotesk", "Space Grotesk", "sans-serif"],
  ["ibm-plex-sans", "IBM Plex Sans", "sans-serif"],
  ["newsreader", "Newsreader", "serif"],
  ["literata", "Literata", "serif"],
  ["outfit", "Outfit", "sans-serif"],
  ["dm-sans", "DM Sans", "sans-serif"],
  ["manrope", "Manrope", "sans-serif"],
  ["inter", "Inter", "sans-serif"],
  ["bricolage-grotesque", "Bricolage Grotesque", "sans-serif"],
  ["playfair-display", "Playfair Display", "serif"],
  ["public-sans", "Public Sans", "sans-serif"],
  ["jetbrains-mono", "JetBrains Mono", "monospace"],
  ["fraunces", "Fraunces", "serif"],
];

function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}

function readBounded(file, limit) {
  const stat = lstatSync(file);
  requireValid(
    stat.isFile() && stat.size > 0 && stat.size <= limit,
    `Unexpected size or type: ${file.pathname}`,
  );
  return readFileSync(file);
}

function verifiedBytes(entry, expectedFile, limit) {
  requireValid(entry?.file === expectedFile, `Expected fixed path ${expectedFile}`);
  const bytes = readBounded(new URL(expectedFile, vendor), limit);
  requireValid(entry.bytes === bytes.length, `Unexpected byte count: ${expectedFile}`);
  requireValid(
    createHash("sha256").update(bytes).digest("hex") === entry.sha256,
    `SHA-256 mismatch: ${expectedFile}`,
  );
  return bytes;
}

function rangeSize(value, file, disjoint = false) {
  requireValid(
    typeof value === "string" &&
      value.length <= 4096 &&
      /^U\+[\dA-F]{1,6}(?:-[\dA-F]{1,6})?(?:,\s*U\+[\dA-F]{1,6}(?:-[\dA-F]{1,6})?)*$/i.test(value),
    `Invalid Unicode ranges: ${file}`,
  );
  let previousEnd = -1;
  let size = 0;
  for (const range of value.split(",")) {
    const [startHex, endHex = startHex] = range.trim().slice(2).split("-");
    const start = Number.parseInt(startHex, 16);
    const end = Number.parseInt(endHex, 16);
    requireValid(
      start <= end && end <= 0x10ffff && (!disjoint || start > previousEnd),
      `Invalid Unicode range bounds: ${file}`,
    );
    previousEnd = end;
    size += end - start + 1;
  }
  return size;
}

function verifyFace(face, id, slug, faceCount) {
  const weight = face?.weight;
  requireValid(["400", "600", "400 600"].includes(weight), `Unexpected font weights: ${id}`);
  const weights = weight.split(" ").map(Number);
  const file = `${id}-latin-normal${faceCount === 1 ? "" : `-${weight}`}.woff2`;
  requireValid(
    JSON.stringify(face.weights) === JSON.stringify(weights) &&
      face.format === "woff2" &&
      face.style === "normal" &&
      face.subset === "latin" &&
      typeof face.source === "string" &&
      new RegExp(`^https://fonts\\.gstatic\\.com/s/${slug}/v[0-9]+/[A-Za-z0-9_-]+\\.woff2$`).test(
        face.source,
      ),
    `Unexpected face provenance: ${file}`,
  );
  const bytes = verifiedBytes(face, file, 256 * 1024);
  requireValid(
    bytes.length >= 48 &&
      bytes.toString("ascii", 0, 4) === "wOF2" &&
      bytes.readUInt32BE(8) === bytes.length &&
      bytes.readUInt16BE(12) > 0 &&
      bytes.readUInt16BE(14) === 0 &&
      bytes.readUInt32BE(20) > 0 &&
      bytes.readUInt32BE(20) <= bytes.length - 48,
    `Invalid WOFF2 header: ${file}`,
  );
  requireValid(
    Array.isArray(face.metadata?.axes) &&
      face.metadata.axes.every((axis) => axis && typeof axis.tag === "string"),
    `Missing face axis metadata: ${file}`,
  );
  const weightAxis = face.metadata.axes.find((axis) => axis.tag === "wght");
  if (weights.length > 1 || weightAxis) {
    requireValid(
      Number.isFinite(weightAxis?.min) &&
        Number.isFinite(weightAxis.max) &&
        weights.every((value) => value >= weightAxis.min && value <= weightAxis.max),
      `Declared weights exceed the audited weight axis: ${file}`,
    );
  }
  rangeSize(face.unicodeRange, file);
  requireValid(
    rangeSize(face.actualCmapRanges, file, true) === face.actualCmapCount,
    `Incorrect audited cmap count: ${file}`,
  );
  return {
    file,
    source: face.source,
    bytes: bytes.length,
    sha256: face.sha256,
    weight,
    weights,
    subset: face.subset,
    upstreamUnicodeRange: face.unicodeRange,
    unicodeRange: face.actualCmapRanges,
    base64: bytes.toString("base64"),
  };
}

function verifyFamily(family, id, name, genericFamily) {
  const slug = id.replaceAll("-", "");
  requireValid(
    family?.id === id &&
      family.name === name &&
      family.genericFamily === genericFamily &&
      Array.isArray(family.faces) &&
      family.faces.length >= 1 &&
      family.faces.length <= 2,
    `Unexpected family record: ${id}`,
  );
  const licenseFile = `licenses/${id}-OFL.txt`;
  const license = family.license;
  const licenseBytes = verifiedBytes(license, licenseFile, 16 * 1024);
  const licenseText = licenseBytes.toString("utf8");
  requireValid(
    license.spdx === "OFL-1.1" &&
      typeof license.source === "string" &&
      new RegExp(
        `^https://raw\\.githubusercontent\\.com/google/fonts/[0-9a-f]{40}/ofl/${slug}/OFL\\.txt$`,
      ).test(license.source) &&
      typeof license.copyright === "string" &&
      license.copyright.startsWith("Copyright ") &&
      licenseText.startsWith(license.copyright) &&
      licenseText.includes("SIL OPEN FONT LICENSE Version 1.1") &&
      Buffer.from(licenseText, "utf8").equals(licenseBytes) &&
      !licenseText.includes("*/") &&
      !licenseText.includes("<") &&
      !licenseText.includes("\0"),
    `Invalid or unsafe OFL notice: ${licenseFile}`,
  );
  const faces = family.faces.map((face) => verifyFace(face, id, slug, family.faces.length));
  const weights = faces.flatMap((face) => face.weights).sort((a, b) => a - b);
  const expectedWeights = id === "instrument-serif" ? [400] : [400, 600];
  requireValid(
    JSON.stringify(weights) === JSON.stringify(expectedWeights),
    `Missing or repeated required weights: ${id}`,
  );
  return {
    id,
    name,
    alias: `Focus ${name} v1`,
    weights,
    license: { source: license.source, sha256: license.sha256, text: licenseText },
    faces,
  };
}

const manifest = JSON.parse(readBounded(new URL("provenance.json", vendor), 128 * 1024));
requireValid(
  manifest?.schemaVersion === 1 &&
    Array.isArray(manifest.families) &&
    manifest.families.length === expectedFamilies.length,
  "Unexpected vendor font manifest",
);
const families = expectedFamilies.map(([id, name, genericFamily]) =>
  verifyFamily(
    manifest.families.find((family) => family?.id === id),
    id,
    name,
    genericFamily,
  ),
);
// The editor imports individual families. The synchronous renderer uses the same files.
const outputs = new Map(
  families.map((family) => [family.id + ".json", JSON.stringify(family, null, 2) + "\n"]),
);
const ids = families.map((family) => family.id);
const names = ids.map((id) => id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()));
const imports = ids.map((id, i) => `import ${names[i]} from "./${id}.json";`);
outputs.set(
  "index.ts",
  `// Generated by scripts/generate-authored-fonts.mjs.\n${imports.join("\n")}\n\nexport const families = [\n${names.map((name) => "  " + name + ",").join("\n")}\n];\n`,
);
const size = [...outputs.values()].reduce((total, file) => total + Buffer.byteLength(file), 0);
requireValid(size <= catalogLimit, "Generated font catalog exceeds 1 MiB");
const check = process.argv[2] === "--check";
requireValid(
  process.argv.length === (check ? 3 : 2),
  "Use no arguments to generate, or --check to validate",
);
if (!check) mkdirSync(output, { recursive: true });
for (const [name, contents] of outputs) {
  const path = new URL(name, output);
  if (check)
    requireValid(
      readBounded(path, catalogLimit).equals(Buffer.from(contents)),
      `Generated font file is stale: ${name}`,
    );
  else writeFileSync(path, contents);
}
requireValid(
  readdirSync(output).every((name) => outputs.has(name)),
  "Unexpected file in generated font catalog",
);
