export const AUTHORED_FONT_FAMILIES = [
  "Instrument Serif",
  "Instrument Sans",
  "Space Grotesk",
  "IBM Plex Sans",
  "Newsreader",
  "Literata",
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
