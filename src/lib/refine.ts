// Fine-tune nudges: small, predictable token changes on top of an AI option.
// Every nudge goes back through normalizeTokens and keeps text readable.
import { contrastNotes, normalizeTokens, type Tokens } from "./design";
import { fixContrast } from "./engine";

export const NUDGES = [
  { id: "warmer", label: "Warmer" },
  { id: "cooler", label: "Cooler" },
  { id: "bolder", label: "Bolder" },
  { id: "quieter", label: "Quieter" },
] as const;
export type Nudge = (typeof NUDGES)[number]["id"];

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) =>
  "#" +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export const mix = (a: string, b: string, w: number) => {
  const x = rgb(a),
    y = rgb(b);
  return hex(x.map((v, i) => v + (y[i]! - v) * w));
};

const WARM = "#ff8a3d",
  COOL = "#3d7bff";
export function nudge(input: Tokens, n: Nudge): Tokens {
  const t = normalizeTokens(input);
  let o: Tokens = t;
  if (n === "warmer" || n === "cooler") {
    const tint = n === "warmer" ? WARM : COOL;
    o = {
      ...t,
      bg: mix(t.bg, tint, 0.06),
      surface: mix(t.surface, tint, 0.06),
      accent: mix(t.accent, tint, 0.18),
    };
  } else if (n === "bolder") {
    o = {
      ...t,
      scale: Math.round((t.scale + 0.08) * 100) / 100,
      density: t.density === "airy" ? "balanced" : t.density,
    };
  } else {
    o = { ...t, scale: Math.round((t.scale - 0.08) * 100) / 100, texture: "none" };
  }
  o = normalizeTokens(o);
  return contrastNotes(o).every((c) => c.ok) || !contrastNotes(t).every((c) => c.ok)
    ? o
    : fixContrast(o);
}

export function applyNudges(t: Tokens, list: Nudge[]) {
  return list.reduce(nudge, t);
}
