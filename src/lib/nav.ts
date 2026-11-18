// Navigation pattern chosen on the Vision; written into the builder instructions.
export const NAV_PATTERNS = [
  {
    id: "top",
    label: "Links across the top",
    when: "3–5 pages; visitors browse on computers.",
    rule: "Show all links in the header at every width; wrap or shorten labels on phones rather than hiding them.",
  },
  {
    id: "top-menu",
    label: "Top links, menu on phones",
    when: "5–7 pages; mixed devices.",
    rule: 'Show links in the header from 768px up; below that, one clearly labelled "Menu" button (text, not only an icon) opens a full-width list.',
  },
  {
    id: "bottom-tabs",
    label: "Tabs at the bottom on phones",
    when: "Visitors mostly on phones and switch between 3–5 sections often.",
    rule: "On phones, a fixed bottom bar with 3–5 labelled tabs (icon plus word), 56px tall, safe-area padding; on computers, links across the top.",
  },
] as const;
export type NavId = (typeof NAV_PATTERNS)[number]["id"];
export const navFor = (id: string | undefined) =>
  NAV_PATTERNS.find((n) => n.id === id) ?? NAV_PATTERNS[1];
export function navMarkdown(id: string | undefined) {
  const n = navFor(id);
  return `## Navigation\n- Pattern: **${n.label}** — ${n.rule}\n- Current page marked by more than color (underline or weight); 3–7 concrete labels; keyboard reachable.`;
}
