import type { Content } from "./design";

/** The renderer and evidence identity use the same definition of a visible feature. */
export function getAuthoredFeatures(features: Content["features"]): Content["features"] {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return (Array.isArray(features) ? features : []).filter(
    (feature) => feature && (text(feature.title) || text(feature.body)),
  );
}
