import { z } from "zod";

export const blindAnswerSchema = z.object({
  reviewerId: z.string().min(1),
  pageId: z.string().min(1),
  group: z.enum(["spec", "human"]),
  judgedHuman: z.boolean(),
  quality: z.number().int().min(1).max(7),
});
export type BlindAnswer = z.infer<typeof blindAnswerSchema>;

/**
 * A conservative reviewer-level interval conditional on the pages shown. Repeated
 * ratings by one reviewer are aggregated before uncertainty is computed; they are
 * never treated as independent participants. Page-population inference is not made.
 */
export function scoreBlindTest(input: BlindAnswer[]) {
  const answers = z.array(blindAnswerSchema).parse(input);
  const seen = new Set<string>();
  for (const answer of answers) {
    const key = JSON.stringify([answer.reviewerId, answer.pageId]);
    if (seen.has(key)) throw new Error("Each reviewer may rate each page only once.");
    seen.add(key);
  }
  const pages = new Map<string, BlindAnswer["group"]>();
  for (const answer of answers) {
    if (pages.has(answer.pageId) && pages.get(answer.pageId) !== answer.group)
      throw new Error("A page cannot belong to both groups.");
    pages.set(answer.pageId, answer.group);
  }
  const reviewerShares = (group: BlindAnswer["group"]) => {
    const byReviewer = new Map<string, number[]>();
    for (const answer of answers.filter((row) => row.group === group)) {
      byReviewer.set(answer.reviewerId, [
        ...(byReviewer.get(answer.reviewerId) ?? []),
        Number(answer.judgedHuman),
      ]);
    }
    return new Map(
      [...byReviewer].map(([id, values]) => [
        id,
        values.reduce((a, b) => a + b, 0) / values.length,
      ]),
    );
  };
  const specShares = reviewerShares("spec");
  const humanShares = reviewerShares("human");
  const summarize = (group: BlindAnswer["group"], shares: Map<string, number>) => {
    const rows = answers.filter((row) => row.group === group);
    const reviewers = shares.size;
    const judgedHuman = rows.filter((row) => row.judgedHuman).length;
    const mean = reviewers ? [...shares.values()].reduce((a, b) => a + b, 0) / reviewers : null;
    const radius = reviewers ? Math.sqrt(Math.log(40) / (2 * reviewers)) : 1;
    return {
      total: rows.length,
      reviewers,
      judgedHuman,
      shareJudgedHuman: rows.length ? judgedHuman / rows.length : null,
      reviewerWeightedShare: mean,
      reviewerInterval95:
        mean === null
          ? null
          : ([Math.max(0, mean - radius), Math.min(1, mean + radius)] as [number, number]),
      meanQuality: rows.length
        ? rows.reduce((total, row) => total + row.quality, 0) / rows.length
        : null,
    };
  };
  const paired = [...specShares].flatMap(([id, share]) =>
    humanShares.has(id) ? [share - humanShares.get(id)!] : [],
  );
  const difference = paired.length ? paired.reduce((a, b) => a + b, 0) / paired.length : null;
  const radius = paired.length ? Math.sqrt((2 * Math.log(40)) / paired.length) : 2;
  const interval =
    difference === null
      ? null
      : ([Math.max(-1, difference - radius), Math.min(1, difference + radius)] as [number, number]);
  const differs = interval === null ? null : interval[0] > 0 || interval[1] < 0;
  return {
    groups: { spec: summarize("spec", specShares), human: summarize("human", humanShares) },
    comparison: { pairedReviewers: paired.length, difference, interval95: interval, differs },
    statement:
      interval === null
        ? "No paired reviewer evidence is available for a group comparison."
        : differs
          ? "The reviewer-level interval excludes zero for the pages shown, under the stated independence assumptions."
          : "The evidence does not establish a difference. This is not evidence that the groups are equivalent.",
    limitations:
      "Hoeffding intervals use independent reviewers and are conditional on the supplied pages. They do not establish general performance across pages, absence of bias, or equivalence. Quality ratings are descriptive.",
  };
}
