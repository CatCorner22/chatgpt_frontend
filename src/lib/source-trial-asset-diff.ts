/** Git's binary patch format lets one git apply check the sources and create owned assets together. */
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~";
const absent = "0".repeat(40);

function zlibStored(input: Uint8Array): Uint8Array {
  // WOFF2 is already compressed. Stored DEFLATE blocks produce identical patch bytes
  // in every browser, independent of its compression library/version.
  const blocks = Math.max(1, Math.ceil(input.length / 65535));
  const result = new Uint8Array(2 + blocks * 5 + input.length + 4);
  result.set([0x78, 0x01]);
  const view = new DataView(result.buffer);
  let offset = 2;
  for (let block = 0; block < blocks; block++) {
    const start = block * 65535;
    const chunk = input.subarray(start, start + 65535);
    result[offset] = Number(block === blocks - 1);
    view.setUint16(offset + 1, chunk.length, true);
    view.setUint16(offset + 3, 0xffff ^ chunk.length, true);
    result.set(chunk, offset + 5);
    offset += 5 + chunk.length;
  }
  let a = 1;
  let b = 0;
  for (const byte of input) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  view.setUint32(offset, b * 65536 + a);
  return result;
}

function literal(input: Uint8Array): string {
  const compressed = zlibStored(input);
  const lines = [`literal ${input.length}`];
  for (let start = 0; start < compressed.length; start += 52) {
    const size = Math.min(52, compressed.length - start);
    // A..Z denote 1..26 bytes, a..z denote 27..52.
    let line = String.fromCharCode(size <= 26 ? 64 + size : 70 + size);
    for (let i = start; i < start + size; i += 4) {
      let word = 0;
      for (let j = 0; j < 4; j++) word = word * 256 + (compressed[i + j] ?? 0);
      let encoded = "";
      for (let j = 0; j < 5; j++) {
        encoded = alphabet.charAt(word % 85) + encoded;
        word = Math.floor(word / 85);
      }
      line += encoded;
    }
    lines.push(line);
  }
  return lines.join("\n") + "\n\n";
}

// SHA-1 is required by Git's conventional blob header. The contract separately
// binds each byte sequence with SHA-256.
async function gitBlobId(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const input = new Uint8Array(header.length + bytes.length);
  input.set(header);
  input.set(bytes, header.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function makeSourceTrialAssetPatches(
  assets: readonly { path: string; bytes: Uint8Array }[],
): Promise<{ forward: string; inverse: string }> {
  const empty = literal(new Uint8Array());
  const patches = await Promise.all(
    assets.map(async ({ path, bytes }) => {
      const blob = await gitBlobId(bytes);
      const body = literal(bytes);
      const header = `diff --git a/${path} b/${path}\n`;
      return {
        forward:
          header +
          `new file mode 100644\nindex ${absent}..${blob}\nGIT binary patch\n` +
          body +
          empty,
        inverse:
          header +
          `deleted file mode 100644\nindex ${blob}..${absent}\nGIT binary patch\n` +
          empty +
          body,
      };
    }),
  );
  return {
    forward: patches.map(({ forward }) => forward).join(""),
    inverse: patches.map(({ inverse }) => inverse).join(""),
  };
}
