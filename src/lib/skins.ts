// One-click Skins: change only hues (main colour + grey tint), keep each colour's lightness
// and chroma, keep every non-colour decision. Values from the owner's Skins catalogue.
import { contrastNotes, normalizeTokens, type Tokens } from "./design";
import { fixContrast } from "./engine";

export type Skin = {
  id: string;
  name: string;
  hue: number;
  tint: number;
  chroma?: number;
  looks: string;
};
export const SKINS: Skin[] = [
  {
    id: "ocean",
    name: "Ocean",
    hue: 245,
    tint: 245,
    looks: "Blue, with greys that lean slightly blue.",
  },
  { id: "lagoon", name: "Lagoon", hue: 195, tint: 215, looks: "Blue-green, with cool greys." },
  {
    id: "forest",
    name: "Forest",
    hue: 152,
    tint: 150,
    looks: "Green, with greys that lean slightly green.",
  },
  { id: "meadow", name: "Meadow", hue: 140, tint: 120, looks: "Fresh green toward yellow-green." },
  { id: "sunset", name: "Sunset", hue: 42, tint: 50, looks: "Orange, with warm greys." },
  { id: "ember", name: "Ember", hue: 28, tint: 45, looks: "Red-orange, with warm greys." },
  {
    id: "berry",
    name: "Berry",
    hue: 355,
    tint: 350,
    looks: "Rose red, with greys that lean slightly pink.",
  },
  {
    id: "orchid",
    name: "Orchid",
    hue: 320,
    tint: 300,
    looks: "Pink-purple, with soft violet greys.",
  },
  {
    id: "violet",
    name: "Violet",
    hue: 288,
    tint: 285,
    looks: "Blue-purple, with greys that lean slightly purple.",
  },
  {
    id: "gold",
    name: "Gold",
    hue: 82,
    tint: 78,
    looks: "Yellow-brown, with greys that lean slightly yellow.",
  },
  {
    id: "graphite",
    name: "Graphite",
    hue: 255,
    tint: 255,
    chroma: 0.02,
    looks: "Almost no colour: the main colour turns grey.",
  },
  {
    id: "indigo",
    name: "Indigo dye",
    hue: 250,
    tint: 85,
    chroma: 0.09,
    looks: "A quiet greyed blue, like indigo-dyed cloth.",
  },
];

type Lch = [number, number, number];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function hexToOklch(h: string): Lch {
  const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(h.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
function oklchToRgb([L, C, H]: Lch): number[] {
  const a = C * Math.cos((H * Math.PI) / 180),
    b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLin);
}
// CSS Color 4 style gamut mapping: binary-search the largest in-sRGB chroma at the
// same lightness and hue, so rotated Skin colours stay on-screen without hue drift.
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
export function oklchToHex(c: Lch): string {
  const [L, C, H] = c;
  let rgb = oklchToRgb([L, C, H]);
  if (!inGamut(rgb)) {
    let lo = 0,
      hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToRgb([L, mid, H]))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToRgb([L, lo, H]);
  }
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(Math.max(0, Math.min(1, v)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const rehue = (h: string, hue: number, chroma?: number) => {
  const [L, C] = hexToOklch(h);
  return oklchToHex([L, chroma ?? Math.max(C, 0.1), hue]);
};
// Greys keep their own (small) chroma, capped so a tint never becomes a colour.
const retint = (h: string, hue: number) => {
  const [L, C] = hexToOklch(h);
  return oklchToHex([L, Math.min(Math.max(C, 0.008), 0.03), hue]);
};

export function applySkin(input: Tokens, skin: Skin): Tokens {
  const t = normalizeTokens(input);
  const out = normalizeTokens({
    ...t,
    bg: retint(t.bg, skin.tint),
    surface: retint(t.surface, skin.tint),
    ink: retint(t.ink, skin.tint),
    muted: retint(t.muted, skin.tint),
    accent: rehue(t.accent, skin.hue, skin.chroma),
    // The second colour keeps its distance from the accent: same offset, new family.
    ...(t.accent2
      ? {
          accent2: rehue(
            t.accent2,
            (skin.hue + hueGap(t.accent, t.accent2) + 360) % 360,
            skin.chroma,
          ),
        }
      : {}),
  });
  return contrastNotes(out).every((c) => c.ok) ? out : fixContrast(out);
}

function hueGap(a: string, b: string) {
  return hexToOklch(b)[2] - hexToOklch(a)[2];
}
