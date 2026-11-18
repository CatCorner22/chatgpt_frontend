import { tokensSchema } from "../schemas";

export interface ObservedValue {
  property: string;
  value: string;
  where?: string;
}

function canonical(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ").toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(trimmed))
    return `#${[...trimmed.slice(1)].map((char) => char + char).join("")}`;
  const rgb = /^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/.exec(trimmed);
  if (rgb && rgb.slice(1).every((value) => Number(value) <= 255))
    return `#${rgb
      .slice(1)
      .map((value) => Number(value).toString(16).padStart(2, "0"))
      .join("")}`;
  if (/^0(?:px|rem|em|%)?$/.test(trimmed)) return "0";
  return trimmed;
}

/**
 * Compares observed resolved values with a token inventory. It does not infer that a
 * matching value actually used a custom property, or that an unseen token is unused
 * in every state. Resolve rem/em/calc and custom-property references before calling.
 */
export function compareTokens(input: unknown, observations: ObservedValue[]) {
  const tokens = tokensSchema.parse(input);
  const entries = Object.entries(tokens).map(([token, value]) => ({
    token,
    value,
    normalized: canonical(value),
  }));
  const observed = new Set<string>();
  const mismatches: ObservedValue[] = [];
  for (const observation of observations) {
    if (
      !observation ||
      typeof observation.property !== "string" ||
      typeof observation.value !== "string" ||
      !observation.value.trim()
    ) {
      throw new TypeError("Every observation needs a property and a nonempty value.");
    }
    const normalized = canonical(observation.value);
    observed.add(normalized);
    if (!entries.some((entry) => entry.normalized === normalized))
      mismatches.push({ ...observation });
  }
  return {
    mismatches,
    unobservedTokens: entries
      .filter((entry) => !observed.has(entry.normalized))
      .map(({ token, value }) => ({ token, value })),
    limitation:
      "Values are compared within the supplied observations. An unobserved token may be used in another state; equal values do not prove token references.",
  };
}

export type PixelArray = readonly number[] | Uint8Array | Uint8ClampedArray;

/** Raw RGBA channel difference, not a perceptual quality or similarity score. */
export function comparePixels(first: PixelArray, second: PixelArray, threshold = 16) {
  if (first.length !== second.length || first.length % 4 !== 0)
    throw new RangeError("RGBA arrays must have equal lengths divisible by four.");
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255)
    throw new RangeError("Pixel threshold must be between 0 and 255.");
  const totals: [number, number, number, number] = [0, 0, 0, 0];
  let clearlyDifferent = 0;
  for (let index = 0; index < first.length; index += 4) {
    let differs = false;
    for (let channel = 0; channel < 4; channel++) {
      const a = first[index + channel]!;
      const b = second[index + channel]!;
      if (![a, b].every((value) => Number.isInteger(value) && value >= 0 && value <= 255))
        throw new RangeError("RGBA channels must be integers between 0 and 255.");
      const delta = Math.abs(a - b);
      totals[channel] = totals[channel]! + delta;
      if (delta > threshold) differs = true;
    }
    if (differs) clearlyDifferent++;
  }
  const pixels = first.length / 4;
  return {
    meanDifferencePerChannel: totals.map((total) => (pixels ? total / pixels : 0)) as [
      number,
      number,
      number,
      number,
    ],
    clearlyDifferentShare: pixels ? clearlyDifferent / pixels : 0,
    pixels,
    threshold,
  };
}
