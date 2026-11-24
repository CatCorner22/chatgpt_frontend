import { describe, expect, it } from "vitest";
import { normalizeTokens, type Content } from "@/lib/design";
import {
  addEvidence,
  designId,
  EMPTY_LAUNCH,
  launchFingerprint,
  markLaunched,
  TASKS,
  upsertProgress,
  type ReviewEvidence,
} from "@/lib/launch";
import { buildStudioLaunchArtifact } from "@/lib/studio-launch-artifact";
import { EMPTY, type State } from "@/lib/studio-state";
import { workHash } from "@/lib/ux";

const tokens = normalizeTokens({
  headingFont: "Instrument Serif",
  bg: "#f7fbff",
  accent: "#245cd6",
});
const initialTime = "2026-11-18T00:00:00Z";
const revisitTime = "2026-11-18T01:00:00Z";
const projectId = "authored-product-details";
const titleOnly = [{ title: "Class times", body: "" }];
const state: State = {
  ...EMPTY,
  stage: "rx",
  libraryId: projectId,
  tokens,
  page: { ...EMPTY.page, composition: "product" },
  purpose: { ...EMPTY.purpose, experience: "website" },
  content: {
    brand: "River Studio",
    headline: "A studio for clay",
    sub: "Classes and tools for small workshops.",
    cta: "Book a class",
    quote: "",
    features: titleOnly,
  },
};

const withFeatures = (features: Content["features"]): State => ({
  ...state,
  content: { ...state.content!, features },
});
const legacyArtifact = (input: State) => ({
  content: input.content,
  page: input.page,
  experience: input.purpose.experience,
  nav: input.nav,
});
const productArtifact = (input: State) => ({
  ...legacyArtifact(input),
  authoredOutputRevision: "product-details-v1",
});
const reviewedPage: ReviewEvidence = {
  kind: "page",
  target: "https://example.com/",
  at: initialTime,
  score: 100,
  summary: "Owned fixture review of the earlier rendered page.",
  checks: [{ name: "phone", ok: true, detail: "Fixture check", fix: "" }],
  prescription: [],
  priorities: [],
  repair: "",
};

function reviewed(artifact: unknown) {
  const records = upsertProgress([], projectId, "River Studio", tokens, initialTime, artifact);
  records[0]!.details = markLaunched(
    {
      ...addEvidence(EMPTY_LAUNCH, reviewedPage),
      url: reviewedPage.target,
      tasks: TASKS.map((task) => task.id),
    },
    initialTime,
  );
  return records;
}

function revisit(previous: ReturnType<typeof reviewed>, artifact: unknown) {
  return upsertProgress(previous, projectId, "River Studio", tokens, revisitTime, artifact)[0]!;
}

describe("Product detail launch evidence", () => {
  it.each(["", " \n\t "])(
    "invalidates earlier Product website evidence for the same title with body %j",
    (body) => {
      const input = withFeatures([
        { title: "Class times", body },
        { title: "Materials", body: "Clay and glaze are included." },
      ]);
      const previous = reviewed(legacyArtifact(input));
      expect(previous[0]!.details.status).toBe("launched");
      const artifact = buildStudioLaunchArtifact(input);
      const next = revisit(previous, artifact);

      expect(next.details).toEqual(EMPTY_LAUNCH);
      expect(next.fingerprint).not.toBe(previous[0]!.fingerprint);
      expect(artifact).toEqual(productArtifact(input));
    },
  );

  it("retains current Product evidence while preserving saved state, work hash and design ID", () => {
    const original = JSON.stringify(state);
    const savedWork = workHash(state);
    const publicDesign = designId(state.tokens);
    const previous = reviewed(productArtifact(state));
    const current = buildStudioLaunchArtifact(state);
    const next = revisit(previous, current);

    expect(next.details).toEqual(previous[0]!.details);
    expect(next.fingerprint).toBe(previous[0]!.fingerprint);
    expect(JSON.stringify(state)).toBe(original);
    expect(workHash(state)).toBe(savedWork);
    expect(designId(state.tokens)).toBe(publicDesign);
    expect(state.page).not.toHaveProperty("authoredOutputRevision");
  });

  it.each([
    { name: "no features", features: [] },
    { name: "blank feature rows", features: [{ title: " \n", body: "\t " }] },
  ])("retains the content-flow evidence identity when Product has $name", ({ features }) => {
    const input = withFeatures(features);
    const priorArtifact = { ...legacyArtifact(input), authoredOutputRevision: "content-flow-v1" };
    const previous = reviewed(priorArtifact);
    const current = buildStudioLaunchArtifact(input);
    expect(current).toEqual(priorArtifact);
    expect(launchFingerprint(tokens, current)).toBe(previous[0]!.fingerprint);
    expect(revisit(previous, current).details).toEqual(previous[0]!.details);
  });

  it.each(["studio", "editorial", "showcase", "journal"] as const)(
    "keeps the earlier evidence identity for title-only %s websites",
    (composition) => {
      const input: State = { ...state, page: { ...state.page, composition } };
      const previous = reviewed(legacyArtifact(input));
      const current = buildStudioLaunchArtifact(input);
      expect(current).toEqual(legacyArtifact(input));
      expect(revisit(previous, current).details).toEqual(previous[0]!.details);
    },
  );

  it.each([
    ["existing sites", { ...state, integration: "existing" }],
    ["apps", { ...state, purpose: { ...state.purpose, experience: "app" } }],
    [
      "Product with only body-bearing features",
      withFeatures([
        { title: "", body: "Clay and glaze are included." },
        { title: "Tools", body: "All tools are supplied." },
        { title: " ", body: "\n " },
      ]),
    ],
  ] as const)("keeps the earlier evidence identity for %s", (_case, input) => {
    const previous = reviewed(legacyArtifact(input));
    const current = buildStudioLaunchArtifact(input);
    expect(current).toEqual(legacyArtifact(input));
    expect(revisit(previous, current).details).toEqual(previous[0]!.details);
  });
});
