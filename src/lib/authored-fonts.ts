import { families } from "./authored-families";
import { buildSelectedFonts } from "./authored-font-styles";
export { AUTHORED_FONT_COVERAGE, getAuthoredFontAvailability } from "./authored-font-availability";

export function buildEmbeddedFonts(headingFont: string, bodyFont: string) {
  return buildSelectedFonts(headingFont, bodyFont, families);
}
