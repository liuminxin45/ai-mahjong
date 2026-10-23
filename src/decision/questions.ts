import bank from './bank.json' with { type: 'json' };
import experience from '../experience/questions.json' with { type: 'json' };
import type { AnalysisResult, HandContext, TileId } from '../engine/index.js';
import type { DecisionCertificate, DrawConditions } from './solver.js';
import type { SkillId } from './curriculum.js';
import type { FinishExample } from './example.js';
export type DecisionQuestion = { id: string; level: number; skill: SkillId; pool: 'practice' | 'transfer' | 'example'; family: string; context: HandContext; model: DrawConditions; certificate: DecisionCertificate; shape: Pick<AnalysisResult,'normal'|'sevenPairs'|'shanten'|'discards'>; finish?: FinishExample; note: string; groups: TileId[][]; hash: string };
export const legacyDecisionQuestions = bank as DecisionQuestion[];
export const decisionQuestions = [...legacyDecisionQuestions, ...experience] as DecisionQuestion[];
const registry = new Map(decisionQuestions.map(q => [q.id, q]));
export function decisionQuestion(id: string): DecisionQuestion { const q = registry.get(id); if (!q) throw new Error('题目的版本或编号不存在。'); return q; }
