import { afterEach, describe, expect, it, vi } from "vitest";
import { readFocusStamp } from "@/lib/critic";
import { signId, stampStatus } from "@/lib/signing.server";

afterEach(() => vi.unstubAllEnvs());

describe("signed design IDs", () => {
  it("reads id and signature from the generator tag", () => {
    const html = '<meta name="generator" content="Focus design f-0123456789.00112233aabbccdd">';
    expect(readFocusStamp(html)).toEqual({ id: "f-0123456789", sig: "00112233aabbccdd" });
  });
  it("accepts a Focus-issued signature and rejects a copied one", async () => {
    vi.stubEnv("FOCUS_SIGNING_KEY", "test-key-test-key-test-key-1234");
    const sig = await signId("f-0123456789");
    expect(await stampStatus({ id: "f-0123456789", sig })).toBe("signed");
    expect(await stampStatus({ id: "f-9999999999", sig })).toBe("forged");
    expect(await stampStatus({ id: "f-0123456789", sig: null })).toBe("unsigned");
  });
});
