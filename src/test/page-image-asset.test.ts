import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { validatePageImageAsset } from "@/lib/page-image-asset";
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=",
  "base64",
);
const id = createHash("sha256").update(bytes).digest("hex");
const source = `data:image/png;base64,${bytes.toString("base64")}`;
const decode = vi.fn();
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  decode.mockReset();
  decode.mockReturnValue(true);
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 1;
      naturalHeight = 1;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        queueMicrotask(() => (decode(value) ? this.onload?.() : this.onerror?.()));
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("persisted image byte validation", () => {
  it("accepts only the exact readable image matching its identity", async () => {
    await expect(validatePageImageAsset(id, source)).resolves.toBe(source);
    expect(decode).toHaveBeenCalledWith(source);
  });
  it("rejects missing data without attempting decode", async () => {
    await expect(validatePageImageAsset(id, null)).rejects.toThrow(/missing or unreadable/);
    expect(decode).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures before attempting decode", async () => {
    await expect(validatePageImageAsset(id, "data:image/png;base64,AAAA")).rejects.toThrow(
      /damaged/,
    );
    expect(decode).not.toHaveBeenCalled();
  });
  it("rejects readable replacement bytes stored under another image's identity", async () => {
    await expect(validatePageImageAsset("a".repeat(64), source)).rejects.toThrow(/does not match/);
    expect(decode).not.toHaveBeenCalled();
  });
  it("requires actual browser decoding even when signature and identity match", async () => {
    const truncated = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const truncatedId = createHash("sha256").update(truncated).digest("hex");
    decode.mockReturnValue(false);
    await expect(
      validatePageImageAsset(truncatedId, `data:image/png;base64,${truncated.toString("base64")}`),
    ).rejects.toThrow(/cannot be read/);
    expect(decode).toHaveBeenCalledOnce();
  });
  it("rejects noncanonical base64 rather than acknowledging ambiguous bytes", async () => {
    await expect(validatePageImageAsset(id, source.replace(/=$/, "=="))).rejects.toThrow(/damaged/);
    expect(decode).not.toHaveBeenCalled();
  });
});
