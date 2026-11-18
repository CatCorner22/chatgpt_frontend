export type Evidence = 'measured' | 'convention' | 'expert-opinion';
export type SourceBasis = 'read' | 'abstract' | 'snippet' | 'builder';
export interface SourceRef { title: string; url?: string; section?: string; basis: SourceBasis }
export interface RuleRecord {
  id: string;
  group: 'craft' | 'state' | 'behavior' | 'neuro' | 'floor';
  plain: string;
  why: string;
  appliesWhen?: string;
  check: { kind: 'page-check'; fn: string } | { kind: 'person'; ask: string };
  overridable: boolean;
  evidence: Evidence;
  sources: SourceRef[];
  reviewed: string;
}
export interface Finding {
  ruleId: string;
  status: 'fails' | 'holds' | 'not-applicable' | 'could-not-measure';
  where?: string;
  measured?: string;
  required?: string;
  fix?: string;
}
export type Tokens = Record<string, string>;
