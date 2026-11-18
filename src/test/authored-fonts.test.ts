import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUTHORED_FONT_FAMILIES } from "../lib/authored-font-availability";
import catalog from "../lib/authored-fonts.data.json";
import {
  AUTHORED_FONT_COVERAGE,
  buildEmbeddedFonts,
  getAuthoredFontAvailability,
} from "../lib/authored-fonts";

const vendor = "assets/vendor-fonts";
const generator = "scripts/generate-authored-fonts.mjs";
const generated = "src/lib/authored-fonts.data.json";
const sourceBase64 = /url\("data:font\/woff2;base64,([A-Za-z0-9+/]+={0,2})"\) format\("woff2"\)/g;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const pairs = [
  ["Instrument Serif", "Instrument Sans", 400],
  ["Space Grotesk", "IBM Plex Sans", 600],
  ["Newsreader", "Literata", 600],
] as const;

describe("portable authored font assets", () => {
  it("reproduces the checked-in catalog byte-for-byte within its 1 MiB limit", () => {
    const result = spawnSync(process.execPath, [generator, "--check"], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readFileSync(generated).length).toBeLessThanOrEqual(1024 * 1024);
    expect(catalog.families.map((family) => family.name)).toEqual(
      pairs.flatMap(([heading, body]) => [heading, body]),
    );
    expect(AUTHORED_FONT_FAMILIES).toEqual(catalog.families.map((family) => family.name));
  });

  it.each(pairs)(
    "embeds the verified assets and exact notices for %s and %s only",
    (heading, body, headingWeight) => {
      const fonts = buildEmbeddedFonts(heading, body);
      expect(getAuthoredFontAvailability(heading, body)).toEqual({
        includedFamilies: [heading, body],
        missingFamilies: [],
      });
      expect(fonts.includedFamilies).toEqual([heading, body]);
      expect(fonts.missingFamilies).toEqual([]);
      expect(fonts.headingWeight).toBe(headingWeight);
      expect(fonts.headingStack).toMatch(new RegExp(`^"Focus ${heading} v1", "${heading}", `));
      expect(fonts.bodyStack).toMatch(new RegExp(`^"Focus ${body} v1", "${body}", `));

      const families = catalog.families.filter((family) =>
        fonts.includedFamilies.includes(family.name),
      );
      const selectedFaces = families.flatMap((family) => family.faces);
      const sources = [...fonts.css.matchAll(sourceBase64)];
      expect(sources).toHaveLength(selectedFaces.length);
      selectedFaces.forEach((face, index) => {
        const embedded = Buffer.from(sources[index]![1]!, "base64");
        expect(embedded.equals(readFileSync(join(vendor, face.file)))).toBe(true);
        expect(embedded.toString("ascii", 0, 4)).toBe("wOF2");
        expect(embedded.length).toBe(face.bytes);
        expect(digest(embedded)).toBe(face.sha256);
        expect(face.subset).toBe("latin");
        expect(face.unicodeRange).toContain("U+0020-007E");
        expect(fonts.css).toContain(`unicode-range: ${face.unicodeRange};`);
        expect(fonts.css).toContain(`font-weight: ${face.weight};`);
      });
      expect(fonts.css.replace(sourceBase64, "")).not.toMatch(/@import|url\s*\(|local\s*\(/i);
      expect(fonts.css.match(/font-style: normal;/g)).toHaveLength(selectedFaces.length);

      const provenance = fonts.supportingFiles["fonts/PROVENANCE.txt"];
      expect(provenance).toContain(AUTHORED_FONT_COVERAGE);
      for (const face of selectedFaces) {
        expect(provenance).toContain(face.source);
        expect(provenance).toContain(face.sha256);
      }
      expect(Object.keys(fonts.supportingFiles)).toEqual([
        ...families.map((family) => `fonts/${family.id}-OFL.txt`),
        "fonts/PROVENANCE.txt",
      ]);
      for (const family of families) {
        expect(family.weights).toEqual(family.name === "Instrument Serif" ? [400] : [400, 600]);
        const original = readFileSync(join(vendor, `licenses/${family.id}-OFL.txt`));
        const license = fonts.supportingFiles[`fonts/${family.id}-OFL.txt`]!;
        expect(Buffer.from(license).equals(original)).toBe(true);
        expect(digest(original)).toBe(family.license.sha256);
        expect(fonts.licenseNotice).toContain(license);
        expect(fonts.css).toContain(license);
      }
      for (const family of catalog.families.filter((family) => !families.includes(family))) {
        expect(fonts.css).not.toContain(family.alias);
        expect(provenance).not.toContain(family.name);
      }
    },
  );

  it("embeds a family and its notices once when both roles use it", () => {
    const fonts = buildEmbeddedFonts("Newsreader", "Newsreader");
    expect(fonts.includedFamilies).toEqual(["Newsreader"]);
    expect(fonts.headingStack).toBe(fonts.bodyStack);
    expect([...fonts.css.matchAll(sourceBase64)]).toHaveLength(1);
    expect(Object.keys(fonts.supportingFiles)).toEqual([
      "fonts/newsreader-OFL.txt",
      "fonts/PROVENANCE.txt",
    ]);
    expect(fonts.licenseNotice).toBe(fonts.supportingFiles["fonts/newsreader-OFL.txt"]);
  });

  it("reports missing selections and gives unknown names safe generic stacks", () => {
    const hostile = '"; } @import url("https://example.com"); </style><script>';
    const fonts = buildEmbeddedFonts(hostile, "Literata");
    expect(fonts.includedFamilies).toEqual(["Literata"]);
    expect(fonts.missingFamilies).toEqual([hostile]);
    expect(fonts.headingStack).toBe("system-ui, sans-serif");
    expect(fonts.css).not.toContain(hostile);
    expect(buildEmbeddedFonts("Fraunces", "Karla")).toEqual({
      css: "",
      headingStack: '"Fraunces", Georgia, serif',
      bodyStack: '"Karla", system-ui, sans-serif',
      headingWeight: 600,
      includedFamilies: [],
      missingFamilies: ["Fraunces", "Karla"],
      supportingFiles: {},
      licenseNotice: "",
    });
    expect(buildEmbeddedFonts("__proto__", "__proto__").headingStack).toBe("system-ui, sans-serif");
  });

  it.each([
    ["mismatched font bytes", /SHA-256 mismatch/],
    ["invalid WOFF2 magic with matching hash", /Invalid WOFF2 header/],
    ["unsafe license with matching hash", /Invalid or unsafe OFL notice/],
    ["missing license", /ENOENT/],
    ["unapproved manifest path", /Expected fixed path/],
  ] as const)("rejects %s during catalog validation", (scenario, error) => {
    const fixture = mkdtempSync(join(tmpdir(), "focus-authored-fonts-"));
    try {
      cpSync(vendor, join(fixture, vendor), { recursive: true });
      mkdirSync(join(fixture, "scripts"));
      cpSync(generator, join(fixture, generator));
      const manifestFile = join(fixture, vendor, "provenance.json");
      const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
      const family = manifest.families[0];
      const face = family.faces[0];
      const license = family.license;
      const facePath = join(fixture, vendor, face.file);
      const licensePath = join(fixture, vendor, license.file);
      if (scenario === "missing license") {
        rmSync(licensePath);
      } else if (scenario === "unapproved manifest path") {
        face.file = "../elsewhere.woff2";
      } else if (scenario === "unsafe license with matching hash") {
        const unsafe = Buffer.concat([readFileSync(licensePath), Buffer.from("\n*/")]);
        writeFileSync(licensePath, unsafe);
        license.bytes = unsafe.length;
        license.sha256 = digest(unsafe);
      } else {
        const invalid = readFileSync(facePath);
        invalid[0] = 0;
        writeFileSync(facePath, invalid);
        if (scenario === "invalid WOFF2 magic with matching hash") face.sha256 = digest(invalid);
      }
      writeFileSync(manifestFile, JSON.stringify(manifest));
      const result = spawnSync(process.execPath, [join(fixture, generator), "--check"], {
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(error);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
