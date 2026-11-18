import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_FRAMING,
  IMAGE_NARROW_BREAKPOINT,
  IMAGE_POSITIONS,
  IMAGE_POSITION_LABELS,
  compactImageFraming,
  getImageFramingCss,
  normalizeImageFraming,
  type ImageFraming,
} from "@/lib/image-framing";

describe("authored image framing", () => {
  it("keeps defaults absent from serialized settings while preserving explicit choices", () => {
    expect(IMAGE_NARROW_BREAKPOINT).toBe(760);
    expect(normalizeImageFraming(undefined)).toEqual(DEFAULT_IMAGE_FRAMING);
    expect(compactImageFraming(DEFAULT_IMAGE_FRAMING)).toBeUndefined();
    expect(compactImageFraming({ ...DEFAULT_IMAGE_FRAMING, narrowPosition: "center" })).toEqual({
      fit: "cover",
      position: "center",
      narrowPosition: "center",
    });
  });

  it("normalizes invalid fields independently and retains cover anchors in contain mode", () => {
    const framing = {
      fit: "contain",
      position: "top-left",
      narrowPosition: "bottom-right",
    } satisfies ImageFraming;
    expect(compactImageFraming(framing)).toEqual(framing);
    expect(getImageFramingCss(framing)).toEqual({
      fit: "contain",
      position: "center center",
      narrowPosition: "center center",
    });
    expect(getImageFramingCss({ ...framing, fit: "cover" })).toEqual({
      fit: "cover",
      position: "left top",
      narrowPosition: "right bottom",
    });
    expect(
      normalizeImageFraming({
        fit: "url(https://example.com/a)",
        position: "right",
        narrowPosition: "</style><script>",
      }),
    ).toEqual({ fit: "cover", position: "right", narrowPosition: "same" });
    expect(compactImageFraming([framing])).toBeUndefined();
  });

  it("maps all nine safe anchors and inherits the wider alignment for same", () => {
    expect(IMAGE_POSITIONS.map((position) => IMAGE_POSITION_LABELS[position])).toEqual([
      "Top left",
      "Top center",
      "Top right",
      "Center left",
      "Center",
      "Center right",
      "Bottom left",
      "Bottom center",
      "Bottom right",
    ]);
    const css = IMAGE_POSITIONS.map((position) =>
      getImageFramingCss({ fit: "cover", position, narrowPosition: "same" }),
    );
    expect(css.map((entry) => entry.position)).toEqual([
      "left top",
      "center top",
      "right top",
      "left center",
      "center center",
      "right center",
      "left bottom",
      "center bottom",
      "right bottom",
    ]);
    expect(css.map((entry) => entry.narrowPosition)).toEqual(css.map((entry) => entry.position));
  });
});
