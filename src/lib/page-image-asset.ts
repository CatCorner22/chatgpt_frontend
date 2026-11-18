import { MAX_PAGE_IMAGE_BYTES, rasterMime } from "./page-settings";

const recovery =
  "Choose the original file again, or remove the image to export a text-only page. The stored data has not been changed.";

/** Browser storage is untrusted: validate the actual bytes before preview or handoff. */
export async function validatePageImageAsset(id: string, source: string | null): Promise<string> {
  if (!source) throw new Error(`This saved image is missing or unreadable. ${recovery}`);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match || match[2]!.length > 1_000_000 || match[2]!.length % 4 !== 0)
    throw new Error(`This saved image is damaged. ${recovery}`);
  let decoded: string;
  try {
    decoded = atob(match[2]!);
  } catch {
    throw new Error(`This saved image is damaged. ${recovery}`);
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (
    !bytes.length ||
    bytes.length > MAX_PAGE_IMAGE_BYTES ||
    rasterMime(bytes) !== match[1] ||
    btoa(decoded) !== match[2]
  )
    throw new Error(`This saved image is damaged. ${recovery}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  const actualId = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (actualId !== id)
    throw new Error(`This saved image does not match the file you added. ${recovery}`);
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    const finish = (message?: string) => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (message) reject(new Error(`${message} ${recovery}`));
      else resolve();
    };
    const timeout = setTimeout(() => finish("Checking this saved image took too long."), 10_000);
    image.onload = () =>
      finish(
        image.naturalWidth && image.naturalHeight ? undefined : "This saved image cannot be read.",
      );
    image.onerror = () => finish("This saved image cannot be read.");
    image.src = source;
  });
  return source;
}
