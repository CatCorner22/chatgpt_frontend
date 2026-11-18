/** Computed styles are observations, not proof of a custom property's provenance. */
export function collectTokenObservations(
  page: Document,
): { property: string; value: string; where?: string }[] {
  const view = page.defaultView;
  if (!view) return [];
  const properties = [
    "color",
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "font-family",
    "font-size",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "box-shadow",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "row-gap",
    "column-gap",
  ];
  const values: { property: string; value: string; where?: string }[] = [];
  for (const el of Array.from(page.querySelectorAll("body, body *"))) {
    if (!el.getClientRects().length || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName))
      continue;
    const style = view.getComputedStyle(el);
    for (const property of properties) {
      const value = style.getPropertyValue(property).trim();
      if (value)
        values.push({
          property,
          value,
          where: el.id
            ? `#${el.id
                .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 239)}`
            : el.tagName.toLowerCase(),
        });
    }
  }
  return values;
}
