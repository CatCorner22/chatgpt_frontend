import { textFits } from "./comparison-measurement";
import type { Content } from "./design";
import type { PageOptions } from "./render-authored-page";

const actionUrl = "https://example.invalid/focus-layout-preview/booking";
const offers = [
  {
    title: "One studio place · $185 per person",
    body: "Both afternoons, with materials included.",
  },
  {
    title: "A pair of places · $350 for two people",
    body: "Bring a friend and share a worktable.",
  },
  {
    title: "Family table · $1,275.50 per extended family",
    body: "A full table and a dedicated guide.",
  },
  {
    title: "Private group · $12,450.75 for the whole weekend",
    body: "Reserve the studio for up to thirty guests.",
  },
];

/** This example belongs only to the layout browser. Never pass it to Studio or storage. */
export function trickyLayoutExample(content: Content, options: PageOptions) {
  const example: Content = {
    ...content,
    headline:
      "A weekend workshop for everyone who has ever wanted to make something extraordinary together",
    cta: "Reserve a place for your whole group",
    features: offers,
  };
  const { image: _image, imageFraming: _framing, ...rest } = options;
  return { content: example, options: { ...rest, actionUrl } };
}

/** The example button scrolls inside the preview instead of opening an imaginary booking service. */
export function localizeExampleAction(html: string): string {
  return html.replaceAll(`href="${actionUrl}"`, 'href="#details"');
}

export function measureTrickyLayout(doc: Document): string[] {
  const width = doc.documentElement.clientWidth;
  if (!width) throw new Error("Unable to measure this preview.");
  const issues: string[] = [];
  if (doc.documentElement.scrollWidth > width)
    issues.push("The page scrolls sideways. Check the right edge of the preview.");
  function checkText(selector: string, expected: string | undefined, message: string) {
    const node = doc.querySelector<HTMLElement>(selector);
    if (!node || (expected && node.textContent !== expected) || !textFits(node, width))
      issues.push(message);
  }
  checkText("main h1", undefined, "The headline is missing, clipped, or hidden.");
  for (const [index, offer] of offers.entries()) {
    checkText(
      `#feature-${index + 1} h3`,
      offer.title,
      `Check “${offer.title}”. Its full name and price are missing, clipped, or hidden.`,
    );
  }
  checkText(
    "main a.action span",
    "Reserve a place for your whole group",
    "The booking button label is missing, clipped, or hidden.",
  );
  return issues;
}
