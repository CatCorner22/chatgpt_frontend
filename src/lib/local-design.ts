import {
  contrast,
  normalizeTokens,
  STEPS,
  type Content,
  type Direction,
  type Tokens,
} from "./design";
import { evaluate, fixContrast, type Purpose } from "./engine";
import { GALLERY } from "./gallery";
import { matchDirections } from "./matcher";

export type LocalOption = { label: string; why: string; tokens: Tokens };

const DEFAULT_PURPOSE: Purpose = { audience: "", tone: "" };
const FALLBACKS = ["soft-daylight", "summertime-sadness", "graphite-precision", "ember-noir"];

/** A content draft made only from the owner's words. Proof and services stay empty. */
export function contentFromBrief(
  brief: string,
  purpose: Purpose = DEFAULT_PURPOSE,
  brand?: string,
): Content {
  const description = brief.trim();
  const firstSentence = description.match(/^.+?(?:[.!?](?:\s|$)|$)/s)?.[0]?.trim() ?? description;
  return {
    brand: brand?.trim() || "Untitled project",
    headline: firstSentence || "Untitled project",
    sub: description,
    cta:
      purpose.goal === "get in touch"
        ? "Get in touch"
        : purpose.goal === "sign up"
          ? "Sign up"
          : purpose.goal === "buy or book"
            ? "Explore the options"
            : "Find out more",
    features: [],
    quote: "",
  };
}

/** Choose existing authored looks locally; no generated claims and no paid requests. */
export function createLocalDirections(
  brief: string,
  purpose: Purpose = DEFAULT_PURPOSE,
  brand?: string,
): {
  content: Content;
  directions: Direction[];
} {
  const matches = matchDirections(brief, GALLERY, 6);
  const matched = new Map(matches.map((match) => [match.item.id, match]));
  const fallbacks = FALLBACKS.flatMap((id) => GALLERY.find((item) => item.id === id) ?? []);
  const seen = new Set<string>();
  const candidates = [...matches.map((match) => match.item), ...fallbacks, ...GALLERY]
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item, order) => ({ item, order, suitability: evaluate(purpose, item.direction.tokens) }))
    .sort(
      (a, b) =>
        Number(a.suitability.blocked) - Number(b.suitability.blocked) ||
        Number(matched.has(b.item.id)) - Number(matched.has(a.item.id)) ||
        b.suitability.score - a.suitability.score ||
        a.order - b.order,
    );
  const fingerprints = new Set<string>();
  const directions: Direction[] = [];
  for (const { item } of candidates) {
    const tokens = readableDirection(item.direction.tokens);
    const key = JSON.stringify(tokens);
    if (fingerprints.has(key)) continue;
    fingerprints.add(key);
    const match = matched.get(item.id);
    directions.push({
      ...item.direction,
      why: match
        ? `Selected from the design library for: ${match.because.slice(0, 4).join(", ")}. ${item.direction.why}`
        : `A starting point from the design library. ${item.direction.why}`,
      tokens,
    });
    if (directions.length === 3) break;
  }
  return { content: contentFromBrief(brief, purpose, brand), directions };
}

// Initial directions can repair their full palette. Later choices stay within one decision.
function readableDirection(input: Tokens): Tokens {
  const tokens = fixContrast(normalizeTokens(input));
  if (contrast(tokens.ink, tokens.surface) < 4.5 || contrast(tokens.muted, tokens.surface) < 4.5) {
    tokens.surface = tokens.bg;
  }
  return tokens;
}

type Variant = { label: string; why: string; patch: Partial<Tokens> };
const VARIANTS: Record<string, Variant[]> = {
  palette: [
    {
      label: "Warm paper",
      why: "Warm backgrounds with dark, quiet text.",
      patch: { bg: "#f5f1e8", surface: "#fffdf8", ink: "#232821", muted: "#53594e" },
    },
    {
      label: "Clean daylight",
      why: "A cool, light ground keeps the content in front.",
      patch: { bg: "#f3f5f7", surface: "#ffffff", ink: "#17212b", muted: "#4a5662" },
    },
    {
      label: "After hours",
      why: "Light text on a deep background gives the page a quieter evening feel.",
      patch: { bg: "#17231f", surface: "#21302a", ink: "#f3f5ec", muted: "#bac5b9" },
    },
  ],
  accent: [
    {
      label: "Forest",
      why: "A deep green gives primary actions a grounded tone.",
      patch: { accent: "#326449", accentInk: "#ffffff" },
    },
    {
      label: "Terracotta",
      why: "A warm red brings the primary action forward.",
      patch: { accent: "#ad412c", accentInk: "#ffffff" },
    },
    {
      label: "Cobalt",
      why: "A clear blue makes primary actions easy to distinguish.",
      patch: { accent: "#2955bf", accentInk: "#ffffff" },
    },
  ],
  type: [
    {
      label: "Editorial",
      why: "A serif headline paired with a plain reading face.",
      patch: { headingFont: "Fraunces", bodyFont: "Instrument Sans", headingCase: "normal" },
    },
    {
      label: "Contemporary",
      why: "Two simple sans-serif faces keep the page direct.",
      patch: { headingFont: "Space Grotesk", bodyFont: "Inter", headingCase: "normal" },
    },
    {
      label: "Literary",
      why: "Serif headings and body text give longer reading a book-like rhythm.",
      patch: { headingFont: "Newsreader", bodyFont: "Literata", headingCase: "normal" },
    },
  ],
  scale: [
    {
      label: "Quiet hierarchy",
      why: "A smaller difference between text sizes keeps the page restrained.",
      patch: { scale: 1.2 },
    },
    {
      label: "Clear hierarchy",
      why: "A middle size ratio separates headlines from body text.",
      patch: { scale: 1.333 },
    },
    {
      label: "Expressive hierarchy",
      why: "A larger headline ratio gives the first message more emphasis.",
      patch: { scale: 1.414 },
    },
  ],
  density: [
    {
      label: "Room to breathe",
      why: "More space separates content and controls.",
      patch: { density: "airy" },
    },
    {
      label: "Balanced rhythm",
      why: "Moderate spacing keeps related items together.",
      patch: { density: "balanced" },
    },
    {
      label: "Compact workspace",
      why: "Tighter spacing fits more information on screen.",
      patch: { density: "compact" },
    },
  ],
  shape: [
    {
      label: "Precise edges",
      why: "Square corners and a solid button create a precise outline.",
      patch: { radius: 0, buttonStyle: "solid" },
    },
    {
      label: "Soft corners",
      why: "A small curve softens containers while keeping a clear primary button.",
      patch: { radius: 12, buttonStyle: "solid" },
    },
    {
      label: "Rounded and open",
      why: "Round containers and pill buttons give the interface a softer shape.",
      patch: { radius: 24, buttonStyle: "pill" },
    },
  ],
  layout: [
    {
      label: "Side by side",
      why: "The message and supporting visual share the first screen.",
      patch: { heroLayout: "split" },
    },
    {
      label: "One clear column",
      why: "The page presents the message before its supporting visual.",
      patch: { heroLayout: "stacked" },
    },
    {
      label: "Editorial opening",
      why: "An asymmetric opening gives the message more breathing room.",
      patch: { heroLayout: "editorial" },
    },
  ],
  texture: [
    {
      label: "Just the content",
      why: "A plain background keeps decorative detail out of the way.",
      patch: { texture: "none" },
    },
    {
      label: "Paper grain",
      why: "A subtle grain gives flat backgrounds a little texture.",
      patch: { texture: "grain" },
    },
    {
      label: "Fine grid",
      why: "A fine grid adds a measured, structured detail.",
      patch: { texture: "grid" },
    },
  ],
};

/** The current choice plus two distinct alternatives, confined to one decision's fields. */
export function buildLocalOptions(
  stepId: string,
  input: Tokens,
  purpose: Purpose = DEFAULT_PURPOSE,
): LocalOption[] {
  const step = STEPS.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Unknown design step: ${stepId}`);
  const tokens = normalizeTokens(input);
  const options: LocalOption[] = [
    { label: "Keep this choice", why: "Keep this part of your selected direction.", tokens },
  ];
  const fingerprint = (value: Tokens) => JSON.stringify(step.fields.map((field) => value[field]));
  const seen = new Set([fingerprint(tokens)]);
  const variants = (VARIANTS[stepId] ?? [])
    .map((variant, order) => ({
      variant,
      order,
      suitability: evaluate(purpose, normalizeTokens({ ...tokens, ...variant.patch })),
    }))
    .sort(
      (a, b) =>
        Number(a.suitability.blocked) - Number(b.suitability.blocked) ||
        b.suitability.score - a.suitability.score ||
        a.order - b.order,
    );
  for (const { variant } of variants) {
    const next = normalizeTokens({ ...tokens, ...variant.patch });
    const key = fingerprint(next);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ label: variant.label, why: variant.why, tokens: next });
    if (options.length === 3) break;
  }
  return options;
}
