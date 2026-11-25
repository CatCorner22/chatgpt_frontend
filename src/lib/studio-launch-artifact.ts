import { changesPreviousActionMarkup } from "./action-destination";
import { usesNewGalleryTypeface } from "./authored-font-availability";
import type { State } from "./studio-state";
import {
  authoredQuoteChangesLegacyOutput,
  getAuthoredFeatures,
  hasAuthoredFeatureDescription,
} from "./authored-content";

type LaunchState = Pick<State, "content" | "page" | "purpose" | "nav" | "integration" | "tokens">;

// These layouts published pages before action-url-v1. Later layouts already fingerprinted
// their serialized main address and had no earlier related-story output to invalidate.
const layoutsBeforeActionRevision = ["studio", "editorial", "product", "showcase", "journal"];

/** Runtime review identity only; never added to saved page settings or work hashes. */
export function buildStudioLaunchArtifact(state: LaunchState) {
  const isAuthoredPage =
    state.integration === "new" && state.purpose.experience !== "app" && state.content !== null;
  const hadEarlierLayout = layoutsBeforeActionRevision.includes(state.page.composition);
  const features = state.content ? getAuthoredFeatures(state.content.features) : [];
  const authoredOutputRevision = !isAuthoredPage
    ? undefined
    : features.length === 0
      ? ("content-flow-v1" as const)
      : state.page.composition === "product" &&
          features.some((feature) => !hasAuthoredFeatureDescription(feature))
        ? ("product-details-v1" as const)
        : undefined;
  return {
    content: state.content,
    page: state.page,
    experience: state.purpose.experience,
    nav: state.nav,
    // Preserve prior revisions and exact legacy identities for unaffected renderer branches.
    ...(isAuthoredPage &&
    (changesPreviousActionMarkup(state.page.actionUrl, hadEarlierLayout) ||
      (hadEarlierLayout &&
        state.page.relatedStory?.title.trim() &&
        changesPreviousActionMarkup(state.page.relatedStory.url)))
      ? { authoredActionRevision: "action-url-v1" as const }
      : {}),
    ...(authoredOutputRevision ? { authoredOutputRevision } : {}),
    ...(isAuthoredPage &&
    state.page.composition === "product" &&
    features.some(hasAuthoredFeatureDescription)
      ? { authoredPrintRevision: "product-print-v1" as const }
      : {}),
    ...(isAuthoredPage &&
    state.tokens &&
    usesNewGalleryTypeface(state.tokens.headingFont, state.tokens.bodyFont)
      ? { authoredFontRevision: "gallery-type-v1" as const }
      : {}),
    ...(isAuthoredPage && authoredQuoteChangesLegacyOutput(state.content?.quote)
      ? { authoredQuoteRevision: "quote-text-v1" as const }
      : {}),
  };
}
