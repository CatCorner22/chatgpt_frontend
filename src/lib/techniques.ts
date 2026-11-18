// Modern frontend technique cards the Vision demands, plus values derived from tokens.
import type { Tokens } from "./design";
export type Technique = { id: string; name: string; use: string; floor: string };
export const TECHNIQUES: Technique[] = [
  {
    id: "fluid-type",
    name: "Fluid type sizes",
    use: "Size headings with clamp() so they grow smoothly between phone and desktop.",
    floor: "Body text never below 1rem.",
  },
  {
    id: "text-wrap",
    name: "Balanced and pretty wrapping",
    use: "text-wrap: balance on headings, text-wrap: pretty on paragraphs.",
    floor: "No single-word last lines in headlines.",
  },
  {
    id: "container-queries",
    name: "Container queries",
    use: "Cards and sections adapt to their own width with @container, not only the screen width.",
    floor: "Every component works from 320px wide.",
  },
  {
    id: "logical-props",
    name: "Logical properties",
    use: "Use margin-inline, padding-block and inset-inline so layouts survive right-to-left languages.",
    floor: "No left/right-only spacing in components.",
  },
  {
    id: "focus-visible",
    name: "Keyboard focus",
    use: "Style :focus-visible with a 2px accent outline and 2px offset.",
    floor: "Every interactive element shows focus.",
  },
  {
    id: "reduced-motion",
    name: "Reduced motion",
    use: "Wrap non-essential animation in @media (prefers-reduced-motion: no-preference).",
    floor: "Nothing moves on its own for people who ask for less motion.",
  },
  {
    id: "dvh",
    name: "Real screen height",
    use: "Use 100dvh (not 100vh) for full-height sections so phone address bars don't cut content.",
    floor: "Main action visible on a 390x700 screen.",
  },
  {
    id: "fonts",
    name: "Fast fonts",
    use: "Preload the heading font, use font-display: swap, and load only the weights you use.",
    floor: "Text visible within 1 second; at most 4 font files.",
  },
  {
    id: "images",
    name: "Images",
    use: 'Set width and height (or aspect-ratio), loading="lazy" below the first screen, and modern formats (AVIF/WebP).',
    floor: "No layout shift when images load; every image has alt text.",
  },
  {
    id: "color-mix",
    name: "Derived colors",
    use: "Make hover and border shades with color-mix(in oklch, var(--color-accent), black 12%) instead of new hex values.",
    floor: "No colors outside the tokens.",
  },
  {
    id: "view-transitions",
    name: "Page transitions",
    use: "Use the View Transitions API for gentle page changes where supported, under 250ms.",
    floor: "Pages work identically without it.",
  },
  {
    id: "touch",
    name: "Touch comfort",
    use: "Use touch-action: manipulation on controls and hover styles only inside @media (hover: hover).",
    floor: "Tap targets 44px; no hover-only information.",
  },
];

// clamp() values for each heading level from the owner's size ratio (16px base, 390–1280px).
export function fluidSizes(t: Tokens) {
  const lv = [
    ["h1", 4],
    ["h2", 2],
    ["h3", 1],
  ] as const;
  return lv.map(([name, n]) => {
    const max = Math.pow(t.scale, n),
      min = Math.max(1, max * 0.72);
    const slope = ((max - min) * 16) / (1280 - 390); // px per px of screen
    const intercept = min - (slope * 390) / 16;
    return {
      name,
      css: `clamp(${min.toFixed(2)}rem, ${intercept.toFixed(3)}rem + ${(slope * 100).toFixed(3)}vw, ${max.toFixed(2)}rem)`,
    };
  });
}

export function techniquesMarkdown(t: Tokens) {
  return `## Modern techniques (use all)
${TECHNIQUES.map((x) => `- **${x.name}:** ${x.use} Floor: ${x.floor}`).join("\n")}

Fluid heading sizes from your size ratio:
${fluidSizes(t)
  .map((f) => `- ${f.name}: \`font-size: ${f.css};\``)
  .join("\n")}`;
}
