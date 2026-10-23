import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AIActivity, Button, Dialog, InlineNotice, MenuButton } from 'chatgpt-desktop-kit';
import { Hand, Tile, AppLink, ErrorNotice, useActiveTime, useLearning } from '../ui.js';
import { countsOf, tileName, TILES, type TileId } from '../engine/index.js';
import { DecisionMath } from '../decision/pages.js';
import { emptyDecision, recordDecision, type DecisionState } from '../decision/core.js';
import { decisionQuestion, type DecisionQuestion } from '../decision/questions.js';
import { trainingSnapshot } from '../training/core.js';
import { type InsightClient, createInsightClient } from '../client.js';
import { challenge, newGroup, emptyExperience, observations, composeInsight, experienceSnapshot, validateInsight, type ExperienceState, type GroupRecord, type SavedInsight } from './core.js';
import { quotes, reflections, type Challenge } from './definitions.js';
import { usePresentation, useReducedMotion } from './presentation.js';
import type { AudioDirector } from '../story/resources.js';

export const ExperienceSurface = createContext<{ client: InsightClient; paused: boolean; audio?:AudioDirector|null; openInsights(): void; immersive(value: boolean): void; clear(): void }>({ client: createInsightClient(), paused: false, openInsights() {}, immersive() {}, clear() {} });
export function useExperience() {
  const learning = useLearning(), surface = useContext(ExperienceSurface), state = learning.data.decision ?? emptyDecision(), experience = learning.data.experience ?? emptyExperience();
  return { ...learning, ...surface, state, experience, current: experience.groups.at(-1), change: (fn: (s: DecisionState, e: ExperienceState) => { state: DecisionState; experience: ExperienceState }) => learning.update(d => { const next = fn(d.decision ?? emptyDecision(), d.experience ?? emptyExperience()); return { ...d, decision: next.state, experience: next.experience }; }) };
}
export function ExperienceHome() {
  const { current, state, experience, change, base } = useExperience(), navigate = useNavigate(), continuing = current && current.index < 5;
  const begin = () => { if (!continuing) change((s, e) => ({ state: s, experience: { ...e, groups: [...e.groups, newGroup(s, e)] } })); navigate(base + '/practice'); };
  return <div className="mj-decision-home mj-experience-home"><h1>从这一手开始。</h1><div className="mj-decision-home-hand"><Hand tiles={['2p', '3p', '4p', '4s', '5s', '9s']} /></div><div className="mj-decision-start"><Button variant="primary" onClick={begin}>{continuing ? '继续这一轮' : '开始'}</Button><span className="mj-muted">{continuing ? `第${current.index + 1}手` : experience.groups.length && !observations(state, experience).length ? '再走五手' : '每轮五手'}</span></div></div>;
}
export function Conditions({ q }: { q: DecisionQuestion }) {
  const bag = countsOf(q.model.bag);
  return <div className="mj-decision-conditions">
    {q.model.horizon > 1 && <p className="mj-condition-window">{q.model.horizon}次摸打</p>}
    {!!q.context.fixedSets?.length && <div className="mj-decision-public"><span>已碰杠</span>{q.context.fixedSets.map((set, i) => <Hand key={i} tiles={set.kind === 'quad' ? Array<TileId>(4).fill(set.tile) : Array<TileId>(3).fill(set.tile)} />)}</div>}
    {!!Object.keys(q.context.visible ?? {}).length && <div className="mj-decision-public"><span>其他已见牌</span>{Object.entries(q.context.visible!).filter(([, n]) => n).map(([tile, n]) => <Tile key={tile} tile={tile as TileId} small detail={n + '张'} />)}</div>}
    {q.model.kind === 'explicit' && <div className="mj-decision-public"><span>只从这些牌摸</span>{TILES.filter((_, i) => bag[i]).map(tile => <Tile key={tile} tile={tile} small detail={bag[TILES.indexOf(tile)] + '张'} />)}</div>}
  </div>;
}
export function responseFor(c: Challenge, q: DecisionQuestion, answer: TileId) {
  const t = c.proof.tiles[0];
  if (c.kind === 'gap') return c.proof.basis === 'seen-out' ? `${tileName(t)}已经见尽，不能再把它算作可摸到的机会。` : `本题可摸的牌里，没有${tileName(t)}。`;
  if (c.kind === 'entanglement') { const counts = countsOf(q.context.hand), shared = c.proof.tiles.find((tile, i, all) => all.indexOf(tile) !== i && counts[TILES.indexOf(tile)] === 1)!; return `两种连接共用了${tileName(shared)}，它在手里只有一张。`; }
  if (c.kind === 'adaptability') return `这手的关键，是${tileName(t)}还剩${q.model.bag.filter(x => x === t).length}张。`;
  if (c.proof.basis === 'conditional-value') return '成牌后的分值更高，不代表这一手的平均基础分也更高。';
  return q.certificate.accepted.includes(answer) ? `这次，打${tileName(answer)}保留了题设中最高的平均基础分。` : `打${tileName(q.certificate.recommended)}，比打${tileName(answer)}保留了更高的平均基础分。`;
}
export function ExperiencePractice() {
  const { current, change } = useExperience();
  useEffect(() => { if (!current) change((s, e) => ({ state: s, experience: { ...e, groups: [...e.groups, newGroup(s, e)] } })); }, [current?.id]);
  if (!current) return <div className="mj-initial-loading"><AIActivity>正在备牌…</AIActivity></div>;
  if (current.index === 5) return <Ending key={current.id} group={current} />;
  return <Round key={current.id + ':' + current.index} group={current} />;
}
function Round({ group }: { group: GroupRecord }) {
  const { state, change, base, assets, paused, immersive, notice, audio } = useExperience(), c = challenge(group.challenges[group.index]), q = decisionQuestion(c.questionId), root = useRef<HTMLDivElement>(null), quote = useRef<HTMLParagraphElement>(null), locked = useRef(false), heading = useRef<HTMLHeadingElement>(null), [conditions, setConditions] = useState(false), [mathOpen, setMathOpen] = useState(false);
  const patch = (p: Partial<GroupRecord>) => change((s, e) => ({ state: s, experience: { ...e, groups: e.groups.map(g => g.id === group.id ? { ...g, ...p } : g) } }));
  const presentation = usePresentation({ key: group.id + ':' + group.index, first: !group.introSeen, seen: group.presented.includes(group.index), submitted: group.submitted, paused: paused || conditions, assets, tiles: q.context.hand, nextTiles: group.index < 4 ? decisionQuestion(challenge(group.challenges[group.index + 1]).questionId).context.hand : [], root, quote, enter: () => patch({ introSeen: true, presented: [...new Set([...group.presented, group.index])] }), immersive });
  const elapsed = useActiveTime(group.id + ':' + group.index, !presentation.ready || paused || conditions || mathOpen || group.submitted), answer = group.selected === null ? undefined : q.context.hand[group.selected];
  useEffect(() => { if (presentation.ready && !group.submitted) heading.current?.focus(); }, [presentation.ready]);
  useEffect(()=>{audio?.setThinking(presentation.ready&&!group.submitted);if(presentation.ready)audio?.effect('deal',group.id+':'+group.index+':deal');},[presentation.ready,group.submitted,audio]);
  const submit = () => {
    if (!answer || !presentation.ready || group.submitted || locked.current) return; locked.current = true;
    const attempt = { id: crypto.randomUUID(), questionId: q.id, answer, assisted: group.assisted, review: false, durationMs: elapsed(), at: new Date().toISOString() };
    try { change((s, e) => { const current = e.groups.find(g => g.id === group.id); if (!current || current.submitted || current.index !== group.index) return { state: s, experience: e }; return { state: recordDecision(s, attempt), experience: { ...e, groups: e.groups.map(g => g === current ? { ...g, submitted: true, attemptIds: [...g.attemptIds, attempt.id] } : g) } }; }); } catch (error) { locked.current = false; notice((error as Error).message); }
    audio?.effect('discard',group.id+':'+group.index+':discard');
  };
  return <>{presentation.intro && <div className="mj-experience-intro" role="status" aria-label="开场"><p ref={quote}>{quotes[Number(group.quoteId)]}</p></div>}<div ref={root} inert={presentation.intro} aria-hidden={presentation.intro} className="mj-decision-practice mj-experience-practice" data-presenting={presentation.hidden} data-ready={presentation.ready}>
    <div className="mj-decision-questionbar"><AppLink to={base + '/'}>← 返回</AppLink><span>{String(group.index + 1).padStart(2, '0')} / 05</span></div>
    <div className="mj-decision-questiontitle"><h1 ref={heading} tabIndex={-1}>这一手，打哪张？</h1><Button variant="ghost" size="sm" disabled={!presentation.ready} onClick={() => setConditions(true)}>局面</Button></div>
    <Hand tiles={q.context.hand} onSelect={(_, index) => { if (presentation.ready && !group.submitted) {patch({ selected: index });audio?.effect('select',crypto.randomUUID());} }} selectedIndex={group.selected ?? -1} disabled={!presentation.ready || group.submitted} />
    <Conditions q={q} />
    {presentation.error ? <InlineNotice title={presentation.error} actions={<Button onClick={presentation.retry}>再试一次</Button>} /> : !presentation.ready && !presentation.intro ? <AIActivity>正在备牌…</AIActivity> : null}
    {!group.submitted ? <><div className="mj-decision-answer"><Button variant="primary" disabled={!answer || !presentation.ready} onClick={submit}>{answer ? '打掉' + tileName(answer) : '选一张牌'}</Button><Button variant="ghost" disabled={!presentation.ready || group.assisted} onClick={() => patch({ assisted: true })}>换个角度</Button></div>{group.assisted && <InlineNotice title={q.note} />}</> : <section className="mj-experience-response" aria-live="polite"><h2>这手可打{q.certificate.accepted.map(tileName).join('、')}</h2><p>{responseFor(c, q, answer!)}</p><details onToggle={e => setMathOpen(e.currentTarget.open)}><summary>看清这一手</summary><DecisionMath q={q} /></details><div className="mj-actions"><Button variant="primary" onClick={() => patch({ index: group.index + 1, selected: null, assisted: false, submitted: false })}>{group.index === 4 ? '走完这一轮' : '下一手'}</Button></div></section>}
    <Dialog open={conditions} onClose={() => setConditions(false)} title="这一手的局面"><p>{q.model.horizon === 1 ? '这一手比较下一次摸牌。' : `这一手比较${q.model.horizon}次摸打。`}从题设余牌中均匀、不放回摸取，每次重新选择舍牌，首次成牌结束。</p><Conditions q={q} /><p>推荐比较平均基础分，包含未成牌的结果。详细推演在出牌后展开。</p></Dialog>
  </div></>;
}
function Ending({ group }: { group: GroupRecord }) {
  const { change, openInsights, state } = useExperience(), c = group.challenges.map(challenge).find(c=>c.proof.before), q = c?decisionQuestion(c.questionId):undefined, before = c?.proof.before, tile = c?.proof.tiles[0], oldCount = tile&&before?before.model.bag.filter(t => t === tile).length:0, count = tile&&q?q.model.bag.filter(t => t === tile).length:0, reduced = useReducedMotion(), root = useRef<HTMLDivElement>(null), fact=observations(state,emptyExperience(),group.attemptIds)[0];
  useEffect(() => { if (reduced || !root.current) return; const elements = root.current.querySelectorAll<HTMLElement>(':scope > h1,:scope > p,:scope > .mj-actions'), animations = [...elements].map((el, i) => el.animate([{ opacity: 0 }, { opacity: 1 }], { delay: i * 200, duration: 300, fill: 'both' })); return () => animations.forEach(a => a.cancel()); }, [reduced]);
  return <div ref={root} className="mj-decision-finish mj-experience-ending"><h1>{fact?.text??'五次选择，已经留下。'}</h1><p className="mj-experience-question">{fact?reflections[fact.kind]:'还有哪一种可能，值得再看一眼？'}</p>{before&&q&&tile&&<details><summary>再看一次条件变化</summary><p>{tileName(tile)}从可摸{oldCount}张变为{count}张。原可打{before.certificate.accepted.map(tileName).join('、')}，现在可打{q.certificate.accepted.map(tileName).join('、')}。</p><Conditions q={before} /><DecisionMath q={before} /><Conditions q={q} /><DecisionMath q={q} /></details>}<div className="mj-actions"><Button variant="primary" onClick={() => change((s, e) => ({ state: s, experience: { ...e, groups: [...e.groups, newGroup(s, e)] } }))}>再走五手</Button><Button variant="ghost" onClick={openInsights}>我的取舍</Button></div></div>;
}
function Evidence({ ids, state }: { ids: string[]; state: DecisionState }) {
  return <details className="mj-experience-evidence"><summary>回到那一手</summary>{ids.slice(-3).map(id => { const a = state.attempts.find(a => a.id === id); if (!a) return null; const q = decisionQuestion(a.questionId); return <section key={id}><Hand tiles={q.context.hand} selected={[a.answer]} /><p>当时打了{tileName(a.answer)}。</p><Conditions q={q} /><details><summary>看清这一手</summary><DecisionMath q={q} /></details></section>; })}</details>;
}
export function Insights({ open, onClose }: { open: boolean; onClose(): void }) {
  const { state, experience, data, change, client, clear, trainingClient, profileClient, notice } = useExperience(), facts = useMemo(() => observations(state, experience), [state, experience]), local = facts[0] ? composeInsight(facts[0], facts[0].kind) : undefined, latest = experience.reports.at(-1), profile = latest?.profile ?? local, [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const remove = async (report: SavedInsight) => { try { await client.remove(report.reportId); change((s, e) => ({ state: s, experience: { ...e, reports: e.reports.filter(p => p.reportId !== report.reportId) } })); } catch (e) { notice((e as Error).message); } };
  const generate = async () => {
    if (busy || !facts.length) return; setConfirm(false); setBusy(true); setError('');
    try { const report = await client.generate(experienceSnapshot(state, experience, data.training?.attempts.length ? trainingSnapshot(data.training) : undefined)); validateInsight(report.profile); const allowed = new Set(state.attempts.map(a => a.id)); if (report.profile.evidenceIds.some(id => !allowed.has(id))) throw Error('这份回望引用了当前记录以外的题目。'); change((s, e) => report.profile.evidenceIds.every(id => s.attempts.some(a => a.id === id)) ? ({ state: s, experience: { ...e, reports: [...e.reports.filter(p => p.reportId !== report.reportId), report] } }) : { state: s, experience: e }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <><Dialog open={open} onClose={onClose} presentation="sheet" title="我的取舍"><div className="mj-experience-insights">
    {profile ? <><p className="mj-experience-observation">{profile.observation.text}</p><p className="mj-experience-question">{profile.reflection.text}</p><Evidence ids={profile.evidenceIds} state={state} /></> : <p>先走过这五手，再回来看看。</p>}
    <div className="mj-actions"><Button disabled={!facts.length || busy} onClick={() => setConfirm(true)}>再看一层</Button><MenuButton label="记录" actionId="mahjong.insight.records" items={[...(latest ? [{ label: '删除这份回望', actionId: 'mahjong.insight.delete', onSelect: () => { void remove(latest); } }] : []), { label: '清除本地记录', actionId: 'mahjong.records.clear', onSelect: clear }]} /></div>
    {busy && <AIActivity>回看你的选择…</AIActivity>}<ErrorNotice message={error} />
    {(experience.reports.length > 1 || state.reports.length > 0 || data.training?.reports.length || data.profiles.length > 0) ? <details><summary>过往</summary>{experience.reports.slice(0, -1).map(p => <section key={p.reportId}><p>{p.profile.observation.text}</p><p>{p.profile.reflection.text}</p><Evidence ids={p.profile.evidenceIds} state={state} /><Button size="sm" variant="ghost" onClick={() => { void remove(p); }}>删除回望</Button></section>)}{state.reports.map(p => <details key={p.reportId}><summary>原报告 · {p.at.slice(0, 10)}</summary><p>{p.profile.summary}</p><p>{p.profile.suggestion}</p><Button size="sm" onClick={async () => { try { await client.remove(p.reportId); change((s, e) => ({ state: { ...s, reports: s.reports.filter(r => r.reportId !== p.reportId) }, experience: e })); } catch (e) { notice((e as Error).message); } }}>删除原报告</Button></details>)}{data.training?.reports.map(p => <details key={p.reportId}><summary>原小结 · {p.at.slice(0, 10)}</summary><p>{p.profile.suggestion}</p><Button size="sm" onClick={async () => { try { await trainingClient.remove(p.reportId); notice('原小结已删除。'); } catch (e) { notice((e as Error).message); } }}>删除原小结</Button></details>)}{data.profiles.map(p => <details key={p.reportId}><summary>原画像 · {p.at.slice(0, 10)}</summary><p>{p.profile.summary}</p><Button size="sm" onClick={async () => { try { await profileClient.remove(p.reportId); notice('原画像已删除。'); } catch (e) { notice((e as Error).message); } }}>删除原画像</Button></details>)}</details> : null}
  </div></Dialog><Dialog open={confirm} onClose={() => setConfirm(false)} title="再看一层" description="将答题记录交给本站模型分析。" footer={<><Button onClick={() => setConfirm(false)}>暂不</Button><Button variant="primary" onClick={() => { void generate(); }}>同意并继续</Button></>} /></>;
}
