import { describe, expect, it } from "vitest";
import { normalizeTokens } from "@/lib/design";
import { designId, EMPTY_LAUNCH, launchFingerprint } from "@/lib/launch";
import { buildStudioLaunchArtifact } from "@/lib/studio-launch-artifact";
import { EMPTY, type State } from "@/lib/studio-state";
import { workHash } from "@/lib/ux";
import { launchEvidenceFixture, legacyArtifact } from "./launch-evidence.fixture";

const tokens = normalizeTokens({ headingFont: "Instrument Serif" });
const projectId = "authored-quote-text";
const state: State = {
  ...EMPTY,
  stage: "rx",
  libraryId: projectId,
  tokens,
  purpose: { ...EMPTY.purpose, experience: "website" },
  content: {
    brand: "River Studio",
    headline: "A studio for clay",
    sub: "Classes and tools for small workshops.",
    cta: "Book a class",
    quote: "It felt like home.",
    features: [{ title: "Tools", body: "All tools are supplied." }],
  },
};
const withQuote = (quote: string): State => ({ ...state, content: { ...state.content!, quote } });
const priorArtifact = (
  input: State,
  authoredOutputRevision?: "content-flow-v1" | "product-details-v1",
) => ({
  ...legacyArtifact(input),
  ...(authoredOutputRevision ? { authoredOutputRevision } : {}),
});
const withQuoteRevision = (artifact: ReturnType<typeof priorArtifact>) => ({
  ...artifact,
  authoredQuoteRevision: "quote-text-v1",
});

const { reviewed, revisit } = launchEvidenceFixture(projectId, "River Studio", tokens);

const sparse: State = { ...state, content: { ...state.content!, features: [] } };
const staticProduct: State = {
  ...state,
  page: { ...state.page, composition: "product" },
  content: { ...state.content!, features: [{ title: "Class times", body: " \t " }] },
};

describe("authored quotation evidence identity", () => {
  it.each([
    ["unmarked", "It felt like home."],
    ["straight", '"It felt like home."'],
    ["unbalanced", "“It felt like home."],
    ["nested", '“"It felt like home."”'],
    ["punctuation-only", '"'],
  ])("invalidates v14 evidence when a supplied %s quote changes visually", (_name, quote) => {
    const input = withQuote(quote);
    const previous = reviewed(priorArtifact(input));
    expect(previous[0]!.details.status).toBe("launched");
    const current = buildStudioLaunchArtifact(input);
    const next = revisit(previous, current);
    expect(current).toEqual(withQuoteRevision(priorArtifact(input)));
    expect(next.details).toEqual(EMPTY_LAUNCH);
    expect(next.fingerprint).not.toBe(previous[0]!.fingerprint);
  });

  it.each([
    { input: sparse, revision: "content-flow-v1" },
    { input: staticProduct, revision: "product-details-v1" },
  ] as const)(
    "keeps the existing $revision output revision independently when quotation output changes",
    ({ input, revision }) => {
      const before = priorArtifact(input, revision);
      const previous = reviewed(before);
      const current = buildStudioLaunchArtifact(input);
      expect(current).toEqual(withQuoteRevision(before));
      expect(revisit(previous, current).details).toEqual(EMPTY_LAUNCH);
    },
  );

  it.each([" \n\t", "  “It felt like home.” ", "“”"])(
    "keeps earlier review evidence when %j produces the same quotation output",
    (quote) => {
      const input = withQuote(quote);
      const before = priorArtifact(input);
      const previous = reviewed(before);
      const current = buildStudioLaunchArtifact(input);
      expect(current).toEqual(before);
      expect(launchFingerprint(tokens, current)).toBe(previous[0]!.fingerprint);
      expect(revisit(previous, current).details).toEqual(previous[0]!.details);
    },
  );

  it.each([
    ["existing websites", { ...state, integration: "existing" }],
    ["apps", { ...state, purpose: { ...state.purpose, experience: "app" } }],
  ] as const)("leaves %s evidence unchanged", (_name, input) => {
    const previous = reviewed(priorArtifact(input));
    const current = buildStudioLaunchArtifact(input);
    expect(current).toEqual(priorArtifact(input));
    expect(revisit(previous, current).details).toEqual(previous[0]!.details);
  });

  it("retains current evidence without changing the saved state, work hash, or design ID", () => {
    const savedState = JSON.stringify(staticProduct);
    const previousWork = workHash(staticProduct);
    const publicId = designId(staticProduct.tokens);
    const previous = reviewed(
      withQuoteRevision(priorArtifact(staticProduct, "product-details-v1")),
    );
    const current = buildStudioLaunchArtifact(staticProduct);
    const next = revisit(previous, current);
    expect(next.details).toEqual(previous[0]!.details);
    expect(next.fingerprint).toBe(previous[0]!.fingerprint);
    expect(JSON.stringify(staticProduct)).toBe(savedState);
    expect(workHash(staticProduct)).toBe(previousWork);
    expect(designId(staticProduct.tokens)).toBe(publicId);
    expect(staticProduct.page).not.toHaveProperty("authoredQuoteRevision");
  });
});
