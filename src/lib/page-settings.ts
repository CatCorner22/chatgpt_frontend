import { focusLocalStorage, getBrowserOwnerId } from "@/lib/browser-storage";
import type { PageOptions } from "./authored-page";
import { compactImageFraming, type ImageFraming } from "./image-framing";
import { isPageComposition } from "./page-compositions";

/** Store uploaded image bytes once; undo snapshots contain only their stable key. */
export type PageImageSettings = {
  imageId: string | null;
  imageAlt: string;
  imageCredit?: string;
  imageFraming?: ImageFraming;
};
export type RelatedStory = PageImageSettings & {
  title: string;
  url: string;
  placement: "after-intro" | "after-article";
};
export const EMPTY_RELATED_STORY: RelatedStory = {
  title: "",
  url: "",
  placement: "after-article",
  imageId: null,
  imageAlt: "",
};
export type PageSettings = PageImageSettings & {
  composition: PageOptions["composition"];
  actionUrl: string;
  publicCodeUrl?: string;
  language?: NonNullable<PageOptions["language"]>;
  relatedStory?: RelatedStory;
};
export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  composition: "studio",
  actionUrl: "",
  imageId: null,
  imageAlt: "",
};
const ASSET_PREFIX = "focus:page-image:";
export const MAX_PAGE_IMAGE_BYTES = 750_000;

export function normalizePageSettings(input: unknown): PageSettings {
  const value = input && typeof input === "object" ? (input as Partial<PageSettings>) : {};
  const story = value.relatedStory;
  return {
    composition: isPageComposition(value.composition) ? value.composition : "studio",
    actionUrl: typeof value.actionUrl === "string" ? value.actionUrl.slice(0, 2000) : "",
    ...(typeof value.actionUrl === "string" &&
    value.actionUrl.length > 0 &&
    value.actionUrl.length <= 2000 &&
    value.publicCodeUrl === value.actionUrl
      ? { publicCodeUrl: value.actionUrl }
      : {}),
    ...(value.language === "ja" ? { language: value.language } : {}),
    ...normalizeImageSettings(value),
    ...(story && typeof story === "object" && !Array.isArray(story)
      ? {
          relatedStory: {
            title: typeof story.title === "string" ? story.title.slice(0, 240) : "",
            url: typeof story.url === "string" ? story.url.slice(0, 2000) : "",
            placement: story.placement === "after-intro" ? "after-intro" : "after-article",
            ...normalizeImageSettings(story),
          },
        }
      : {}),
  };
}

function normalizeImageSettings(value: Partial<PageImageSettings>): PageImageSettings {
  const imageFraming = compactImageFraming(value.imageFraming);
  return {
    imageId:
      typeof value.imageId === "string" && /^[a-f0-9]{64}$/.test(value.imageId)
        ? value.imageId
        : null,
    imageAlt: typeof value.imageAlt === "string" ? value.imageAlt.slice(0, 500) : "",
    ...(typeof value.imageCredit === "string" && value.imageCredit
      ? { imageCredit: value.imageCredit.slice(0, 500) }
      : {}),
    ...(imageFraming ? { imageFraming } : {}),
  };
}

export function rasterMime(bytes: Uint8Array): string | null {
  const starts = (values: number[]) => values.every((n, i) => bytes[i] === n);
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (starts([255, 216, 255])) return "image/jpeg";
  if (starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((n, i) => bytes[8 + i] === n))
    return "image/webp";
  return null;
}

export async function savePageImage(file: File): Promise<string> {
  const owner = getBrowserOwnerId();
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > MAX_PAGE_IMAGE_BYTES)
    throw new Error("Choose an image smaller than 750 KB so it fits in browser storage.");
  const bytes = await file.arrayBuffer();
  if (rasterMime(new Uint8Array(bytes)) !== file.type)
    throw new Error(
      "The image contents do not match its file type. Export it as a PNG, JPEG, or WebP and try again.",
    );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const id = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("This image could not be read. Please choose it again."));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("This image could not be read."));
    reader.readAsDataURL(file);
  });
  // Decode before saving: a renamed or corrupt file should not become a broken preview.
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The file is not a readable image."));
    image.src = data;
  });
  if (getBrowserOwnerId() !== owner)
    throw new Error("Your account changed. Choose the image again.");
  try {
    focusLocalStorage.setItem(ASSET_PREFIX + id, data);
  } catch {
    throw new Error(
      "There is not enough browser storage for this image. Choose a smaller image or free some space.",
    );
  }
  return id;
}

export function readPageImage(id: string | null): string | null {
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  try {
    const data = focusLocalStorage.getItem(ASSET_PREFIX + id);
    return data &&
      /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(data) &&
      data.length <= 1_010_000
      ? data
      : null;
  } catch {
    return null;
  }
}
