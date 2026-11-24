const GALLERY_FONT_ADDITIONS = [
  "Outfit",
  "DM Sans",
  "Manrope",
  "Inter",
  "Bricolage Grotesque",
  "Playfair Display",
  "Public Sans",
  "JetBrains Mono",
  "Fraunces",
] as const;

export const AUTHORED_FONT_FAMILIES = [
  "Instrument Serif",
  "Instrument Sans",
  "Space Grotesk",
  "IBM Plex Sans",
  "Newsreader",
  "Literata",
  ...GALLERY_FONT_ADDITIONS,
] as const;

export const AUTHORED_FONT_COVERAGE =
  "Bundled fonts cover the included Latin subsets. Other characters use fallback fonts.";

const bundledFamilies = new Set<string>(AUTHORED_FONT_FAMILIES);

export function getAuthoredFontAvailability(headingFont: string, bodyFont: string) {
  const requested = [...new Set([headingFont, bodyFont])];
  return {
    includedFamilies: requested.filter((name) => bundledFamilies.has(name)),
    missingFamilies: requested.filter((name) => !bundledFamilies.has(name)),
  };
}

/** Existing reviews of these authored designs predate their embedded typefaces. */
export function usesNewGalleryTypeface(heading: string, body: string) {
  return GALLERY_FONT_ADDITIONS.some((family) => family === heading || family === body);
}
