import type { State } from "./studio-state";
import { getAuthoredFeatures, hasAuthoredFeatureDescription } from "./authored-content";

type LaunchState = Pick<State, "content" | "page" | "purpose" | "nav" | "integration">;

/** Runtime review identity only; never added to saved page settings or work hashes. */
export function buildStudioLaunchArtifact(state: LaunchState) {
  const isAuthoredPage =
    state.integration === "new" && state.purpose.experience !== "app" && state.content !== null;
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
    ...(authoredOutputRevision ? { authoredOutputRevision } : {}),
  };
}
