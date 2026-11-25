export type ComparisonMeasurement = {
  fits: boolean;
  options: { name: string; fits: boolean; priceText: string[] }[];
};

// The comparison renderer emits plain text in h3 and p. Measure glyphs after its fonts settle.
// Vertical scrolling is expected. Check clipped containers, including any future line clamp.
function textFits(element: HTMLElement, viewport: number): boolean {
  const win = element.ownerDocument.defaultView!;
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const lines = Array.from(range.getClientRects()).filter((rect) => rect.width && rect.height);
  if (!lines.length || lines.some((rect) => rect.left < -0.5 || rect.right > viewport + 0.5))
    return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (style.visibility !== "visible" || Number(style.opacity) === 0) return false;
    if (node === element.ownerDocument.documentElement) break;
    const rect = node.getBoundingClientRect();
    if (
      (style.overflowX !== "visible" &&
        lines.some((line) => line.left < rect.left - 0.5 || line.right > rect.right + 0.5)) ||
      (style.overflowY !== "visible" &&
        lines.some((line) => line.top < rect.top - 0.5 || line.bottom > rect.bottom + 0.5))
    )
      return false;
  }
  return true;
}

export function measureComparisonText(doc: Document): ComparisonMeasurement {
  if (doc.defaultView?.innerWidth !== 320 || !doc.body.classList.contains("comparison"))
    throw new Error("The comparison page requires a 320 px viewport.");
  const viewport = doc.documentElement.clientWidth;
  if (viewport <= 0) throw new Error("The page has no measured width.");
  const rows = doc.querySelectorAll<HTMLElement>("section.option-comparison ul.option-list > li");
  return {
    fits: doc.documentElement.scrollWidth <= viewport,
    options: Array.from(rows, (row) => {
      const heading = row.querySelector<HTMLElement>("h3");
      const parts = Array.from(row.querySelectorAll<HTMLElement>("h3, p"));
      const fits = !!heading && parts.every((part) => textFits(part, viewport));
      // Quote whole author fields. Parsing money could truncate grouped, discounted or per-person prices.
      const priceText = parts
        .map((part) => part.textContent ?? "")
        .filter((text) => /(?:\p{Sc}\s*\d|\d\s*\p{Sc})/u.test(text));
      return { name: heading?.textContent || "Unnamed option", fits, priceText };
    }),
  };
}
