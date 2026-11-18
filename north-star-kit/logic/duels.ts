import { z } from 'zod';

const decisionsSchema = z.record(z.string().min(1), z.string().min(1));
export type Decisions = Record<string, string>;
export interface DuelResult { a: Decisions; b: Decisions; choice: 'a' | 'b' | 'tie' }

/** One decision changes; both designs must contain exactly the same decision keys. */
export function validateDuel(first: Decisions, second: Decisions) {
  const a = decisionsSchema.parse(first);
  const b = decisionsSchema.parse(second);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const differences = keys.filter(key => a[key] !== b[key]);
  const sameKeys = keys.every(key => Object.hasOwn(a, key) && Object.hasOwn(b, key));
  const valid = sameKeys && differences.length === 1;
  return {
    valid, decision: valid ? differences[0]! : null, differences,
    reason: valid ? 'Exactly one decision differs.' : !sameKeys ? 'Both designs need the same decisions.' : 'A comparison must change exactly one decision.',
  };
}

/** Counts observed choices, including ties; this does not infer a population preference. */
export function preferences(history: DuelResult[]) {
  const decisions = new Map<string, { comparisons: number; ties: number; choices: Map<string, { wins: number; exposures: number; decisiveExposures: number }> }>();
  for (const result of history) {
    const duel = validateDuel(result.a, result.b);
    if (!duel.valid || !duel.decision) throw new Error(duel.reason);
    if (!['a', 'b', 'tie'].includes(result.choice)) throw new TypeError('A result must choose a, b, or tie.');
    const decision = duel.decision;
    const row = decisions.get(decision) ?? { comparisons: 0, ties: 0, choices: new Map() };
    row.comparisons++;
    if (result.choice === 'tie') row.ties++;
    for (const side of ['a', 'b'] as const) {
      const value = result[side][decision]!;
      const choice = row.choices.get(value) ?? { wins: 0, exposures: 0, decisiveExposures: 0 };
      choice.exposures++;
      if (result.choice !== 'tie') choice.decisiveExposures++;
      if (result.choice === side) choice.wins++;
      row.choices.set(value, choice);
    }
    decisions.set(decision, row);
  }
  return [...decisions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([decision, row]) => ({
    decision, comparisons: row.comparisons, ties: row.ties,
    choices: [...row.choices.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, choice]) => ({
      value, ...choice, winRate: choice.decisiveExposures ? choice.wins / choice.decisiveExposures : null,
    })),
  }));
}
