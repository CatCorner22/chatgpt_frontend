// Pure address-range checks used after DNS lookup; tested in netguard.test.ts.
export function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number];
  return (
    a === 10 || a === 127 || a === 0 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0)
  );
}

export function isPrivateV6(ip: string): boolean {
  const s = ip.toLowerCase();
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]!);
  if (s.startsWith("::ffff:") || s === "::" || s === "::1") return true;
  const first = parseInt(s.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xff00) === 0xff00 || // multicast
    s.startsWith("64:ff9b:") || s.startsWith("2001:db8") || s.startsWith("100:")
  );
}

/** Every resolved address must be public; an empty answer is refused. */
export function allPublic(v4: string[], v6: string[]): boolean {
  if (v4.length + v6.length === 0) return false;
  return !v4.some(isPrivateV4) && !v6.some(isPrivateV6);
}
