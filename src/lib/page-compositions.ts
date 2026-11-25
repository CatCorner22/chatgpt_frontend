/** Shared by the renderer, saved-state migration, and the composition picker. */
export const PAGE_COMPOSITIONS = [
  {
    id: "studio",
    title: "Studio",
    description: "An expressive opening, with room for an image and a clear offer.",
  },
  {
    id: "editorial",
    title: "Editorial",
    description: "A deliberate reading rhythm. Ideas and detail lead the page.",
  },
  {
    id: "product",
    title: "Product",
    description: "A direct proposition, followed by capabilities and a next step.",
  },
  {
    id: "comparison",
    title: "Comparison",
    description: "Show your offers and their details together before the main action.",
  },
  {
    id: "showcase",
    title: "Showcase",
    description:
      "Give one image room to speak. Lead visitors from a clear statement to the details.",
  },
  {
    id: "journal",
    title: "Journal",
    description:
      "A strong lead with a compact section index. Help readers find what matters to them.",
  },
] as const;

export type PageComposition = (typeof PAGE_COMPOSITIONS)[number]["id"];

export function isPageComposition(value: unknown): value is PageComposition {
  return PAGE_COMPOSITIONS.some((choice) => choice.id === value);
}

export function usesOptionComparison(page: unknown) {
  return (
    !!page && typeof page === "object" && "composition" in page && page.composition === "comparison"
  );
}

export const COMPARISON_HANDOFF =
  "Show the options together before the primary action. Use the supplied feature titles and descriptions in their original order, with every supplied price and time visible beside its option. At a narrow width, stack the options and keep each description with its name. Keep each option informational. When the owner supplies a primary destination, use a single navigation link after the list. This link opens the destination. Verify any reservation or payment separately with that service. Check the displayed options against the complete owner copy on phone and desktop.";
