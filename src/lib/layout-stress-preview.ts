import { textFits } from "./comparison-measurement";
import type { Content } from "./design";
import type { PageOptions } from "./render-authored-page";

const actionUrl = "https://example.invalid/focus-layout-preview/booking";
const headline =
  "A weekend workshop for everyone who has ever wanted to make something extraordinary together";
const bookingLabel = "Reserve a place for your whole group";
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
    headline,
    cta: bookingLabel,
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
  function showsText(node: HTMLElement | null, expected: string) {
    return node?.textContent === expected && textFits(node, width);
  }
  if (!showsText(doc.querySelector("main h1"), headline))
    issues.push("The headline is missing, clipped, or hidden.");
  for (const [index, offer] of offers.entries()) {
    if (!showsText(doc.querySelector(`#feature-${index + 1} h3`), offer.title))
      issues.push(
        `Check “${offer.title}”. Its full name and price are missing, clipped, or hidden.`,
      );
  }
  const actions = doc.querySelectorAll<HTMLAnchorElement>("main a.action");
  if (!actions.length) issues.push("The booking button is missing.");
  for (const action of actions) {
    if (showsText(action.querySelector("span"), bookingLabel)) continue;
    const part = action.closest(".closing")
      ? "closing section"
      : action.closest(".hero")
        ? "opening section"
        : "offers";
    issues.push(`The booking button label in the ${part} is missing, clipped, or hidden.`);
  }
  return issues;
}
