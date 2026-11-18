import { describe, expect, it } from "vitest";
import { allPublic, isPrivateV4, isPrivateV6 } from "@/lib/netguard";

describe("address guard", () => {
  it("blocks private IPv4", () => {
    expect(isPrivateV4("10.0.0.1")).toBe(true);
    expect(isPrivateV4("169.254.169.254")).toBe(true);
    expect(isPrivateV4("8.8.8.8")).toBe(false);
  });
  it("blocks private and IPv4-mapped IPv6", () => {
    expect(isPrivateV6("::1")).toBe(true);
    expect(isPrivateV6("fd00::1")).toBe(true);
    expect(isPrivateV6("fe80::1")).toBe(true);
    expect(isPrivateV6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateV6("2606:4700::1111")).toBe(false);
  });
  it("refuses a name if any answer is private or none resolve", () => {
    expect(allPublic(["8.8.8.8"], ["fd00::1"])).toBe(false);
    expect(allPublic([], [])).toBe(false);
    expect(allPublic(["8.8.8.8"], [])).toBe(true);
  });
});
