/** Full-precision WCAG 2 relative-luminance ratio for opaque sRGB hex colors. */
export function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) throw new TypeError('Use an opaque #rgb or #rrggbb color.');
    const hex = color.length === 4 ? [...color.slice(1)].map(char => char + char).join('') : color.slice(1);
    const channels = [0, 2, 4].map(offset => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
