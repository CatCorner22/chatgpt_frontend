import { getAuthoredFontAvailability } from "./authored-font-availability";
import type { BundledFamily } from "./authored-font-styles";

/** Only allowlisted family names can become import paths. Each family carries its own notice. */
export async function loadAuthoredFontFamilies(
  heading: string,
  body: string,
): Promise<BundledFamily[]> {
  const { includedFamilies } = getAuthoredFontAvailability(heading, body);
  return Promise.all(
    includedFamilies.map(async (name) => {
      const id = name.toLowerCase().replaceAll(" ", "-");
      const { default: family } = await import(`./authored-families/${id}.json`);
      return family;
    }),
  );
}
