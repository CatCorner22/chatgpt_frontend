import type { PageImageSettings, PageSettings } from "./page-settings";
import type { PageOptions } from "./render-authored-page";

function imageOption(settings: PageImageSettings, src: string | null) {
  return {
    ...(settings.imageFraming ? { imageFraming: settings.imageFraming } : {}),
    ...(src
      ? {
          image: {
            src,
            alt: settings.imageAlt,
            ...(settings.imageCredit ? { credit: settings.imageCredit } : {}),
          },
        }
      : {}),
  };
}

/** Studio, downloads and the layout browser use the same two validated image slots. */
export function pageOptionsWithImages(
  settings: PageSettings,
  leadSrc: string | null,
  storySrc: string | null,
): PageOptions {
  const story = settings.relatedStory;
  return {
    composition: settings.composition,
    actionUrl: settings.actionUrl,
    ...(settings.publicCodeUrl ? { publicCodeUrl: settings.publicCodeUrl } : {}),
    ...(settings.language ? { language: settings.language } : {}),
    ...imageOption(settings, leadSrc),
    ...(story
      ? {
          relatedStory: {
            title: story.title,
            url: story.url,
            ...(story.publicCodeUrl ? { publicCodeUrl: story.publicCodeUrl } : {}),
            placement: story.placement,
            ...imageOption(story, storySrc),
          },
        }
      : {}),
  };
}
