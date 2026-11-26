import type { Tokens } from "@/lib/design";
import {
  addEvidence,
  EMPTY_LAUNCH,
  markLaunched,
  TASKS,
  upsertProgress,
  type ProgressRecord,
  type ReviewEvidence,
} from "@/lib/launch";
import type { State } from "@/lib/studio-state";

// This historic shape is independent of the current renderer's revision fields.
export function legacyArtifact(state: State) {
  return {
    content: state.content,
    page: state.page,
    experience: state.purpose.experience,
    nav: state.nav,
  };
}

export function launchEvidenceFixture(
  projectId: string,
  title: string,
  tokens: Tokens,
  summary = "Owned fixture review of the earlier rendered page.",
) {
  const reviewedPage: ReviewEvidence = {
    kind: "page",
    target: "https://example.com/",
    at: "2026-11-18T00:00:00Z",
    score: 100,
    summary,
    checks: [{ name: "phone", ok: true, detail: "Fixture check", fix: "" }],
    prescription: [],
    priorities: [],
    repair: "",
  };

  function reviewed(artifact: unknown) {
    const records = upsertProgress([], projectId, title, tokens, reviewedPage.at, artifact);
    records[0]!.details = markLaunched(
      {
        ...addEvidence(EMPTY_LAUNCH, reviewedPage),
        url: reviewedPage.target,
        tasks: TASKS.map((task) => task.id),
      },
      reviewedPage.at,
    );
    return records;
  }

  function revisit(previous: ProgressRecord[], artifact: unknown, at = "2026-11-18T01:00:00Z") {
    return upsertProgress(previous, projectId, title, tokens, at, artifact)[0]!;
  }

  return { reviewed, revisit, reviewedPage };
}
