import { BODY_FONTS, HEADING_FONTS, contrast, normalizeTokens, type Tokens } from "./design";
import { fixContrast } from "./engine";

// Measured look extraction from a public page's HTML+CSS. Never copies the site's words.
const hexOf = (v: string): string | null => {
  const s = v.trim().toLowerCase();
  const h6 = s.match(/^#([0-9a-f]{6})\b/);
  if (h6) return `#${h6[1]}`;
  const h3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])\b/);
  if (h3) return `#${h3[1]}${h3[1]}${h3[2]}${h3[2]}${h3[3]}${h3[3]}`;
  const rgb = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (rgb)
    return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
  return null;
};
const sat = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  return Math.max(r, g, b) - Math.min(r, g, b);
};
const light = (h: string) => contrast(h, "#000000");
function tally(css: string, prop: RegExp) {
  const n = new Map<string, number>();
  for (const m of css.matchAll(prop)) {
    const h = hexOf(m[1] ?? "");
    if (h) n.set(h, (n.get(h) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}
const SERIF =
  /serif|georgia|times|garamond|caslon|playfair|lora|merriweather|baskerville|fraunces|didot|bodoni/;
function closestFont<T extends readonly string[]>(
  list: T,
  found: string[],
  fallbackSerif: T[number],
  fallbackSans: T[number],
): T[number] {
  for (const f of found) {
    const hit = list.find((x) => x.toLowerCase() === f.toLowerCase());
    if (hit) return hit;
  }
  return found[0] && SERIF.test(found[0].toLowerCase()) && !/sans/.test(found[0].toLowerCase())
    ? fallbackSerif
    : fallbackSans;
}
export type Inspiration = { tokens: Tokens; fonts: string[]; colors: string[]; notes: string[] };
export function inspirationFrom(html: string, css: string): Inspiration {
  const all =
    `${css}\n${[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n")}\n${[...html.matchAll(/style=["']([^"']+)/gi)].map((m) => m[1]).join(";")}`.toLowerCase();
  const backs = tally(all, /background(?:-color)?\s*:\s*([^;}!]+)/g);
  const texts = tally(all, /(?<![-\w])color\s*:\s*([^;}!]+)/g);
  const every = [
    ...new Set([...backs, ...texts, ...tally(all, /:\s*(#[0-9a-f]{3,6}\b|rgba?\([^)]*\))/g)]),
  ];
  const bg = backs.find((h) => light(h) > 15) ?? backs.find((h) => light(h) < 1.6) ?? "#faf8f4";
  const dark = light(bg) < 5;
  const ink = texts.find((h) => contrast(h, bg) >= 7) ?? (dark ? "#f4f1ea" : "#1b1a17");
  const accent =
    every
      .filter((h) => sat(h) > 0.25 && contrast(h, bg) >= 2)
      .sort((a, b) => every.indexOf(a) - every.indexOf(b))[0] ?? (dark ? "#e8b04a" : "#b4441f");
  const muted =
    texts.find((h) => h !== ink && sat(h) < 0.2 && contrast(h, bg) >= 4.5) ??
    (dark ? "#b8b2a7" : "#5e5a52");
  const surface =
    backs.find((h) => h !== bg && sat(h) < 0.2 && Math.abs(light(h) - light(bg)) < 4) ?? bg;
  const fonts = [
    ...new Set([
      ...[...all.matchAll(/font-family\s*:\s*["']?([^;}"',]+)/g)].map((m) => (m[1] ?? "").trim()),
      ...[...html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&:]+)/gi)].map((m) =>
        (m[1] ?? "").replace(/\+/g, " "),
      ),
    ]),
  ]
    .filter(
      (f) =>
        f &&
        !f.startsWith("var(") &&
        !/^(inherit|initial|sans-serif|serif|monospace|system-ui|-apple-system)$/.test(
          f.toLowerCase(),
        ),
    )
    .slice(0, 6);
  const radius = Number(all.match(/border-radius\s*:\s*(\d+)px/)?.[1] ?? 6);
  const tokens = fixContrast(
    normalizeTokens({
      bg,
      surface,
      ink,
      muted,
      accent,
      accentInk: contrast("#ffffff", accent) >= contrast("#111111", accent) ? "#ffffff" : "#111111",
      headingFont: closestFont(HEADING_FONTS, fonts, "Fraunces", "Bricolage Grotesque"),
      bodyFont: closestFont(BODY_FONTS, fonts.slice(1).concat(fonts), "Literata", "Manrope"),
      headingCase: "normal",
      scale: 1.25,
      radius,
      density: "balanced",
      heroLayout: "editorial",
      buttonStyle: "solid",
      texture: "none",
    }),
  );
  const notes = [
    `Page colour ${bg}, text ${ink}, main colour ${accent}.`,
    fonts.length
      ? `Fonts it uses: ${fonts.slice(0, 3).join(", ")}. Closest available: ${tokens.headingFont} and ${tokens.bodyFont}.`
      : "No named fonts found; picked a fitting pair.",
    "Only the look is taken. Their words, logo and photos are not copied.",
  ];
  return { tokens, fonts, colors: every.slice(0, 8), notes };
}
