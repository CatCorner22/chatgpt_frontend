import catalog from "./authored-fonts.data.json";
import { AUTHORED_FONT_COVERAGE, getAuthoredFontAvailability } from "./authored-font-availability";
import { FONT_SPEC, fontFallback, fontStack } from "./fonts";

export { AUTHORED_FONT_COVERAGE, getAuthoredFontAvailability } from "./authored-font-availability";

type BundledFamily = (typeof catalog.families)[number];
const bundledFamilies = new Map(catalog.families.map((family) => [family.name, family]));

function authoredFontStack(name: string): string {
  const family = bundledFamilies.get(name);
  if (family) return `"${family.alias}", ${fontStack(family.name)}`;
  return Object.hasOwn(FONT_SPEC, name) ? fontStack(name) : fontFallback(name);
}

const licensePath = (family: BundledFamily) => `fonts/${family.id}-OFL.txt`;

function provenanceNotice(family: BundledFamily): string {
  const faces = family.faces.map(
    (face) => `${face.file}
  Source: ${face.source}
  SHA-256: ${face.sha256}
  Size: ${face.bytes} bytes
  Style: normal, weight: ${face.weight}
  Subset: ${face.subset}
  Upstream CSS Unicode range: ${face.upstreamUnicodeRange}
  Embedded cmap Unicode range: ${face.unicodeRange}`,
  );
  return `${family.name}
License: SIL Open Font License 1.1 (${licensePath(family)})
License source: ${family.license.source}
License SHA-256: ${family.license.sha256}
${faces.join("\n")}`;
}

/** Build selected-only CSS and notices from the validated, checked-in assets. */
export function buildEmbeddedFonts(headingFont: string, bodyFont: string) {
  const availability = getAuthoredFontAvailability(headingFont, bodyFont);
  const selected = availability.includedFamilies.map((name) => bundledFamilies.get(name)!);
  const fontFaces = selected.flatMap((family) =>
    family.faces.map(
      (face) => `@font-face {
  font-family: "${family.alias}";
  src: url("data:font/woff2;base64,${face.base64}") format("woff2");
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  unicode-range: ${face.unicodeRange};
}`,
    ),
  );
  const licenseNotice = selected.map((family) => family.license.text).join("\n");
  const css = licenseNotice ? `/*\n${licenseNotice}\n*/\n${fontFaces.join("\n")}\n` : "";
  const supportingFiles: Record<string, string> = Object.fromEntries(
    selected.map((family) => [licensePath(family), family.license.text]),
  );
  if (selected.length) {
    supportingFiles["fonts/PROVENANCE.txt"] =
      `EMBEDDED FONT SOURCES\n\n${AUTHORED_FONT_COVERAGE}\n\n${selected.map(provenanceNotice).join("\n\n")}\n`;
  }
  const headingWeight =
    bundledFamilies.get(headingFont)?.weights.includes(600) === false ? 400 : 600;
  return {
    ...availability,
    css,
    headingStack: authoredFontStack(headingFont),
    bodyStack: authoredFontStack(bodyFont),
    headingWeight,
    supportingFiles,
    licenseNotice,
  };
}
