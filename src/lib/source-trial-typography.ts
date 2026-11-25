import { getAuthoredFontAvailability } from "./authored-font-availability";
import { fontFallback } from "./fonts";
import { loadAuthoredFontFamilies } from "./load-authored-fonts";
import { hashBytes, requireTrial, utf8, type SourceTrialAsset } from "./source-trial-model";

export type TrialFontFile = { record: SourceTrialAsset; data: Uint8Array<ArrayBuffer> };

export async function prepareTrialFonts(
  heading: string,
  body: string,
  stylesheetPath: string,
  scope: string,
) {
  const missing = getAuthoredFontAvailability(heading, body).missingFamilies;
  requireTrial(
    !missing.length,
    `Focus has no licensed portable file for ${missing.join(", ")}. Keep the app’s typography or choose a bundled typeface.`,
  );
  const families = await loadAuthoredFontFamilies(heading, body);
  const directory = stylesheetPath.slice(0, stylesheetPath.lastIndexOf("/") + 1);
  const folder = `focus-assets-${scope}`;
  const assets: TrialFontFile[] = [];
  const fontFaces: string[] = [];
  const licenseUrls: string[] = [];
  const stacks = new Map<string, string>();

  for (const family of families) {
    requireTrial(family.faces.length === 1, "This typeface needs developer-guided integration.");
    const face = family.faces[0]!;
    const add = async (data: Uint8Array<ArrayBuffer>, expected: string, extension: string) => {
      const sha256 = await hashBytes(data);
      requireTrial(sha256 === expected, "A bundled font or license failed its integrity check.");
      const filename = `${family.id}-${sha256.slice(0, 12)}.${extension}`;
      assets.push({
        record: { path: `${directory}${folder}/${filename}`, bytes: data.length, sha256 },
        data,
      });
      return filename;
    };
    const file = await add(
      Uint8Array.from(atob(face.base64), (char) => char.charCodeAt(0)),
      face.sha256,
      "woff2",
    );
    const license = await add(utf8(family.license.text), family.license.sha256, "txt");
    // Let Vite carry the notice into the built website alongside the licensed font.
    licenseUrls.push(`  --focus-license-${family.id}: url("./${folder}/${license}?no-inline");`);
    const alias = `FocusTrial-${scope}-${family.id}`;
    stacks.set(family.name, `"${alias}", ${fontFallback(family.name)}`);
    fontFaces.push(
      [
        "@font-face {",
        `  font-family: "${alias}";`,
        `  src: url("./${folder}/${file}") format("woff2");`,
        "  font-style: normal;",
        `  font-weight: ${face.weight};`,
        "  font-display: swap;",
        `  unicode-range: ${face.unicodeRange};`,
        "}",
      ].join("\n"),
    );
  }
  return {
    assets,
    fontFaces: [...fontFaces, `:global(.focusTrial_${scope}) {\n${licenseUrls.join("\n")}\n}`].join(
      "\n",
    ),
    heading: stacks.get(heading)!,
    body: stacks.get(body)!,
  };
}
