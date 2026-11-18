// Pure font facts shared by the live preview and the customer's design pack,
// so the pack loads exactly the fonts the preview showed.
export const FONT_SPEC: Record<string, string> = {
  Fraunces: "ital,wght@0,400;0,600;1,400",
  "Instrument Serif": "ital@0;1",
  "Playfair Display": "ital,wght@0,400;0,600;1,400",
  "DM Serif Display": "ital@0;1",
  "Libre Caslon Text": "ital,wght@0,400;0,700;1,400",
  "Space Grotesk": "wght@400;600",
  Syne: "wght@600;800",
  Unbounded: "wght@500;700",
  "Bricolage Grotesque": "wght@400;600",
  "Archivo Black": "",
  Cinzel: "wght@500;700",
  "Pirata One": "",
  "Bebas Neue": "",
  Fredoka: "wght@500;600",
  "IBM Plex Sans": "wght@400;600",
  Manrope: "wght@400;600",
  "Work Sans": "wght@400;600",
  Karla: "wght@400;600",
  Literata: "wght@400;600",
  "IBM Plex Mono": "wght@400;500",
  Figtree: "wght@400;600",
  Outfit: "wght@400;600;700",
  "DM Sans": "wght@400;600;700",
  "Instrument Sans": "wght@400;600",
  "JetBrains Mono": "wght@400;600",
  Newsreader: "wght@400;600",
  "Public Sans": "wght@400;600;700",
  Inter: "wght@400;600",
};

const SERIF = new Set([
  "Fraunces",
  "Instrument Serif",
  "Playfair Display",
  "DM Serif Display",
  "Libre Caslon Text",
  "Literata",
  "Newsreader",
  "Cinzel",
  "Pirata One",
]);
const MONO = new Set(["IBM Plex Mono", "JetBrains Mono"]);

/** Generic family to show while the font loads (or if it never does). */
export function fontFallback(font: string): string {
  if (MONO.has(font)) return "ui-monospace, monospace";
  if (SERIF.has(font)) return "Georgia, serif";
  return "system-ui, sans-serif";
}

export function fontStack(font: string): string {
  return `"${font.replace(/["\\]/g, "")}", ${fontFallback(font)}`;
}

export function familyParam(font: string): string {
  const spec = FONT_SPEC[font];
  return `family=${encodeURIComponent(font).replace(/%20/g, "+")}${spec ? ":" + spec : ""}`;
}

/** One Google Fonts stylesheet URL covering every font given (deduplicated). */
export function fontsUrl(fonts: string[]): string {
  const uniq = [...new Set(fonts.filter(Boolean))];
  return `https://fonts.googleapis.com/css2?${uniq.map(familyParam).join("&")}&display=swap`;
}

/** Ready-to-paste <head> lines that load the fonts. */
export function fontLinkTags(fonts: string[]): string {
  return [
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="stylesheet" href="${fontsUrl(fonts)}">`,
  ].join("\n");
}
