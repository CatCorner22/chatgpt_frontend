import type { Content } from "./design";

/** Preserve owner punctuation; only surrounding whitespace is presentation padding. */
export function getAuthoredQuote(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Compare with v14 output for review invalidation only. Never render the legacy text. */
export function authoredQuoteChangesLegacyOutput(value: unknown): boolean {
  const quote = getAuthoredQuote(value);
  if (!quote) return false;
  const legacy = "“" + quote.replace(/^["“]+|["”]+$/g, "") + "”";
  return quote !== legacy;
}

/** A disclosure needs additional content, not merely a visible heading. */
export function hasAuthoredFeatureDescription(feature: Content["features"][number]): boolean {
  return typeof feature?.body === "string" && !!feature.body.trim();
}

/** The renderer and evidence identity use the same definition of a visible feature. */
export function getAuthoredFeatures(features: Content["features"]): Content["features"] {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return (Array.isArray(features) ? features : []).filter(
    (feature) => feature && (text(feature.title) || text(feature.body)),
  );
}
