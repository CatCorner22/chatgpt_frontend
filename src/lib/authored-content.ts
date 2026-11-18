import type { Content } from "./design";

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
