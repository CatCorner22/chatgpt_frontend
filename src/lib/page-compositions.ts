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
