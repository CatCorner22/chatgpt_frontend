import { tokensSchema } from "../schemas";

/**
 * A stable, public, non-cryptographic label for sorted, trimmed token values.
 * This is not a secret, signature, ownership proof, or guarantee against collisions.
 * Its neutral format is intentionally distinct from app-specific historical labels.
 */
export function designId(input: unknown): string {
  const tokens = tokensSchema.parse(input);
  const canonical = JSON.stringify(
    Object.keys(tokens)
      .sort()
      .map((key) => [key, tokens[key]]),
  );
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < canonical.length; index++) {
    const value = canonical.charCodeAt(index);
    first = Math.imul(first ^ value, 0x01000193) >>> 0;
    second = Math.imul(second ^ value, 0x01000195) >>> 0;
  }
  return `d-${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}
