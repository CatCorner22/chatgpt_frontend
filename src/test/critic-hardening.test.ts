import { describe, expect, it } from "vitest";
import { analyzePage, safeUrl } from "@/lib/critic";

describe("untrusted Critic input", () => {
  it("rejects credentials, service ports, and reserved networks", () => {
    for (const address of [
      "https://user:pass@example.com",
      "https://example.com:8080",
      "100.64.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "255.255.255.255",
      "http://2130706433",
      "http://0x7f000001",
    ]) {
      expect(safeUrl(address), address).toBeNull();
    }
    expect(safeUrl("https://example.com:443")?.hostname).toBe("example.com");
  });
  it("does not crash on malformed font URL escapes", () => {
    const result = analyzePage('<link href="https://fonts.googleapis.com/css?family=%ZZ">', "");
    expect(Number.isFinite(result.score)).toBe(true);
  });
  it("counts an empty document as zero words", () => {
    expect(analyzePage("", "").facts.words).toBe(0);
  });
});
