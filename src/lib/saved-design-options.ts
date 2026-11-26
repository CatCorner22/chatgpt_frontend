import type { LibraryEntry } from "./library";

export function savedDesignOptions(choices: readonly LibraryEntry[]) {
  const headlinesByTitle = new Map<string, Map<string, number>>();
  for (const { title, state } of choices) {
    const counts = headlinesByTitle.get(title) ?? new Map<string, number>();
    const headline = state.content.headline.trim();
    counts.set(headline, (counts.get(headline) ?? 0) + 1);
    headlinesByTitle.set(title, counts);
  }
  return choices.map(({ id, title, state }) => {
    const counts = headlinesByTitle.get(title)!;
    const headline = state.content.headline.trim();
    const sameHeadline = counts.get(headline)!;
    if (counts.size === 1 && sameHeadline === 1) return { id, title };
    const label = [title, headline, sameHeadline > 1 || !headline ? id : ""].filter(Boolean);
    return { id, title: label.join(" — ") };
  });
}
