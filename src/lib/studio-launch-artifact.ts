import type { State } from "./studio-state";
import { getAuthoredFeatures } from "./authored-content";

type LaunchState = Pick<State, "content" | "page" | "purpose" | "nav" | "integration">;

/** Runtime review identity only; never added to saved page settings or work hashes. */
export function buildStudioLaunchArtifact(state: LaunchState) {
  const changedAuthoredOutput =
    state.integration === "new" &&
    state.purpose.experience !== "app" &&
    state.content !== null &&
    getAuthoredFeatures(state.content.features).length === 0;
  return {
    content: state.content,
    page: state.page,
    experience: state.purpose.experience,
    nav: state.nav,
    // Only this renderer branch changed. Omission preserves unaffected legacy identities.
    ...(changedAuthoredOutput ? { authoredOutputRevision: "content-flow-v1" as const } : {}),
  };
}
