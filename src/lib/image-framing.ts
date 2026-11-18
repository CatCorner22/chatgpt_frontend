export const IMAGE_POSITIONS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;

export type ImagePosition = (typeof IMAGE_POSITIONS)[number];
export type ImageFraming = {
  fit: "cover" | "contain";
  position: ImagePosition;
  narrowPosition: ImagePosition | "same";
};

export const IMAGE_POSITION_LABELS: Readonly<Record<ImagePosition, string>> = {
  "top-left": "Top left",
  top: "Top center",
  "top-right": "Top right",
  left: "Center left",
  center: "Center",
  right: "Center right",
  "bottom-left": "Bottom left",
  bottom: "Bottom center",
  "bottom-right": "Bottom right",
};

export const DEFAULT_IMAGE_FRAMING: Readonly<ImageFraming> = {
  fit: "cover",
  position: "center",
  narrowPosition: "same",
};

export const IMAGE_NARROW_BREAKPOINT = 760;

const cssPositions: Record<ImagePosition, string> = {
  "top-left": "left top",
  top: "center top",
  "top-right": "right top",
  left: "left center",
  center: "center center",
  right: "right center",
  "bottom-left": "left bottom",
  bottom: "center bottom",
  "bottom-right": "right bottom",
};

const isPosition = (value: unknown): value is ImagePosition =>
  IMAGE_POSITIONS.some((position) => position === value);

export function normalizeImageFraming(input: unknown): ImageFraming {
  const value =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Partial<ImageFraming>)
      : {};
  return {
    fit: value.fit === "contain" ? "contain" : DEFAULT_IMAGE_FRAMING.fit,
    position: isPosition(value.position) ? value.position : DEFAULT_IMAGE_FRAMING.position,
    narrowPosition: isPosition(value.narrowPosition)
      ? value.narrowPosition
      : DEFAULT_IMAGE_FRAMING.narrowPosition,
  };
}

/** Omit the legacy behavior from saved settings so existing fingerprints stay stable. */
export function compactImageFraming(input: unknown): ImageFraming | undefined {
  const framing = normalizeImageFraming(input);
  return framing.fit === "cover" &&
    framing.position === "center" &&
    framing.narrowPosition === "same"
    ? undefined
    : framing;
}

export function getImageFramingCss(input: unknown) {
  const { fit, position, narrowPosition } = normalizeImageFraming(input);
  if (fit === "contain") {
    return { fit, position: cssPositions.center, narrowPosition: cssPositions.center };
  }
  return {
    fit,
    position: cssPositions[position],
    narrowPosition: cssPositions[narrowPosition === "same" ? position : narrowPosition],
  };
}
