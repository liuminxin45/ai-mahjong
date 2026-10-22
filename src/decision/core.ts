import { type TileId, TILES, tileName } from '../engine/index.js';
import { DECISION_VERSION, levels, skills, type SkillId } from './curriculum.js';
import { decisionQuestion, decisionQuestions, type DecisionQuestion } from './questions.js';
import { decimal, fraction } from './solver.js';
import { validateTrainingSnapshot, compressedTraining, type TrainingSnapshot } from '../training/core.js';

export type DecisionAttempt = { id: string; questionId: string; answer: TileId; assisted: boolean; durationMs: number; at: string; review: boolean; correct: boolean; level: number; skill: SkillId; family: string; loss: number };
export type DecisionSession = { id: string; questions: string[]; index: number; selected: number | null; assisted: boolean; submitted: boolean; attemptIds: string[] };
export type DecisionEvidence = { id: string; text: string; evidenceIds: string[]; skill?: SkillId };
export type DecisionProfile = { version: 4; summary: string; facts: DecisionEvidence[]; suggestion: string; evidenceIds: string[]; focus: SkillId; uncertainties: string[] };
export type SavedDecisionProfile = { reportId: string; at: string; profile: DecisionProfile };
export type DecisionState = { version: 1; attempts: DecisionAttempt[]; reviews: { questionId: string; stage: number; due: string }[]; reports: SavedDecisionProfile[]; recommendation: { level: number; after: number }; manualLevel?: number; allowDeep: boolean; session?: DecisionSession };
export type DecisionSnapshot = { schemaVersion: 5; version: typeof DECISION_VERSION; attempts: Pick<DecisionAttempt, 'id' | 'questionId' | 'answer' | 'assisted' | 'durationMs' | 'at' | 'review'>[]; preferences?: { level: number | 'auto'; deep: boolean }; legacy?: TrainingSnapshot };
export const emptyDecision = (): DecisionState => ({ version: 1, attempts: [], reviews: [], reports: [], recommendation: { level: 1, after: 0 }, allowDeep: false });
export const localDay = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const dueIn = (days: number, now: Date) => { const date = new Date(now); date.setDate(date.getDate() + days); return localDay(date); };
export function independentDecisions(attempts: DecisionAttempt[]) { const seen = new Set<string>(); return [...attempts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id)).filter(a => { if (a.assisted || a.review || seen.has(a.family)) return false; seen.add(a.family); return true; }); }
function checkedAttempt(input: DecisionSnapshot['attempts'][number], review: boolean): DecisionAttempt {
  const q = decisionQuestion(input.questionId), chosen = q.certificate.options.find(o => o.tile === input.answer), best = q.certificate.options.find(o => o.tile === q.certificate.recommended)!;
  if (!chosen || q.pool === 'example') throw new Error('答案或题目不能作为独立练习记录。');
  const bestValue = BigInt(best.value.score), difference = bestValue - BigInt(chosen.value.score);
  return { ...input, at: new Date(input.at).toISOString(), review, correct: q.certificate.accepted.includes(input.answer), level: q.level, skill: q.skill, family: q.family, loss: Number(difference) / Number(bestValue) };
}
export function nextRecommendation(state: DecisionState) {
  const first = independentDecisions(state.attempts), observations = first.slice(state.recommendation.after).filter(a => a.level === state.recommendation.level), window = observations.slice(-10);
  if (window.length < 10) return state.recommendation;
  const right = window.filter(a => a.correct).length, required = [...new Set(decisionQuestions.filter(q=>q.level===state.recommendation.level&&q.pool==='practice').map(q=>q.skill))];
  if (right >= 8 && !required.every(skill=>observations.some(a=>a.skill===skill))) return state.recommendation;
  const level = Math.max(1, Math.min(4, state.recommendation.level + (right >= 8 ? 1 : right < 5 ? -1 : 0)));
  return level === state.recommendation.level ? state.recommendation : { level, after: first.length };
}
export function recordDecision(state: DecisionState, input: DecisionSnapshot['attempts'][number], now = new Date()): DecisionState {
  if (state.attempts.some(a => a.id === input.id)) return state;
  const q = decisionQuestion(input.questionId), review = input.review || state.attempts.some(a => a.family === q.family), a = checkedAttempt(input, review), previous = state.reviews.find(m => m.questionId === q.id);
  let reviews = state.reviews;
  if (!a.correct || a.assisted) reviews = reviews.filter(m => m.questionId !== q.id).concat({ questionId: q.id, stage: 0, due: localDay(now) });
  else if (previous) reviews = reviews.map(m => m === previous ? { ...m, stage: Math.min(3, m.stage + 1), due: dueIn([1, 3, 7, 7][m.stage], now) } : m);
  const next = { ...state, attempts: [...state.attempts, a], reviews }; return { ...next, recommendation: nextRecommendation(next) };
}
export function wilson(correct: number, n: number): [number, number] | null {
  if (!n) return null;
  const z = 1.959963984540054, p = correct / n, d = 1 + z * z / n, middle = p + z * z / (2 * n), radius = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(middle - radius) / d, (middle + radius) / d];
}
export function decisionStats(state: DecisionState) {
  const first = independentDecisions(state.attempts);
  const cohorts = new Map<string, DecisionAttempt[]>();
  for (const a of first) { const q = decisionQuestion(a.questionId), key = [a.skill, a.level, q.model.kind, q.model.horizon].join(':'); const group = cohorts.get(key) ?? []; group.push(a); cohorts.set(key, group); }
  return [...cohorts.values()].map(all => {
    const { skill, level } = all[0], model = decisionQuestion(all[0].questionId).model, recent = all.slice(-20), correct = all.filter(a => a.correct).length, losses = recent.map(a => a.loss).sort((a, b) => a - b), times = recent.filter(a => a.correct && a.durationMs >= 500 && a.durationMs <= 600000).map(a => a.durationMs).sort((a, b) => a - b);
    return { skill, level, kind: model.kind, horizon: model.horizon, count: all.length, correct, interval: wilson(correct, all.length), recentCount: recent.length, recentErrors: recent.filter(a => !a.correct).length, loss: recent.reduce((n, a) => n + a.loss, 0) / recent.length, medianLoss: (losses[Math.floor((losses.length-1)/2)]+losses[Math.floor(losses.length/2)])/2, medianTime: times.length ? (times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2 : null, evidenceIds: recent.filter(a => !a.correct).slice(-3).map(a => a.id), status: all.length < 5 ? '证据不足' : all.length < 20 ? '初步观察' : '已有较多样本' };
  });
}
export function reviewOutcomes(state: DecisionState) {
  const first=new Map<string,number>(),latest=new Map<string,DecisionAttempt>();
  for(const a of [...state.attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){const start=first.get(a.family);if(start===undefined)first.set(a.family,Date.parse(a.at));else if(!a.assisted&&a.review&&Date.parse(a.at)-start>=86400000)latest.set(a.family,a);}
  const groups=new Map<string,DecisionAttempt[]>();for(const a of latest.values()){const model=decisionQuestion(a.questionId).model,key=[a.skill,a.level,model.kind,model.horizon].join(':');const values=groups.get(key)??[];values.push(a);groups.set(key,values);}
  return [...groups.entries()].map(([id,values])=>({id,skill:values[0].skill,level:values[0].level,horizon:decisionQuestion(values[0].questionId).model.horizon,count:values.length,correct:values.filter(a=>a.correct).length,evidenceIds:values.slice(-3).map(a=>a.id)}));
}
export function focusSkill(state: DecisionState): SkillId {
  const level = state.manualLevel ?? state.recommendation.level;
  const weak = decisionStats(state).filter(s => s.level === level && s.count >= 5 && s.recentErrors >= 3 && decisionQuestions.some(q=>q.level===level&&q.skill===s.skill&&q.pool!=='example'&&(state.allowDeep||q.model.horizon<=3))).sort((a, b) => b.loss - a.loss || b.recentErrors - a.recentErrors)[0];
  if (weak) return weak.skill;
  const seen = new Set(state.attempts.map(a => a.family)); return decisionQuestions.find(q => q.level === level && q.pool === 'practice' && !seen.has(q.family) && (state.allowDeep || q.model.horizon <= 3))?.skill ?? 'tradeoff';
}
export function createDecisionSession(state: DecisionState, now = new Date(), id = crypto.randomUUID()): DecisionSession {
  const level = state.manualLevel ?? state.recommendation.level, focus = focusSkill(state), seen = new Set(state.attempts.map(a => a.family)), used = new Map<string, number>(); for (const a of state.attempts) used.set(a.questionId, (used.get(a.questionId) ?? 0) + 1);
  const eligible = decisionQuestions.filter(q => q.pool !== 'example' && q.level === level && (state.allowDeep || q.model.horizon <= 3)), fresh = eligible.filter(q => !seen.has(q.family)), ids: string[] = [];
  const push = (qid: string) => { if (ids.length < 5 && !ids.includes(qid)) ids.push(qid); };
  [...fresh.filter(q => q.pool === 'practice' && q.skill === focus), ...fresh.filter(q => q.pool === 'practice')].slice(0, 3).forEach(q => push(q.id));
  state.reviews.filter(m => m.due <= localDay(now) && decisionQuestion(m.questionId).level <= level && (state.allowDeep || decisionQuestion(m.questionId).model.horizon <= 3)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 1).forEach(m => push(m.questionId));
  fresh.filter(q => q.pool === 'transfer').slice(0, 1).forEach(q => push(q.id));
  fresh.forEach(q => push(q.id)); eligible.sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || a.id.localeCompare(b.id)).forEach(q => push(q.id));
  if (ids.length !== 5) throw new Error('当前题库尚未准备完成。');
  return { id, questions: ids, index: 0, selected: null, assisted: false, submitted: false, attemptIds: [] };
}
export function opportunityCount(q: DecisionQuestion, tile: TileId): number {
  const types=new Set(q.shape.discards.find(o=>o.tile===tile)!.improvements.map(x=>x.tile));return q.model.bag.filter(t=>types.has(t)).length;
}
export function recommendationReason(q: DecisionQuestion, answer=q.certificate.recommended): string {
  const shape=q.shape.discards.find(o=>o.tile===answer)!,count=opportunityCount(q,answer);
  if(shape.shanten===0){const waits=shape.improvements.filter(t=>q.model.bag.includes(t.tile)).map(t=>tileName(t.tile));return waits.length?'打掉后已经听牌，可以等'+waits.join('、')+'；本题还可摸到'+count+'张。':'牌形已经听牌，但袋中没有直接和牌的牌，本题需要再改良听口。';}
  const option=q.certificate.options.find(o=>o.tile===answer)!,fast=q.certificate.options.find(o=>o.tile===q.certificate.fastest)!;
  const tradeoff=answer!==fast.tile&&BigInt(option.value.score)>BigInt(fast.fast.score)?'只求快听可打'+tileName(fast.tile)+'；当前选择保留了更高的题设平均分。':'';
  return tradeoff+'还需改善'+shape.shanten+'次才能听牌，下一张有'+count+'张牌能让它前进一步。';
}
export function choiceEvidence(q: DecisionQuestion, answer: TileId): string {
  const chosen = q.certificate.options.find(o => o.tile === answer)!, best = q.certificate.options.find(o => o.tile === q.certificate.recommended)!, den = q.certificate.denominator;
  if (q.certificate.accepted.includes(answer)) return recommendationReason(q,answer);
  const difference = String(BigInt(best.value.score) - BigInt(chosen.value.score)), r = q.shape, a = r.discards.find(d => d.tile === answer)!, b = r.discards.find(d => d.tile === best.tile)!;
  const chosenCount=opportunityCount(q,answer),bestCount=opportunityCount(q,best.tile);
  let text = a.shanten > b.shanten ? '这个方案离听牌比推荐方案远' + (a.shanten - b.shanten) + '步。' : a.shanten === b.shanten && chosenCount < bestCount ? '距离相同，但少保留了' + (bestCount - chosenCount) + '张直接改善牌。' : '这两种选择在速度和牌型价值上有不同取舍。';
  text += '本题' + q.model.horizon + '次摸牌内，平均基础分差距' + (BigInt(difference) * 1000n < BigInt(den) ? '不足0.001' : '为' + decimal(difference, den)) + '分。';
  return text;
}
export function decisionFacts(state: DecisionState): DecisionEvidence[] {
  const relevant = decisionStats(state).filter(s => s.count >= 5).sort((a, b) => b.loss - a.loss || b.count - a.count).slice(0, 2);
  const facts: DecisionEvidence[] = relevant.map(s => ({ id: 'skill:' + s.level + ':' + s.skill + ':' + s.kind + ':' + s.horizon, skill: s.skill, text: levels[s.level - 1] + ' · ' + skills[s.skill].title + '（' + s.horizon + '次摸牌）：' + s.count + '道首次独立作答，' + s.correct + '道达到最高期望基础分。', evidenceIds: s.evidenceIds.length ? s.evidenceIds : independentDecisions(state.attempts).filter(a => a.level === s.level && a.skill === s.skill && decisionQuestion(a.questionId).model.horizon === s.horizon && decisionQuestion(a.questionId).model.kind === s.kind).slice(-2).map(a => a.id) }));
  for (const a of independentDecisions(state.attempts).filter(a => !a.correct).slice(-2)) facts.push({ id: 'attempt:' + a.id, skill: a.skill, text: choiceEvidence(decisionQuestion(a.questionId), a.answer), evidenceIds: [a.id] });
  for(const r of reviewOutcomes(state).filter(r=>r.count>=3).slice(0,1))facts.push({id:'review:'+r.id,skill:r.skill,text:skills[r.skill].title+'：至少间隔24小时复习了'+r.count+'种牌形，其中'+r.correct+'种最近一次答对。复习不增加独立样本。',evidenceIds:r.evidenceIds});
  return facts;
}
export function decisionSnapshot(state: DecisionState, legacy?: TrainingSnapshot): DecisionSnapshot { return { schemaVersion: 5, version: DECISION_VERSION, attempts: state.attempts.map(({ id, questionId, answer, assisted, durationMs, at, review }) => ({ id, questionId, answer, assisted, durationMs, at, review })),preferences:{level:state.manualLevel??'auto',deep:state.allowDeep}, ...(legacy ? { legacy } : {}) }; }
export function validateDecisionSnapshot(raw: unknown) {
  const s = raw as DecisionSnapshot;
  if (!s || s.schemaVersion !== 5 || s.version !== DECISION_VERSION || !Array.isArray(s.attempts) || s.attempts.length > 50000) throw new Error('舍牌学习记录的格式或版本无效。');
  const state = emptyDecision(), ids = new Set<string>(), families = new Set<string>();
  for (const a of s.attempts) { if (!a || typeof a.id !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(a.id) || ids.has(a.id) || typeof a.questionId !== 'string' || !TILES.includes(a.answer) || typeof a.assisted !== 'boolean' || typeof a.review !== 'boolean' || !Number.isInteger(a.durationMs) || a.durationMs < 0 || a.durationMs > 1800000 || typeof a.at !== 'string' || !Number.isFinite(Date.parse(a.at))) throw new Error('包含无效答题证据。'); ids.add(a.id); }
  for (const a of [...s.attempts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))) { const q = decisionQuestion(a.questionId); state.attempts.push(checkedAttempt(a, a.review || families.has(q.family))); families.add(q.family); }
  const first=independentDecisions(state.attempts);let observed:DecisionAttempt[]=[];
  first.forEach((a,index)=>{if(a.level!==state.recommendation.level)return;observed.push(a);if(observed.length<10)return;const correct=observed.slice(-10).filter(x=>x.correct).length,required=[...new Set(decisionQuestions.filter(q=>q.level===a.level&&q.pool==='practice').map(q=>q.skill))];if(correct>=8&&!required.every(skill=>observed.some(x=>x.skill===skill)))return;const level=Math.max(1,Math.min(4,a.level+(correct>=8?1:correct<5?-1:0)));if(level!==a.level){state.recommendation={level,after:index+1};observed=[];}});
  if(s.preferences){if(typeof s.preferences.deep!=='boolean'||s.preferences.level!=='auto'&&(!Number.isInteger(s.preferences.level)||s.preferences.level<1||s.preferences.level>4))throw new Error('练习偏好无效。');state.allowDeep=s.preferences.deep;if(s.preferences.level!=='auto')state.manualLevel=s.preferences.level;}
  const legacy = s.legacy ? validateTrainingSnapshot(s.legacy) : undefined;
  return { state, snapshot: decisionSnapshot(state, legacy?.snapshot), facts: decisionFacts(state), focus: focusSkill(state), ...(legacy ? { legacy: compressedTraining(legacy.state) } : {}) };
}
export function compressedDecisions(state: DecisionState) {
  const first = independentDecisions(state.attempts), cases = [...first.filter(a => !a.correct).slice(-8), ...first.filter(a => a.correct).slice(-4)];
  return { total: state.attempts.length, independent: first.length, assisted: state.attempts.filter(a => a.assisted).length, review: state.attempts.filter(a => a.review).length, retention:reviewOutcomes(state), stats: decisionStats(state), facts: decisionFacts(state), focus: focusSkill(state), cases: cases.map(a => ({ id: a.id, questionId: a.questionId, skill: a.skill, level: a.level, loss: a.loss, correct: a.correct, comparison: choiceEvidence(decisionQuestion(a.questionId), a.answer) })) };
}
export function validateDecisionProfile(raw: unknown): DecisionProfile {
  const p = raw as DecisionProfile;
  if (!p || p.version !== 4 || typeof p.summary !== 'string' || p.summary.length > 600 || typeof p.suggestion !== 'string' || p.suggestion.length > 600 || !Object.hasOwn(skills, p.focus) || !Array.isArray(p.evidenceIds) || p.evidenceIds.length > 9 || p.evidenceIds.some(id=>typeof id!=='string') || !Array.isArray(p.facts) || p.facts.length > 6 || p.facts.some(f => !f || typeof f.id !== 'string' || typeof f.text !== 'string' || f.text.length > 600 || !Array.isArray(f.evidenceIds) || f.evidenceIds.some(id => typeof id !== 'string')) || !Array.isArray(p.uncertainties) || p.uncertainties.length > 10 || p.uncertainties.some(x => typeof x !== 'string' || x.length > 600)) throw new Error('学习建议格式无效。');
  return p;
}
export function importDecision(raw: unknown): DecisionState {
  const s = raw as DecisionState;
  if (!s || s.version !== 1 || !Array.isArray(s.reviews) || !Array.isArray(s.reports) || !s.recommendation || !Number.isInteger(s.recommendation.level) || s.recommendation.level < 1 || s.recommendation.level > 4 || !Number.isInteger(s.recommendation.after) || s.recommendation.after < 0 || typeof s.allowDeep !== 'boolean' || s.manualLevel !== undefined && (!Number.isInteger(s.manualLevel) || s.manualLevel < 1 || s.manualLevel > 4)) throw new Error('学习备份无效。');
  const state = validateDecisionSnapshot({ schemaVersion: 5, version: DECISION_VERSION, attempts: s.attempts }).state;
  if (s.recommendation.after > independentDecisions(state.attempts).length) throw new Error('学习阶段与作答记录不一致。');
  state.recommendation = { ...s.recommendation }; state.allowDeep = s.allowDeep; state.manualLevel = s.manualLevel;
  state.reviews = s.reviews.map(m => { decisionQuestion(m.questionId); const date = new Date(m.due + 'T12:00:00'); if (!Number.isInteger(m.stage) || m.stage < 0 || m.stage > 3 || !/^\d{4}-\d{2}-\d{2}$/.test(m.due) || !Number.isFinite(+date) || localDay(date) !== m.due) throw new Error('复习日期无效。'); return { ...m }; });
  state.reports = s.reports.slice(-30).map(p => { if (!p || typeof p.reportId !== 'string' || !Number.isFinite(Date.parse(p.at))) throw new Error('报告备份无效。'); return { ...p, profile: validateDecisionProfile(p.profile) }; });
  if (s.session) {
    const x = s.session;
    if (!x || typeof x.id !== 'string' || !Array.isArray(x.questions) || x.questions.length !== 5 || new Set(x.questions).size !== 5 || !Number.isInteger(x.index) || x.index < 0 || x.index > 5 || typeof x.assisted !== 'boolean' || typeof x.submitted !== 'boolean' || !Array.isArray(x.attemptIds)) throw new Error('练习进度无效。');
    x.questions.forEach(id => { if (decisionQuestion(id).pool === 'example') throw new Error('例题不能作为练习草稿。'); });
    const completed = x.index === 5 ? 5 : x.index + Number(x.submitted);
    if (x.attemptIds.length !== completed || x.attemptIds.some((id, i) => state.attempts.find(a => a.id === id)?.questionId !== x.questions[i])) throw new Error('已答进度与记录不一致。');
    if (x.index === 5) { if (x.selected !== null || x.submitted) throw new Error('完成状态无效。'); }
    else { const q = decisionQuestion(x.questions[x.index]); if (x.selected !== null && (!Number.isInteger(x.selected) || x.selected < 0 || x.selected >= q.context.hand.length)) throw new Error('手牌位置无效。'); if (x.submitted) { const a = state.attempts.find(a => a.id === x.attemptIds.at(-1))!; if (x.selected === null || a.answer !== q.context.hand[x.selected] || a.assisted !== x.assisted) throw new Error('已答选择不一致。'); } }
    state.session = structuredClone(x);
  }
  return state;
}
