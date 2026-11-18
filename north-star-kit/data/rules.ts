import type { RuleRecord } from '../types';
import { neuroRules } from './neuro';
import { behaviorRules, stateRules } from './states';
import { craftRules } from './craft';
import { tellRules } from './tells';

export const allRules: RuleRecord[] = [...neuroRules, ...stateRules, ...behaviorRules, ...craftRules, ...tellRules];
export const RULES = allRules;
