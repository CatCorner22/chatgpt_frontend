import type { Finding, RuleRecord } from '../types';

export const requiredPersonChecks = [
  'Read the content aloud and check that it is clear and natural.',
  'Confirm that the content, contact details, and evidence are true.',
  'Complete the main task with a screen reader.',
  'Test the main task with the intended neurodivergent users.',
];

/** Keeps measurements, measurement gaps, and human judgement in separate lists. */
export function receipt(findings: Finding[], rules: RuleRecord[] = []) {
  const name = (id: string) => rules.find(rule => rule.id === id)?.plain ?? id;
  const measured = findings.filter(finding => finding.status === 'holds' || finding.status === 'fails').map(finding => ({
    ruleId: finding.ruleId, check: name(finding.ruleId), status: finding.status,
    where: finding.where ?? 'Page', value: finding.measured ?? 'No value supplied by this check',
    required: finding.required ?? 'See the rule',
  }));
  const couldNotMeasure = findings.filter(finding => finding.status === 'could-not-measure' || finding.status === 'not-applicable').map(finding => ({
    ruleId: finding.ruleId, check: name(finding.ruleId), status: finding.status,
    why: finding.measured ?? (finding.status === 'not-applicable' ? 'This check does not apply to the inspected content.' : 'The check could not obtain evidence.'),
  }));
  for (const rule of rules) {
    if (rule.check.kind === 'page-check' && !findings.some(finding => finding.ruleId === rule.id)) {
      couldNotMeasure.push({ ruleId: rule.id, check: rule.plain, status: 'could-not-measure', why: 'This check was not run.' });
    }
  }
  const personChecks = [...new Set([
    ...rules.flatMap(rule => rule.check.kind === 'person' ? [rule.check.ask] : []),
    ...requiredPersonChecks,
  ])];
  return { measured, couldNotMeasure, personChecks };
}
