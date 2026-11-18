import { z } from 'zod';
import { benchmarkManifestSchema, blindEvaluationSchema, qualityDimensionIds, type BenchmarkManifest, type BlindEvaluation } from './benchmark';

export type BenchmarkMetricState = 'within-bounds' | 'outside-bounds' | 'inconclusive' | 'unmeasured';
export interface BenchmarkMetric {
  id: string;
  label: string;
  mode: 'noninferiority' | 'equivalence' | 'minimum';
  unit: 'rating-points' | 'proportion';
  reviewers: number;
  mean: number | null;
  interval: [number, number] | null;
  bounds: [number | null, number | null];
  state: BenchmarkMetricState;
}
const mean = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

/**
 * Fixed-sample, reviewer-clustered analysis conditional on the supplied page panel.
 * Intervals use a simultaneous 95% Hoeffding bound across the 15 declared endpoints.
 * A pilot's broad interval is inconclusive, not a failed quality judgement.
 */
export function evaluateBenchmark(input: BenchmarkManifest, data: BlindEvaluation[]) {
  const manifest = benchmarkManifestSchema.parse(input);
  const evaluations = z.array(blindEvaluationSchema).parse(data);
  const samples = new Map(manifest.samples.map(sample => [sample.id, sample]));
  const byReviewer = new Map<string, Map<string, BlindEvaluation>>();
  for (const evaluation of evaluations) {
    if (evaluation.benchmarkId !== manifest.id) throw new Error('An evaluation belongs to a different benchmark.');
    const sample = samples.get(evaluation.sampleId);
    if (!sample) throw new Error(`Unknown sample ID: ${evaluation.sampleId}.`);
    if (sample.kind === 'image' && (evaluation.taskOutcome !== 'not-tested' || evaluation.quality.interaction !== null)) throw new Error('An image cannot provide observed task or interaction evidence.');
    const reviewer = byReviewer.get(evaluation.reviewerCode) ?? new Map<string, BlindEvaluation>();
    if (reviewer.has(evaluation.sampleId)) throw new Error('Each reviewer may rate a sample only once; primary ratings are immutable in this analysis.');
    reviewer.set(evaluation.sampleId, evaluation);
    byReviewer.set(evaluation.reviewerCode, reviewer);
  }
  const pairs = manifest.tasks.map(task => {
    const rows = manifest.samples.filter(sample => sample.taskId === task.id);
    const candidate = rows.find(sample => sample.group === 'spec');
    const reference = rows.find(sample => sample.group === 'human');
    return rows.length === 2 && candidate && reference ? { task, candidate, reference } : null;
  });
  const completeReviewers = manifest.samples.length > 0
    ? [...byReviewer].filter(([, rows]) => rows.size === manifest.samples.length).map(([code]) => code)
    : [];
  const incompleteReviewers = byReviewer.size - completeReviewers.length;
  const validPairs = pairs.filter(pair => pair !== null);
  const pairedFor = (reviewerCode: string) => validPairs.map(pair => ({
    pair, candidate: byReviewer.get(reviewerCode)!.get(pair.candidate.id)!, reference: byReviewer.get(reviewerCode)!.get(pair.reference.id)!,
  }));
  const allTaskPairs = validPairs.length === manifest.tasks.length;
  const endpointCount = qualityDimensionIds.length * 2 + 3;
  const alphaPerEndpoint = (1 - manifest.criteria.confidence) / endpointCount;
  const metric = (
    id: string, label: string, mode: BenchmarkMetric['mode'], unit: BenchmarkMetric['unit'],
    values: number[], range: [number, number], bounds: BenchmarkMetric['bounds'],
  ): BenchmarkMetric => {
    const estimate = mean(values);
    const radius = values.length ? (range[1] - range[0]) * Math.sqrt(Math.log(2 / alphaPerEndpoint) / (2 * values.length)) : null;
    const interval: [number, number] | null = estimate === null || radius === null ? null : [Math.max(range[0], estimate - radius), Math.min(range[1], estimate + radius)];
    let state: BenchmarkMetricState = 'unmeasured';
    if (interval) {
      const inside = (bounds[0] === null || interval[0] >= bounds[0]) && (bounds[1] === null || interval[1] <= bounds[1]);
      const outside = (bounds[0] !== null && interval[1] < bounds[0]) || (bounds[1] !== null && interval[0] > bounds[1]);
      state = inside ? 'within-bounds' : outside ? 'outside-bounds' : 'inconclusive';
    }
    return { id, label, mode, unit, reviewers: values.length, mean: estimate, interval, bounds, state };
  };
  const valuesFor = (read: (rows: ReturnType<typeof pairedFor>) => number | null) => {
    if (!allTaskPairs) return [];
    return completeReviewers.flatMap(code => { const value = read(pairedFor(code)); return value === null ? [] : [value]; });
  };
  const metrics: BenchmarkMetric[] = qualityDimensionIds.flatMap(dimension => {
    const differences = valuesFor(rows => rows.some(row => row.candidate.quality[dimension] === null || row.reference.quality[dimension] === null)
      ? null : mean(rows.map(row => row.candidate.quality[dimension]! - row.reference.quality[dimension]!)));
    const candidateValues = valuesFor(rows => rows.some(row => row.candidate.quality[dimension] === null)
      ? null : mean(rows.map(row => row.candidate.quality[dimension]!)));
    return [
      metric(`quality-${dimension}`, `${dimension}: candidate minus human reference`, 'noninferiority', 'rating-points', differences, [-6, 6], [-manifest.criteria.qualityMargin, null]),
      metric(`minimum-${dimension}`, `${dimension}: candidate absolute quality`, 'minimum', 'rating-points', candidateValues, [1, 7], [manifest.criteria.qualityFloor, null]),
    ];
  });
  const taskDifferences = valuesFor(rows => rows.some(row => row.candidate.taskOutcome === 'not-tested' || row.reference.taskOutcome === 'not-tested')
    ? null : mean(rows.map(row => Number(row.candidate.taskOutcome === 'completed') - Number(row.reference.taskOutcome === 'completed'))));
  const candidateSuccess = valuesFor(rows => rows.some(row => row.candidate.taskOutcome === 'not-tested')
    ? null : mean(rows.map(row => Number(row.candidate.taskOutcome === 'completed'))));
  const attributionDifferences = valuesFor(rows => mean(rows.map(row => Number(row.candidate.judgedOrigin === 'person') - Number(row.reference.judgedOrigin === 'person'))));
  metrics.push(
    metric('task-success-difference', 'Reported task completion: candidate minus human reference', 'noninferiority', 'proportion', taskDifferences, [-1, 1], [-manifest.criteria.taskSuccessMargin, null]),
    metric('minimum-task-success', 'Candidate reported task completion', 'minimum', 'proportion', candidateSuccess, [0, 1], [manifest.criteria.taskSuccessFloor, null]),
    metric('attribution-difference', 'Judged person-made: candidate minus human reference', 'equivalence', 'proportion', attributionDifferences, [-1, 1], [-manifest.criteria.attributionMargin, manifest.criteria.attributionMargin]),
  );
  const gates: string[] = [];
  if (manifest.status !== 'registered') gates.push('The plan is a draft; thresholds and study design have not been recorded as preregistered.');
  if (!allTaskPairs) gates.push('Every task needs one candidate and one independent human reference.');
  if (byReviewer.size !== manifest.criteria.targetReviewers) gates.push(`The fixed collection target is ${manifest.criteria.targetReviewers} reviewer codes; ${byReviewer.size} are present. Do not extend collection until a result passes.`);
  if (incompleteReviewers) gates.push(`${incompleteReviewers} reviewer records are incomplete; complete-case summaries may be biased and cannot confirm the benchmark.`);
  if (metrics.some(row => row.reviewers !== completeReviewers.length || row.state === 'unmeasured')) gates.push('At least one primary endpoint lacks evidence for the full reviewer panel.');
  const state = gates.length ? 'not-ready'
    : metrics.some(row => row.state === 'outside-bounds') ? 'outside-bounds'
      : metrics.every(row => row.state === 'within-bounds') ? 'within-bounds' : 'inconclusive';
  const taskBreakdown = validPairs.map(pair => {
    const rows = completeReviewers.map(code => ({ candidate: byReviewer.get(code)!.get(pair.candidate.id)!, reference: byReviewer.get(code)!.get(pair.reference.id)! }));
    return {
      taskId: pair.task.id, title: pair.task.title, reviewers: rows.length,
      quality: Object.fromEntries(qualityDimensionIds.map(dimension => {
        const paired = rows.filter(row => row.candidate.quality[dimension] !== null && row.reference.quality[dimension] !== null);
        return [dimension, { difference: mean(paired.map(row => row.candidate.quality[dimension]! - row.reference.quality[dimension]!)), reviewers: paired.length }];
      })),
      taskSuccess: {
        candidate: mean(rows.filter(row => row.candidate.taskOutcome !== 'not-tested').map(row => Number(row.candidate.taskOutcome === 'completed'))),
        reference: mean(rows.filter(row => row.reference.taskOutcome !== 'not-tested').map(row => Number(row.reference.taskOutcome === 'completed'))),
        candidateTested: rows.filter(row => row.candidate.taskOutcome !== 'not-tested').length,
        referenceTested: rows.filter(row => row.reference.taskOutcome !== 'not-tested').length,
      },
    };
  });
  return {
    benchmarkId: manifest.id, state, gates, metrics, taskBreakdown,
    counts: { evaluations: evaluations.length, reviewerCodes: byReviewer.size, completeReviewers: completeReviewers.length, incompleteReviewers, tasks: manifest.tasks.length, matchedTasks: validPairs.length, humanCreators: new Set(manifest.samples.filter(sample => sample.group === 'human').map(sample => sample.creatorCode)).size, unsureOriginRatings: evaluations.filter(row => row.judgedOrigin === 'unsure').length },
    method: { name: 'Reviewer-level Hoeffding intervals with Bonferroni simultaneous coverage', confidence: manifest.criteria.confidence, endpoints: endpointCount, unit: 'independent reviewer', scope: 'panel-average results conditional on these fixed tasks and artifacts' },
    statement: state === 'within-bounds'
      ? 'The simultaneous intervals fit the declared quality, task and attribution bounds for this fixed page panel, conditional on the recorded study assumptions. This does not establish universal indistinguishability.'
      : state === 'outside-bounds'
        ? 'At least one simultaneous interval lies outside its declared bound for this fixed page panel. Inspect the endpoint and individual tasks before changing the design.'
        : state === 'not-ready'
          ? 'The collection or protocol is incomplete. Available numbers are provisional descriptions, not confirmation.'
          : 'The intervals are too wide or overlap a declared bound. The evidence is inconclusive; this is not a finding that the design is poor.',
    limitations: [
      'Reviewer codes do not prove distinct independent people, honest answers, successful blinding or genuine human authorship; organizers must verify those conditions.',
      'The manifest records preregistration and artifact hashes but does not verify external registration timing or retrieve/hash the actual artifacts.',
      'Intervals assume independent reviewers, fixed sample size and no selection based on results. They cover sampling variation under those assumptions, not bias.',
      'The six quality ratings are treated as numeric scores. Their interpretation and acceptable margins must be agreed before collection.',
      'Task outcomes are reviewer reports. This tool does not independently observe task telemetry or verify that the success criterion was satisfied.',
      'Panel averages can hide weak individual tasks; task breakdowns are descriptive and do not establish task-specific equivalence.',
      'Similar person-made attribution rates do not establish perceptual indistinguishability, and unsure answers remain visible in the counts.',
      'The conservative fallback may need far more reviewers than a practical pilot; plan an external crossed reviewer/page analysis for broader confirmatory inference.',
    ],
  };
}
