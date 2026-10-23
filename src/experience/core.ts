import rawCatalog from './catalog.json' with { type: 'json' };
import { tileName, type TileId } from '../engine/index.js';
import { decisionQuestion } from '../decision/questions.js';
import { decisionSnapshot, emptyDecision, independentDecisions, localDay, validateDecisionSnapshot, type DecisionAttempt, type DecisionSnapshot, type DecisionState } from '../decision/core.js';
import { decimal } from '../decision/solver.js';
import { challengeKinds, EXPERIENCE_VERSION, reflections, quotes, type Challenge, type ChallengeKind, type ExperienceCatalog } from './definitions.js';

export const catalog = rawCatalog as ExperienceCatalog;
const challengeMap = new Map(catalog.challenges.map(c => [c.id, c]));
export function challenge(id: string): Challenge { const c = challengeMap.get(id); if (!c) throw Error('这一组的题目版本无法识别。'); return c; }
export type GroupRecord = { id: string; templateId: string; challenges: string[]; quoteId: string; index: number; selected: number | null; assisted: boolean; submitted: boolean; attemptIds: string[]; introSeen: boolean; presented: number[]; startedAt: string; returning: boolean };
export type Observation = { id: string; text: string; kind: ChallengeKind; evidenceIds: string[]; scope: 'single' | 'pattern' };
export type InsightProfile = { version: 5; observation: Observation; reflection: { id: string; text: string }; evidenceIds: string[] };
export type SavedInsight = { reportId: string; at: string; profile: InsightProfile };
export type ExperienceState = { version: 1; groups: GroupRecord[]; reports: SavedInsight[] };
export const emptyExperience = (): ExperienceState => ({ version: 1, groups: [], reports: [] });
export type GroupEvidence = Pick<GroupRecord, 'id' | 'templateId' | 'challenges' | 'quoteId' | 'attemptIds' | 'startedAt'>;
export type ExperienceSnapshot = Omit<DecisionSnapshot, 'schemaVersion' | 'version'> & { schemaVersion: 6; version: typeof EXPERIENCE_VERSION; groups: GroupEvidence[] };

export function newGroup(state: DecisionState, experience: ExperienceState, now = new Date(), id = crypto.randomUUID()): GroupRecord {
  const level = state.manualLevel ?? state.recommendation.level, seen = new Set(state.attempts.map(a => a.family));
  const templates = catalog.groups.filter(g => g.level === level);
  const fresh = (ids: string[]) => ids.filter(cid => !seen.has(decisionQuestion(challenge(cid).questionId).family)).length;
  const used = (tid: string) => experience.groups.filter(g => g.templateId === tid).length;
  const template = [...templates].sort((a, b) => fresh(b.challenges) - fresh(a.challenges) || used(a.id) - used(b.id) || a.id.localeCompare(b.id))[0];
  if (!template) throw Error('这一组还没有准备好。');
  const ids = [...template.challenges], due = new Set(state.reviews.filter(r => r.due <= localDay(now)).map(r => r.questionId));
  const replace = (test: (c: Challenge) => boolean) => {
    for (let i = 0; i < ids.length; i++) {
      const current = challenge(ids[i]);
      const candidate = catalog.challenges.find(c => {
        const q = decisionQuestion(c.questionId);
        return c.kind === current.kind && q.level === level && (state.allowDeep || q.model.horizon <= 3) && test(c) && !ids.some((other, j) => j !== i && decisionQuestion(challenge(other).questionId).family === q.family) && (q.pool !== 'transfer' || !ids.some((other, j) => j !== i && decisionQuestion(challenge(other).questionId).pool === 'transfer'));
      });
      if (candidate) { ids[i] = candidate.id; return; }
    }
  };
  if (fresh(ids) >= 4) replace(c => due.has(c.questionId));
  if (state.allowDeep && level === 4) replace(c => decisionQuestion(c.questionId).model.horizon >= 4 && !seen.has(decisionQuestion(c.questionId).family));
  return { id, templateId: template.id, challenges: ids, quoteId: template.quoteId, index: 0, selected: null, assisted: false, submitted: false, attemptIds: [], introSeen: false, presented: [], startedAt: now.toISOString(), returning: fresh(ids) < 3 };
}

function kindFor(a: DecisionAttempt, experience: ExperienceState): ChallengeKind {
  for (const g of experience.groups) { const i = g.attemptIds.indexOf(a.id); if (i >= 0) return challenge(g.challenges[i]).kind; }
  return catalog.challenges.find(c => c.questionId === a.questionId)?.kind ?? 'cost';
}
export function observations(state: DecisionState, experience: ExperienceState, only?: string[]): Observation[] {
  const first = independentDecisions(state.attempts).filter(a => !only || only.includes(a.id)), result: Observation[] = [];
  const grouped = new Map<string, DecisionAttempt[]>();
  for (const a of first) {
    const q = decisionQuestion(a.questionId), kind = kindFor(a, experience), key = [kind, a.level, q.model.kind, q.model.horizon].join(':');
    const xs = grouped.get(key) ?? []; xs.push(a); grouped.set(key, xs);
    const chosen = q.certificate.options.find(o => o.tile === a.answer)!, best = q.certificate.options.find(o => o.tile === q.certificate.recommended)!;
    const text = a.correct ? `这一手，你打${tileName(a.answer)}，保留了题设中最高的平均基础分。` : `打${tileName(a.answer)}，平均${decimal(chosen.value.score, q.certificate.denominator)}分；打${tileName(best.tile)}为${decimal(best.value.score, q.certificate.denominator)}分。`;
    result.push({ id: 'choice:' + a.id, text, kind, evidenceIds: [a.id], scope: 'single' });
  }
  for (const [key, xs] of grouped) {
    if (xs.length < 5) continue;
    const recent = xs.slice(-20), rich = recent.filter(a => {
      const q = decisionQuestion(a.questionId), o = q.certificate.options.find(x => x.tile === a.answer)!, best = q.certificate.options.find(x => x.tile === q.certificate.recommended)!;
      return !a.correct && BigInt(o.value.wins) > 0n && BigInt(o.value.wins) < BigInt(best.value.wins) && BigInt(o.value.score) * BigInt(best.value.wins) > BigInt(best.value.score) * BigInt(o.value.wins);
    });
    if (rich.length >= 3) result.push({ id: 'pattern:' + key, text: `这${recent.length}手里，有${rich.length}次留下高番路线，成牌机会更少。`, kind: 'temptation', evidenceIds: recent.map(a => a.id), scope: 'pattern' });
  }
  const losses = new Map(state.attempts.map((a, i) => [a.id, { loss: a.loss, i }]));
  return result.sort((a, b) => (a.scope === 'pattern' ? -1 : 1) - (b.scope === 'pattern' ? -1 : 1) || losses.get(b.evidenceIds[0])!.loss - losses.get(a.evidenceIds[0])!.loss || losses.get(b.evidenceIds[0])!.i - losses.get(a.evidenceIds[0])!.i).slice(0, 32);
}
export function allowedReflections(kind: ChallengeKind) {
  return [{ id: kind, text: reflections[kind] }, { id: 'again', text: '若再遇到这一手，你还会这样选吗？' }, { id: 'possibility', text: '还有哪一种可能，值得你再看一眼？' }];
}
export function composeInsight(observation: Observation, reflectionId: string): InsightProfile {
  const reflection = allowedReflections(observation.kind).find(r => r.id === reflectionId);
  if (!reflection) throw Error('自问不属于这一手的证据范围。');
  return { version: 5, observation, reflection, evidenceIds: [...observation.evidenceIds] };
}
export function validateInsight(raw: unknown): InsightProfile {
  const p = raw as InsightProfile;
  if (!p || p.version !== 5 || !p.observation || typeof p.observation.id !== 'string' || typeof p.observation.text !== 'string' || p.observation.text.length > 65 || !challengeKinds.includes(p.observation.kind) || !['single', 'pattern'].includes(p.observation.scope) || !Array.isArray(p.observation.evidenceIds) || !p.observation.evidenceIds.length || p.observation.evidenceIds.length > 20 || p.observation.evidenceIds.some(id => typeof id !== 'string') || !p.reflection || !allowedReflections(p.observation.kind).some(r => r.id === p.reflection.id && r.text === p.reflection.text) || JSON.stringify(p.evidenceIds) !== JSON.stringify(p.observation.evidenceIds)) throw Error('这份回望的格式无法识别。');
  return p;
}
export function experienceSnapshot(state: DecisionState, experience: ExperienceState, legacy?: DecisionSnapshot['legacy']): ExperienceSnapshot {
  return { ...decisionSnapshot(state, legacy), schemaVersion: 6, version: EXPERIENCE_VERSION, groups: experience.groups.map(({ id, templateId, challenges, quoteId, attemptIds, startedAt }) => ({ id, templateId, challenges, quoteId, attemptIds, startedAt })) };
}
export function validateExperienceSnapshot(raw: unknown) {
  const s = raw as ExperienceSnapshot;
  if (!s || s.schemaVersion !== 6 || s.version !== EXPERIENCE_VERSION || !Array.isArray(s.groups) || s.groups.length > 10000) throw Error('五手记录的格式无法识别。');
  const checked = validateDecisionSnapshot({ ...s, schemaVersion: 5, version: 'discard-value-1' }), seen = new Set<string>(), linked = new Set<string>(), experience = emptyExperience();
  for (const g of s.groups) {
    const t = catalog.groups.find(t => t.id === g.templateId);
    if (!g || typeof g.id !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(g.id) || seen.has(g.id) || !t || g.quoteId !== t.quoteId || !quotes[Number(g.quoteId)] || !Number.isFinite(Date.parse(g.startedAt)) || !Array.isArray(g.challenges) || g.challenges.length !== 5 || !Array.isArray(g.attemptIds) || g.attemptIds.length > 5) throw Error('组卷记录无效。');
    const cs = g.challenges.map(challenge), qs = cs.map(c => decisionQuestion(c.questionId));
    if (new Set(cs.map(c => c.kind)).size !== 5 || cs[4].kind !== 'adaptability' || new Set(qs.map(q => q.family)).size !== 5 || qs.some(q => q.level !== t.level) || qs.filter(q => q.pool === 'transfer').length > 1) throw Error('五种考验或牌形不一致。');
    g.attemptIds.forEach((id, i) => { if (linked.has(id) || checked.state.attempts.find(a => a.id === id)?.questionId !== qs[i].id) throw Error('作答与考验不一致。'); linked.add(id); }); seen.add(g.id);
    experience.groups.push({ ...g, index: g.attemptIds.length, selected: null, assisted: false, submitted: false, introSeen: true, presented: [], returning: false });
  }
  const facts = observations(checked.state, experience);
  return { ...checked, experience, facts, snapshot: experienceSnapshot(checked.state, experience, checked.snapshot.legacy) };
}

export function restoreExperience(raw: unknown, decision: DecisionState): ExperienceState {
  const s = raw as ExperienceState;
  if (!s || s.version !== 1 || !Array.isArray(s.groups) || !Array.isArray(s.reports)) return emptyExperience();
  try {
    validateExperienceSnapshot(experienceSnapshot(decision, s));
    for (const g of s.groups) {
      if (!Number.isInteger(g.index) || g.index < 0 || g.index > 5 || g.attemptIds.length !== (g.index === 5 ? 5 : g.index + Number(g.submitted)) || typeof g.introSeen !== 'boolean' || typeof g.assisted !== 'boolean' || typeof g.submitted !== 'boolean' || typeof g.returning !== 'boolean' || !Array.isArray(g.presented) || g.presented.some(i => !Number.isInteger(i) || i < 0 || i > 4)) throw Error('进度无效');
      if (g.index < 5 && g.selected !== null && (!Number.isInteger(g.selected) || g.selected < 0 || g.selected >= decisionQuestion(challenge(g.challenges[g.index]).questionId).context.hand.length)) throw Error('选择无效');
    }
    return { version: 1, groups: structuredClone(s.groups), reports: s.reports.map(p => { validateInsight(p.profile); if (typeof p.reportId !== 'string' || !Number.isFinite(Date.parse(p.at))) throw Error('回望无效'); return p; }) };
  } catch { return emptyExperience(); }
}
