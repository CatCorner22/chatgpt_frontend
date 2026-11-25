import { createHash } from "node:crypto";
import { vi } from "vitest";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XD8AAAAASUVORK5CYII=",
  "base64",
);

export function pngAsset(suffix = "") {
  const bytes = Buffer.concat([png, Buffer.from(suffix)]);
  return {
    id: createHash("sha256").update(bytes).digest("hex"),
    src: `data:image/png;base64,${bytes.toString("base64")}`,
  };
}

// jsdom does not decode images. Keep real MIME and hash validation in the tests.
export function stubImageDecode(canDecode: (src: string) => boolean = () => true) {
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 1;
      naturalHeight = 1;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        queueMicrotask(() => (canDecode(value) ? this.onload?.() : this.onerror?.()));
      }
    },
  );
}
