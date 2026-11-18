import { z } from 'zod';

export const qualityDimensionIds = ['hierarchy', 'typography', 'composition', 'distinctiveness', 'interaction', 'content'] as const;
export type QualityDimension = typeof qualityDimensionIds[number];
export const qualityDimensions = [
  { id: 'hierarchy', title: 'Hierarchy', low: 'The main task or important information is hard to find.', middle: 'The main task is clear, with some competing emphasis.', high: 'Attention follows the task naturally and important details are easy to scan.' },
  { id: 'typography', title: 'Reading and typography', low: 'Reading is difficult or text treatments are inconsistent.', middle: 'Text is readable, with a few awkward line lengths or hierarchy choices.', high: 'Type, line lengths and emphasis support effortless reading at this viewport.' },
  { id: 'composition', title: 'Composition and detail', low: 'Spacing, alignment or responsive behavior noticeably interfere.', middle: 'The layout is coherent, with some rough details.', high: 'Spacing, alignment, imagery and responsive choices feel carefully resolved.' },
  { id: 'distinctiveness', title: 'Fit and distinctiveness', low: 'The design feels interchangeable or mismatched to the brief.', middle: 'The design suits the brief but has few memorable decisions.', high: 'Specific, restrained design decisions express this brief convincingly.' },
  { id: 'interaction', title: 'Interaction clarity', low: 'Controls, states or outcomes are confusing.', middle: 'The task is understandable, with minor friction.', high: 'Controls, feedback and recovery make the task consistently clear.' },
  { id: 'content', title: 'Content and credibility', low: 'Content is vague, incomplete or does not support the task.', middle: 'Content explains the offer or task, with a few gaps.', high: 'Specific, coherent content supports confident decisions without unsupported claims.' },
] as const;

const id = z.string().trim().min(1).max(120);
export const benchmarkTaskSchema = z.object({
  id, title: z.string().min(1).max(200), family: z.string().min(1).max(100),
  brief: z.string().min(1).max(8000), task: z.string().min(1).max(2000),
  successCriterion: z.string().min(1).max(2000),
  viewport: z.object({ width: z.number().int().min(320).max(3840), height: z.number().int().min(480).max(2160) }).strict(),
}).strict();
const dimensionSchema = z.object({ id: z.enum(qualityDimensionIds), title: z.string(), low: z.string(), middle: z.string(), high: z.string() }).strict();
export const reviewerPacketSchema = z.object({
  version: z.literal(1), benchmarkId: id, title: z.string().min(1), instructions: z.string().min(1),
  tasks: z.array(benchmarkTaskSchema).min(1),
  samples: z.array(z.object({ id, taskId: id, label: z.string().min(1), assetRef: z.string().min(1), kind: z.enum(['interactive', 'image']) }).strict()).min(2),
  dimensions: z.array(dimensionSchema).length(6),
}).strict().superRefine((packet, ctx) => {
  if (new Set(packet.samples.map(sample => sample.id)).size !== packet.samples.length) ctx.addIssue({ code: 'custom', path: ['samples'], message: 'Sample IDs must be unique.' });
  if (new Set(packet.tasks.map(task => task.id)).size !== packet.tasks.length) ctx.addIssue({ code: 'custom', path: ['tasks'], message: 'Task IDs must be unique.' });
  if (new Set(packet.dimensions.map(dimension => dimension.id)).size !== 6) ctx.addIssue({ code: 'custom', path: ['dimensions'], message: 'Include each quality dimension once.' });
  for (const sample of packet.samples) if (!packet.tasks.some(task => task.id === sample.taskId)) ctx.addIssue({ code: 'custom', path: ['samples'], message: 'Every sample must reference a declared task.' });
  const sourceCue = /(?:^|[^a-z])(?:ai|human|generated|candidate|reference|baseline|spec)(?:$|[^a-z])/i;
  for (const [index, sample] of packet.samples.entries()) {
    for (const field of ['id', 'label', 'assetRef'] as const) {
      let visible = sample[field];
      try { visible = decodeURIComponent(visible); } catch { /* Keep malformed text as data. */ }
      if (sourceCue.test(visible)) ctx.addIssue({ code: 'custom', path: ['samples', index, field], message: 'Use a neutral sample identifier, label and asset location that do not reveal source group. Also inspect the actual asset for clues.' });
    }
  }
});
export type ReviewerPacket = z.infer<typeof reviewerPacketSchema>;

const rating = z.number().int().min(1).max(7);
export const blindEvaluationSchema = z.object({
  benchmarkId: id, reviewerCode: id, sampleId: id,
  taskOutcome: z.enum(['completed', 'blocked', 'not-tested']),
  judgedOrigin: z.enum(['person', 'generated', 'unsure']),
  quality: z.object({ hierarchy: rating, typography: rating, composition: rating, distinctiveness: rating, interaction: rating.nullable(), content: rating }).strict(),
  note: z.string().max(4000).default(''),
}).strict();
export type BlindEvaluation = z.infer<typeof blindEvaluationSchema>;

export const blindEvaluationBundleSchema = z.object({
  version: z.literal(1), benchmarkId: id, evaluations: z.array(blindEvaluationSchema),
}).strict().superRefine((bundle, ctx) => {
  if (bundle.evaluations.some(evaluation => evaluation.benchmarkId !== bundle.benchmarkId)) {
    ctx.addIssue({ code: 'custom', path: ['evaluations'], message: 'Every answer must belong to this benchmark.' });
  }
  const keys = bundle.evaluations.map(evaluation => JSON.stringify([evaluation.reviewerCode, evaluation.sampleId]));
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['evaluations'], message: 'A reviewer may submit only one answer per sample.' });
});
export type BlindEvaluationBundle = z.infer<typeof blindEvaluationBundleSchema>;
