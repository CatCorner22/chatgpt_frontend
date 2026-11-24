import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchPanel } from "@/components/LaunchPanel";
import { getAuthoredFeatures } from "@/lib/authored-content";
import { buildStudioLaunchArtifact } from "@/lib/studio-launch-artifact";
import { normalizeTokens, type Content } from "@/lib/design";
import { EMPTY, type State } from "@/lib/studio-state";
import { workHash } from "@/lib/ux";
import { styleEvidence } from "@/lib/transfer";
import { critiqueUrl } from "@/lib/critic.functions";
import {
  EMPTY_LAUNCH,
  TASKS,
  addEvidence,
  designId,
  launchFingerprint,
  markLaunched,
  readProgress,
  upsertProgress,
  writeProgress,
  type ReviewEvidence,
} from "@/lib/launch";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/progress">{children}</a>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/useSession", () => ({ useUser: () => null }));
vi.mock("@/lib/critic.functions", () => ({ critiqueUrl: vi.fn() }));
vi.mock("@/lib/launch.functions", () => ({ saveProgress: vi.fn() }));
vi.mock("@/components/ShotReview", () => ({ ShotReview: () => null }));
vi.mock("@/components/FixList", () => ({ FixList: () => null }));

const tokens = normalizeTokens({
  headingFont: "Instrument Serif",
  bg: "#f7fbff",
  accent: "#245cd6",
});
const state: State = {
  ...EMPTY,
  stage: "rx",
  libraryId: "authored-content-flow",
  tokens,
  content: {
    brand: "River",
    headline: "A quiet collection",
    sub: "One supporting sentence.",
    cta: "",
    quote: "",
    features: [],
  },
  purpose: { ...EMPTY.purpose, experience: "website" },
};
const oldArtifact = (s: State) => ({
  content: s.content,
  page: s.page,
  experience: s.purpose.experience,
  nav: s.nav,
});
const evidence: ReviewEvidence = {
  kind: "page",
  target: "https://example.com/",
  at: "2026-11-18T00:00:00Z",
  score: 100,
  summary: "Owned test fixture: review of the earlier authored output.",
  checks: [{ name: "phone", ok: true, detail: "Fixture check", fix: "" }],
  prescription: [],
  priorities: [],
  repair: "",
};
type CritiqueResult = Awaited<ReturnType<typeof critiqueUrl>>;
const successfulCritique: CritiqueResult = {
  host: "example.com",
  score: 100,
  findings: [
    {
      id: "phone",
      area: "Accessibility",
      ok: true,
      severity: "low",
      detail: "Owned fixture check",
      fix: "",
    },
  ],
  facts: {
    fonts: [tokens.headingFont, tokens.bodyFont],
    colors: [tokens.bg, tokens.ink, tokens.accent],
    words: 100,
    title: "River",
    focusId: null,
    style: styleEvidence(""),
    stamp: null,
  },
  review: { verdict: "Successful owned-fixture critique response", strengths: [], priorities: [] },
  source: { url: evidence.target, excerpt: "Owned fixture content", content: state.content! },
  inventory: {
    url: evidence.target,
    links: [],
    forms: [],
    fields: [],
    buttons: [],
    completeness: "complete",
    truncated: [],
  },
};
function reviewed(artifact: unknown = oldArtifact(state)) {
  const records = upsertProgress(
    [],
    state.libraryId!,
    "River",
    tokens,
    "2026-11-18T00:00:00Z",
    artifact,
  );
  records[0]!.details = markLaunched(
    {
      ...addEvidence(EMPTY_LAUNCH, evidence),
      url: evidence.target,
      tasks: TASKS.map((task) => task.id),
    },
    "2026-11-18T00:00:00Z",
  );
  return records;
}
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("authored content-flow evidence boundary", () => {
  it("requires a fresh review only for authored pages that gained an embedded font", () => {
    const newPair = normalizeTokens({ headingFont: "Outfit", bodyFont: "DM Sans" });
    const input = { ...state, tokens: newPair };
    const before = { ...oldArtifact(input), authoredOutputRevision: "content-flow-v1" };
    const after = buildStudioLaunchArtifact(input);
    expect(after).toEqual({ ...before, authoredFontRevision: "gallery-type-v1" });
    expect(launchFingerprint(newPair, before)).not.toEqual(launchFingerprint(newPair, after));
    for (const unaffected of [
      { ...input, integration: "existing" as const },
      { ...input, purpose: { ...input.purpose, experience: "app" as const } },
      { ...input, content: null },
      { ...input, tokens: null },
      state,
    ]) {
      expect(buildStudioLaunchArtifact(unaffected)).not.toHaveProperty("authoredFontRevision");
    }
    expect(
      buildStudioLaunchArtifact({ ...input, tokens: { ...tokens, bodyFont: "Inter" } }),
    ).toHaveProperty("authoredFontRevision", "gallery-type-v1");
  });

  it("invalidates earlier output evidence for unchanged authored inputs with no visible features", () => {
    const old = reviewed();
    const current = buildStudioLaunchArtifact(state);
    const records = upsertProgress(
      old,
      state.libraryId!,
      "River",
      tokens,
      "2026-11-18T01:00:00Z",
      current,
    );
    expect(records[0]!.details).toEqual(EMPTY_LAUNCH);
    expect(records[0]!.completedAt).toBe(old[0]!.completedAt);
    expect(current).toHaveProperty("authoredOutputRevision", "content-flow-v1");
    expect(records[0]!.fingerprint).not.toBe(old[0]!.fingerprint);
  });

  it("retains evidence for the same revised output without mutating stored state or saved-work identity", () => {
    const before = JSON.stringify(state);
    const work = workHash(state);
    const publicId = designId(tokens);
    const current = buildStudioLaunchArtifact(state);
    const previous = reviewed(current);
    const next = upsertProgress(
      previous,
      state.libraryId!,
      "River",
      tokens,
      "2026-11-18T01:00:00Z",
      current,
    );
    expect(next[0]!.details).toEqual(previous[0]!.details);
    expect(next[0]!.fingerprint).toBe(previous[0]!.fingerprint);
    expect(JSON.stringify(state)).toBe(before);
    expect(workHash(state)).toBe(work);
    expect(designId(tokens)).toBe(publicId);
    expect(state).not.toHaveProperty("authoredOutputRevision");
    expect(state.page).not.toHaveProperty("authoredOutputRevision");
  });

  it.each([
    { ...state, integration: "existing" as const },
    { ...state, purpose: { ...state.purpose, experience: "app" as const } },
    { ...state, content: { ...state.content!, features: [{ title: "A piece", body: "" }] } },
    { ...state, content: { ...state.content!, features: [{ title: "", body: "A description" }] } },
  ])("keeps the exact legacy evidence artifact for unaffected work %#", (unaffected) => {
    const current = buildStudioLaunchArtifact(unaffected);
    expect(current).toEqual(oldArtifact(unaffected));
    expect(JSON.stringify(current)).toBe(JSON.stringify(oldArtifact(unaffected)));
    expect(launchFingerprint(tokens, current)).toBe(
      launchFingerprint(tokens, oldArtifact(unaffected)),
    );
    const prior = reviewed(current);
    expect(
      upsertProgress(prior, state.libraryId!, "River", tokens, "2026-11-18T01:00:00Z", current)[0]!
        .details,
    ).toEqual(prior[0]!.details);
  });

  it("shares the renderer's trimmed feature predicate without modifying its content", () => {
    const title = { title: "  A piece  ", body: "" };
    const body = { title: "", body: "  A description  " };
    const features: Content["features"] = [{ title: " \n", body: "\t" }, title, body];
    const original = JSON.stringify(features);
    expect(getAuthoredFeatures(features)).toEqual([title, body]);
    expect(getAuthoredFeatures(features)[0]).toBe(title);
    expect(JSON.stringify(features)).toBe(original);
    const blank = { ...state, content: { ...state.content!, features: [features[0]!] } };
    expect(buildStudioLaunchArtifact(blank)).toHaveProperty(
      "authoredOutputRevision",
      "content-flow-v1",
    );
    expect(getAuthoredFeatures(undefined as unknown as Content["features"])).toEqual([]);
    expect(
      getAuthoredFeatures([null, { title: 42, body: false }] as unknown as Content["features"]),
    ).toEqual([]);
  });

  it("discards a pending earlier-output review when the runtime renderer identity changes", async () => {
    writeProgress(reviewed());
    let finish!: (value: CritiqueResult) => void;
    vi.mocked(critiqueUrl).mockImplementation(
      () =>
        new Promise<CritiqueResult>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(
      <LaunchPanel
        id={state.libraryId!}
        title="River"
        tokens={tokens}
        tool="Human developer"
        artifact={oldArtifact(state)}
      />,
    );
    expect(await screen.findByRole("button", { name: "Launch recorded" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Review built page" }));
    expect(critiqueUrl).toHaveBeenCalledOnce();
    view.rerender(
      <LaunchPanel
        id={state.libraryId!}
        title="River"
        tokens={tokens}
        tool="Human developer"
        artifact={buildStudioLaunchArtifact(state)}
      />,
    );
    await waitFor(() => expect(readProgress()[0]!.details).toEqual(EMPTY_LAUNCH));
    await act(async () => {
      finish(successfulCritique);
    });
    expect(readProgress()[0]!.details).toEqual(EMPTY_LAUNCH);
    expect(screen.queryByText(evidence.summary)).not.toBeInTheDocument();
    expect(screen.queryByText(successfulCritique.review!.verdict)).not.toBeInTheDocument();
    expect(readProgress()[0]!.fingerprint).toBe(
      launchFingerprint(tokens, buildStudioLaunchArtifact(state)),
    );
  });

  it("records that same successful critique response when the output identity stays current", async () => {
    const current = buildStudioLaunchArtifact(state);
    writeProgress(reviewed(current));
    vi.mocked(critiqueUrl).mockResolvedValue(successfulCritique);
    render(
      <LaunchPanel
        id={state.libraryId!}
        title="River"
        tokens={tokens}
        tool="Human developer"
        artifact={current}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Review built page" }));
    expect(await screen.findByText(successfulCritique.review!.verdict)).toBeInTheDocument();
    const saved = readProgress()[0]!;
    expect(saved.fingerprint).toBe(launchFingerprint(tokens, current));
    expect(saved.details.status).toBe("reviewed");
    expect(saved.details.reviews).toHaveLength(2);
    expect(saved.details.reviews.at(-1)).toMatchObject({
      target: evidence.target,
      summary: successfulCritique.review!.verdict,
      checks: [{ name: "phone", ok: true, detail: "Owned fixture check", fix: "" }],
    });
    expect(saved.details.tasks).toEqual([]);
    expect(saved.details.launchedAt).toBeNull();
  });
});
