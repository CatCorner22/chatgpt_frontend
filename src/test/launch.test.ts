import { describe, expect, it } from "vitest";
import {
  EMPTY_LAUNCH,
  TASKS,
  addEvidence,
  canLaunch,
  evidenceChange,
  launchFingerprint,
  designFingerprint,
  designId,
  markLaunched,
  parseDetails,
  upsertProgress,
  weeklyTotals,
  type ReviewEvidence,
} from "@/lib/launch";
import { GALLERY } from "@/lib/gallery";
const tokens = GALLERY[0]?.direction.tokens;
if (!tokens) throw new Error("Missing tokens");
const review: ReviewEvidence = {
  kind: "page",
  target: "https://example.com/",
  at: "2026-11-17T01:00:00Z",
  score: 65,
  summary: "Measured findings",
  checks: [{ name: "phone", ok: false, detail: "Phone setting absent", fix: "Add viewport" }],
  prescription: [],
  priorities: [],
  repair: "Add viewport",
};
const passingReview: ReviewEvidence = {
  ...review,
  score: 100,
  checks: [{ name: "phone", ok: true, detail: "Phone setting present", fix: "" }],
  repair: "",
};

describe("launch readiness safeguards", () => {
  const details = (reviews: ReviewEvidence[], url = "https://example.com") => ({
    ...EMPTY_LAUNCH,
    url,
    reviews,
    tasks: TASKS.map((task) => task.id),
  });

  it("refuses a known measured failure even after every owner confirmation", () => {
    const failed = details([{ ...review, score: 100 }]);
    expect(canLaunch(failed)).toBe(false);
    expect(() => markLaunched(failed, "2026-11-18T00:00:00Z")).toThrow();
  });

  it("refuses an unresolved design mismatch from the current page review", () => {
    expect(
      canLaunch(details([{ ...passingReview, prescription: [{ name: "fonts", ok: false }] }])),
    ).toBe(false);
  });

  it.each([
    "https://other.example/",
    "https://example.com/other",
    "https://example.com/?view=other",
    "https://example.com/#other",
  ])("does not apply reviews of %s to the current built address", (target) =>
    expect(canLaunch(details([{ ...passingReview, target }]))).toBe(false),
  );

  it("does not treat screenshot opinion or an empty review as measured URL evidence", () => {
    expect(canLaunch(details([{ ...passingReview, kind: "screenshot", score: null }]))).toBe(false);
    expect(
      canLaunch(
        details([{ ...passingReview, checks: [], prescription: [{ name: "fonts", ok: true }] }]),
      ),
    ).toBe(false);
  });

  it("keeps a prior failure open when a later partial review omits it", () => {
    const partial = {
      ...passingReview,
      checks: [{ name: "headings", ok: true, detail: "One heading", fix: "" }],
    };
    expect(canLaunch(details([review, partial]))).toBe(false);
    expect(canLaunch(details([review, partial, passingReview]))).toBe(true);
  });

  it("cannot hide an unresolved current-page failure behind another page or screenshot", () => {
    expect(
      canLaunch(details([review, { ...passingReview, target: "https://other.example/" }])),
    ).toBe(false);
    expect(
      canLaunch(details([review, { ...passingReview, kind: "screenshot", score: null }])),
    ).toBe(false);
  });

  it("accepts equivalent canonical URLs without mixing failures from unrelated pages", () => {
    expect(
      canLaunch(
        details(
          [{ ...review, target: "https://other.example/" }, passingReview],
          "https://EXAMPLE.com:443",
        ),
      ),
    ).toBe(true);
  });

  it("preserves historical launch records when their prior evidence would no longer qualify", () => {
    const historical = {
      ...details([review]),
      status: "launched",
      launchedAt: "2026-11-17T00:00:00Z",
    };
    const parsed = parseDetails(historical);
    expect(parsed).toEqual(historical);
    expect(canLaunch(parsed)).toBe(false);
    expect(parsed.status).toBe("launched");
    expect(parsed.launchedAt).toBe(historical.launchedAt);
  });

  it("keeps explicitly possible findings advisory while still requiring measured checks", () => {
    const advisory = {
      name: "interruption",
      ok: false,
      detail: "Possible cookie dialog",
      fix: "Review it",
      possible: true,
    };
    expect(
      canLaunch(details([{ ...passingReview, checks: [...passingReview.checks, advisory] }])),
    ).toBe(true);
    expect(canLaunch(details([{ ...passingReview, checks: [advisory] }]))).toBe(false);
  });

  it("requires a fresh classification before treating an old unflagged finding as advisory", () => {
    const old = {
      ...passingReview,
      checks: [
        ...passingReview.checks,
        { name: "interruption", ok: false, detail: "Possible dialog", fix: "Review it" },
      ],
    };
    const fresh = {
      ...passingReview,
      checks: [...passingReview.checks, { ...old.checks[1]!, possible: true }],
    };
    expect(canLaunch(details([old]))).toBe(false);
    expect(canLaunch(details([old, fresh]))).toBe(true);
    expect(old.checks[1]!.ok).toBe(false);
  });
});
describe("launch evidence", () => {
  const artifact = {
    content: {
      brand: "Clay House",
      headline: "Made for everyday rituals.",
      features: [{ title: "Classes", body: "Small groups." }],
    },
    page: {
      composition: "studio",
      actionUrl: "https://example.com/book",
      imageId: "a".repeat(64),
      imageAlt: "A handmade cup",
    },
    experience: "website",
    nav: "top-menu",
  };
  const withLaunch = (art?: unknown) => {
    const list = upsertProgress([], "a", "Clay House", tokens, "2026-11-17T01:00:00Z", art);
    return list.map((record) => ({
      ...record,
      details: markLaunched(
        {
          ...addEvidence(EMPTY_LAUNCH, passingReview),
          url: "https://example.com",
          tasks: TASKS.map((task) => task.id),
        },
        "2026-11-17T02:00:00Z",
      ),
    }));
  };
  it("invalidates old token-only evidence once when the full artifact is supplied", () => {
    const legacy = withLaunch();
    expect(legacy[0]?.fingerprint).toBe(designFingerprint(tokens));
    const migrated = upsertProgress(
      legacy,
      "a",
      "Clay House",
      tokens,
      "2026-11-18T01:00:00Z",
      artifact,
    );
    expect(migrated[0]?.details).toEqual(EMPTY_LAUNCH);
    expect(migrated[0]?.completedAt).toBe(legacy[0]?.completedAt);
    const verified = withLaunch(artifact);
    const same = upsertProgress(
      verified,
      "a",
      "Clay House",
      tokens,
      "2026-11-18T01:00:00Z",
      artifact,
    );
    expect(same[0]?.details.status).toBe("launched");
  });
  it("invalidates confirmations for content, layout, destination, image, description, or navigation changes", () => {
    const launched = withLaunch(artifact);
    const changes = [
      { ...artifact, content: { ...artifact.content, headline: "A different offer." } },
      { ...artifact, page: { ...artifact.page, composition: "editorial" } },
      { ...artifact, page: { ...artifact.page, actionUrl: "https://example.com/other" } },
      { ...artifact, page: { ...artifact.page, imageId: "b".repeat(64) } },
      { ...artifact, page: { ...artifact.page, imageAlt: "A ceramic bowl" } },
      { ...artifact, nav: "bottom-tabs" },
      { ...artifact, experience: "app" },
    ];
    for (const changed of changes) {
      const next = upsertProgress(
        launched,
        "a",
        "Clay House",
        tokens,
        "2026-11-18T01:00:00Z",
        changed,
      )[0]!;
      expect(next.details.status).toBe("ready");
      expect(next.details.reviews).toEqual([]);
      expect(next.details.tasks).toEqual([]);
      expect(next.details.launchedAt).toBeNull();
    }
  });
  it("uses canonical bounded artifact identity without changing the public token design ID", () => {
    const reordered = {
      nav: artifact.nav,
      experience: artifact.experience,
      page: {
        imageAlt: artifact.page.imageAlt,
        imageId: artifact.page.imageId,
        actionUrl: artifact.page.actionUrl,
        composition: artifact.page.composition,
      },
      content: {
        features: artifact.content.features,
        headline: artifact.content.headline,
        brand: artifact.content.brand,
      },
    };
    expect(launchFingerprint(tokens, reordered)).toBe(launchFingerprint(tokens, artifact));
    const before = designId(tokens);
    expect(launchFingerprint(tokens, { content: "a".repeat(10_000) }).length).toBeLessThan(3000);
    expect(designId(tokens)).toBe(before);
    expect(launchFingerprint(tokens)).toBe(designFingerprint(tokens));
  });
  it("completion counts once for the same design, even after edits", () => {
    const a = upsertProgress([], "a", "Gothic", tokens, "2026-11-17T01:00:00Z");
    const b = upsertProgress(
      a,
      "a",
      "Gothic changed",
      { ...tokens, radius: 20 },
      "2026-11-18T01:00:00Z",
    );
    expect(b).toHaveLength(1);
    expect(b[0]?.completedAt).toBe("2026-11-17T01:00:00Z");
  });
  it("launch requires a public address, actual review and all four confirmations", () => {
    const d = {
      ...addEvidence(EMPTY_LAUNCH, passingReview),
      url: "https://example.com",
      tasks: TASKS.map((t) => t.id),
    };
    expect(canLaunch(d)).toBe(true);
    expect(canLaunch({ ...d, tasks: d.tasks.slice(1) })).toBe(false);
    expect(canLaunch({ ...d, reviews: [] })).toBe(false);
    expect(canLaunch({ ...d, url: "http://localhost" })).toBe(false);
  });
  it("new reviews invalidate earlier task and launch confirmations", () => {
    const d = markLaunched(
      {
        ...addEvidence(EMPTY_LAUNCH, passingReview),
        url: "https://example.com",
        tasks: TASKS.map((t) => t.id),
      },
      "2026-11-17T02:00:00Z",
    );
    expect(addEvidence(d, review).launchedAt).toBeNull();
    expect(addEvidence(d, review).tasks).toEqual([]);
  });
  it("before/after evidence only compares the same target and evidence kind", () => {
    expect(
      evidenceChange([
        review,
        {
          ...review,
          score: 80,
          checks: [{ ...review.checks[0], name: "phone", ok: true, detail: "Fixed", fix: "" }],
        },
      ]),
    ).toEqual({ resolved: 1, newIssues: 0, scoreDelta: 15 });
    expect(evidenceChange([review, { ...review, target: "https://other.com" }])).toBeNull();
  });
  it("screenshot opinion cannot acquire a measured score by implication", () => {
    const d = addEvidence(EMPTY_LAUNCH, { ...review, kind: "screenshot", score: null });
    expect(d.reviews[0]?.score).toBeNull();
  });
  it("weekly counts use the UTC Monday period", () => {
    const list = upsertProgress([], "a", "Gothic", tokens, "2026-11-15T23:59:00Z");
    expect(weeklyTotals(list, "2026-11-17T01:00:00Z").completed).toBe(0);
    expect(
      weeklyTotals(
        upsertProgress(list, "b", "Plush", tokens, "2026-11-16T00:00:00Z"),
        "2026-11-17T01:00:00Z",
      ).completed,
    ).toBe(1);
  });
  it("corrupt launch data defaults safely", () => {
    expect(parseDetails({ status: "launched" }).status).toBe("ready");
  });
});

import { fixPlan, fixMessage } from "@/lib/launch";
describe("fix until it passes", () => {
  const base = {
    kind: "page" as const,
    target: "https://a.com/",
    summary: "",
    priorities: [],
    repair: "",
  };
  const r1 = {
    ...base,
    at: "2026-11-17T00:00:00.000Z",
    score: 60,
    checks: [
      { name: "alt", ok: false, detail: "Images lack descriptions", fix: "Add alt text" },
      { name: "h1", ok: false, detail: "No main heading", fix: "Add one h1" },
    ],
    prescription: [{ name: "fonts", ok: false }],
  };
  const r2 = {
    ...r1,
    at: "2026-11-17T01:00:00.000Z",
    score: 80,
    checks: [{ ...r1.checks[0]!, ok: true }, r1.checks[1]!],
    prescription: [{ name: "fonts", ok: true }],
  };
  const r3 = {
    ...r2,
    at: "2026-11-17T02:00:00.000Z",
    score: 100,
    checks: r2.checks.map((c) => ({ ...c, ok: true })),
  };
  it("lists design mismatches first, then measured problems", () => {
    const p = fixPlan([r1] as never)!;
    expect(p.still.map((s) => s.key)).toEqual(["rx:fonts", "m:alt", "m:h1"]);
    expect(p.round).toBe(1);
  });
  it("shows what got fixed since the previous check of the same page", () => {
    const p = fixPlan([r1, r2] as never)!;
    expect(p.fixed.sort()).toEqual(["alt", "fonts"]);
    expect(p.still.map((s) => s.key)).toEqual(["m:h1"]);
    expect(p.round).toBe(2);
  });
  it("passes only when nothing measured still fails", () => {
    expect(fixPlan([r1, r2] as never)!.passed).toBe(false);
    expect(fixPlan([r1, r2, r3] as never)!.passed).toBe(true);
  });
  it("keeps omitted failures open across partial rounds until explicitly rechecked", () => {
    const omitted = { ...r2, checks: [], prescription: [] };
    const plan = fixPlan([r1, omitted, omitted])!;
    expect(plan.fixed).toEqual([]);
    expect(plan.passed).toBe(false);
    expect(plan.still.map((item) => item.key)).toEqual(["rx:fonts", "m:alt", "m:h1"]);
    expect(plan.still.every((item) => item.title.startsWith("Not rechecked:"))).toBe(true);
    const verified = fixPlan([r1, omitted, r3])!;
    expect(verified.fixed.sort()).toEqual(["alt", "fonts", "h1"]);
    expect(verified.passed).toBe(true);
  });
  it("does not pass an empty initial review or inherit failures from another page", () => {
    expect(fixPlan([{ ...r1, checks: [], prescription: [] }])!.passed).toBe(false);
    const other = { ...r3, target: "https://different.example/" };
    expect(fixPlan([r1, other])!.still).toEqual([]);
    expect(fixPlan([r1, other])!.fixed).toEqual([]);
  });
  it("fix message keeps the owner's content", () => {
    expect(fixMessage("Lovable", "Shop", fixPlan([r1] as never)!.still[1]!)).toContain(
      "keep all words, prices",
    );
  });
});
