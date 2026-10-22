import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AIActivity, AIResponse, Button, Dialog, InlineNotice, RecordLink, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from 'chatgpt-desktop-kit';
import { analyze, countsOf, setTiles, tileName, TILES, type TileId } from '../engine/index.js';
import { AppLink, ErrorNotice, Hand, Tile, useActiveTime, useLearning } from '../ui.js';
import { type DecisionClient, createDecisionClient } from '../client.js';
import { trainingSnapshot } from '../training/core.js';
import { choiceEvidence, createDecisionSession, decisionFacts, decisionSnapshot, decisionStats, emptyDecision, focusSkill, independentDecisions, opportunityCount, recordDecision, reviewOutcomes, validateDecisionProfile, type DecisionSession, type DecisionState } from './core.js';
import { decisionQuestion, decisionQuestions, type DecisionQuestion } from './questions.js';
import { levels, skills } from './curriculum.js';
import { decimal, fraction, percent } from './solver.js';
import { RULE_SOURCE } from './score.js';

export const DecisionSurface = createContext<{ client: DecisionClient; paused: boolean; openHabits(): void }>({ client: createDecisionClient(), paused: false, openHabits() {} });
export function useDecision() {
  const learning = useLearning(), surface = useContext(DecisionSurface);
  return { ...learning, ...surface, state: learning.data.decision ?? emptyDecision(), change: (fn: (state: DecisionState) => DecisionState) => learning.update(data => ({ ...data, decision: fn(data.decision ?? emptyDecision()) })) };
}

function Conditions({ q }: { q: DecisionQuestion }) {
  const bag = countsOf(q.model.bag);
  return <div className="mj-decision-conditions">
    {!!q.context.fixedSets?.length && <div className="mj-decision-public"><span>已碰杠</span>{q.context.fixedSets.map((s, i) => <Hand key={i} tiles={setTiles(s)} />)}</div>}
    {!!Object.keys(q.context.visible ?? {}).length && <div className="mj-decision-public"><span>其他已见牌</span>{Object.entries(q.context.visible!).map(([t, n]) => <Tile key={t} tile={t as TileId} small detail={n + '张'} />)}</div>}
    {q.model.kind === 'explicit' && <div className="mj-decision-public"><span>本题只从这些牌摸</span>{TILES.filter((_, i) => bag[i]).map(t => <Tile key={t} tile={t} small detail={bag[TILES.indexOf(t)] + '张'} />)}</div>}
  </div>;
}

export function DecisionHome() {
  const { state, change, base } = useDecision(), nav = useNavigate(), session = state.session, continuing = session && session.index < 5, focus = focusSkill(state), first = independentDecisions(state.attempts);
  return <div className="mj-decision-home">
    <div className="mj-decision-intro"><h1>练会每一手的取舍</h1><p>从看懂手牌，到看清求快与做大的分寸。</p></div>
    <div className="mj-decision-home-hand" aria-hidden="true"><Hand tiles={['2p', '3p', '4p', '4s', '5s', '9s']} /></div>
    <div className="mj-decision-start"><Button variant="primary" onClick={() => { if (!continuing) change(s => ({ ...s, session: createDecisionSession(s) })); nav(base + '/practice'); }}>{continuing ? '继续练习' : '开始练习'}</Button><span className="mj-muted">{continuing ? '接着第' + (session.index + 1) + '手' : '每组5手'}</span></div>
    {first.length > 0 && <p className="mj-decision-focus">这组重点 · {skills[focus].title}</p>}
  </div>;
}

function Metrics({ q, answer }: { q: DecisionQuestion; answer?: TileId }) {
  const selected = q.certificate.options.find(o => o.tile === answer), best = q.certificate.options.find(o => o.tile === q.certificate.recommended)!;
  const options = [best, ...(selected && selected.tile !== best.tile ? [selected] : [])], den = q.certificate.denominator;
  return <div className="mj-decision-comparison">{options.map(o => <section key={o.tile}><h3>{o.tile === best.tile ? '推荐' : '你的选择'} · {tileName(o.tile)}</h3><dl><div><dt>成牌机会</dt><dd>{percent(o.value.wins, den)}</dd></div><div><dt>平均基础分</dt><dd>{decimal(o.value.score, den)}</dd></div></dl></section>)}</div>;
}

export function DecisionMath({ q }: { q: DecisionQuestion }) {
  const result = q.shape, den = q.certificate.denominator, recommended = q.certificate.options.find(o => o.tile === q.certificate.recommended)!, fast = q.certificate.options.find(o => o.tile === q.certificate.fastest)!;
  return <div className="mj-decision-math">
    <h3>先拆开观察</h3><div className="mj-decision-groups">{q.groups.map((group,i)=><Hand key={i} tiles={group}/>)}</div><p className="mj-muted">这是观察连接的一种起点，计算会重新比较整手牌的所有成牌路线。</p><h3>这些数字怎样得来</h3>
    <p>本题还可摸{q.model.horizon}次，从{q.model.bag.length}张牌中均匀、不放回抽取。打出的牌不会回到抽牌袋；每次摸牌后重新选出下一张舍牌，首次成牌就结束。</p>
    <p>平均基础分 = 各种成牌结果的机会 × 对应的基础分，再把它们相加。未成牌记0分；0、1、2、3番分别计1、2、4、8分，超过3番仍计8分。</p>
    <p>例如，一次摸到某类牌的机会是“这类牌余量 ÷ 袋中总张数”。多次摸牌时分母和牌形都会变化，必须逐个分支计算，不能反复乘同一个概率。</p>
    <h3>推荐方案会成为什么牌</h3>
    <div className="mj-decision-fans">{recommended.value.fans.map((mass, f) => mass !== '0' && <span key={f}>{f}番 · {percent(mass, den)}</span>)}</div>
    {q.finish&&<><h3>一种可能的成牌</h3><p>{q.finish.draws.flatMap((draw,i)=>['打'+tileName(q.finish!.discarded[i]),'摸'+tileName(draw)]).join(' → ')}，可以这样成牌：</p><div className="mj-decision-groups">{q.finish.value.groups.map((group,i)=><Hand key={i} tiles={group}/>)}</div><p>{q.finish.value.items.length?q.finish.value.items.map(item=>item.label+item.fan+'番').join(' + '):'普通和型0番'}，合计{q.finish.value.fan}番，按{q.finish.value.capped}番计{q.finish.value.points}分。这只是其中一条分支，平均收益仍包含所有未成牌的路径。</p></>}
    <p className="mj-muted">这里是题设模型中的机会与基础分，不是包含对手行为、杠分和自摸加点的实战结算。</p>
    {q.certificate.fastest !== q.certificate.recommended && <><h3>如果只求快听</h3><p>打{tileName(fast.tile)}，按快听策略继续，窗口内有活口的听牌机会为{percent(fast.fast.ready, den)}，该策略的平均基础分为{decimal(fast.fast.score, den)}。主推荐按综合价值选择{tileName(recommended.tile)}。</p></>}
    <h3>整手牌的比较</h3>
    <div className="mj-decision-option-list">{q.certificate.options.map(o => { const r = result.discards.find(x => x.tile === o.tile)!; return <div className="mj-decision-option" key={o.tile}><strong>{tileName(o.tile)}{q.certificate.accepted.includes(o.tile) ? ' · 并列最优' : ''}</strong><span>{r.shanten === 0 ? '已听牌' : '距听牌' + r.shanten + '步'} · 本题改善余量{opportunityCount(q,o.tile)}张</span><span>成牌 {percent(o.value.wins, den)} · 平均 {decimal(o.value.score, den)}分</span></div>; })}</div>
    <h3>看一条后续分支</h3>
    {q.certificate.branches.filter(b => b.won || b.next.length).slice(0, 3).map(b => <p key={b.draw}>先打{tileName(b.discard)}，如果摸到{tileName(b.draw)}，{b.won ? '直接成牌。' : '下一步可打' + b.next.map(tileName).join('、') + '。'}</p>)}
    <h3>这些术语</h3><p>向听表示距离：0是听牌，1表示还需改善一次；进张是能降低这个距离的牌。边张如一二等三，嵌张如四六等五，两面如四五等三或六。局部牌形需要放回整手牌比较。</p>
    <p>快慢按窗口内首次听牌、成牌的分布计算，未完成的路径同样计入；不只对成功的路径取平均。收益策略的截断成牌时间为{decimal(recommended.value.winTime, den)}次，窗口外按第{q.model.horizon + 1}次记。</p>
    <details><summary>题目与计算版本</summary><p>{q.id}<br />{q.certificate.rules} · {q.model.version}<br />校验标识 {q.hash.slice(0, 16)}</p></details>
  </div>;
}

function Feedback({ q, answer }: { q: DecisionQuestion; answer: TileId }) {
  const selected = q.certificate.options.find(o => o.tile === answer)!, best = q.certificate.options.find(o => o.tile === q.certificate.recommended)!, accepted = q.certificate.accepted.includes(answer), close = !accepted && BigInt(selected.value.score) * 100n >= BigInt(best.value.score) * 95n;
  return <div className="mj-decision-feedback"><h2>{accepted ? '这手可以打' : close ? '很接近，再比较一下' : '这一手，推荐打'} <span>{tileName(accepted ? answer : best.tile)}</span></h2><p>{choiceEvidence(q, answer)}</p>{q.certificate.accepted.length > 1 && <p className="mj-muted">{q.certificate.accepted.map(tileName).join('、')}的平均基础分相同，都接受。</p>}<details className="mj-decision-disclosure"><summary>比较舍牌方案</summary><Metrics q={q} answer={answer} /><p>{q.note}</p></details><details className="mj-decision-disclosure"><summary>算给我看</summary><DecisionMath q={q} /></details></div>;
}

export function DecisionPractice() {
  const { state, change } = useDecision();
  useEffect(() => { if (!state.session) change(s => s.session ? s : { ...s, session: createDecisionSession(s) }); }, [state.session]);
  return state.session ? <Session key={state.session.id} session={state.session} /> : <AIActivity>准备这一手…</AIActivity>;
}
function Session({ session }: { session: DecisionSession }) {
  const { state, change, base, paused, openHabits, notice } = useDecision(), [help, setHelp] = useState(false), [revealed, setRevealed] = useState(false), lock = useRef(false), heading = useRef<HTMLHeadingElement>(null), helpTrigger = useRef<HTMLButtonElement>(null), elapsed = useActiveTime(session.id + ':' + session.index, paused || help || session.submitted || session.index === 5);
  const patch = (p: Partial<DecisionSession>) => change(s => s.session?.id === session.id ? { ...s, session: { ...s.session, ...p } } : s);
  useEffect(() => { lock.current = false; heading.current?.focus(); setRevealed(false); }, [session.index]);
  if (session.index === 5) {
    const attempts = session.attemptIds.map(id => state.attempts.find(a => a.id === id)!), focus = focusSkill(state), perfect = attempts.every(a => a.correct && !a.assisted);
    return <div className="mj-decision-finish"><p className="mj-muted">这一组完成了</p><h1>把刚才的取舍，带到下一手</h1><p>{perfect ? '这一组都保留了最好的题设收益。' : '需要再比较的牌形，会在之后穿插回来。'}</p><p>接下来 · {skills[focus].title}</p><div className="mj-actions"><Button variant="primary" onClick={() => change(s => ({ ...s, session: createDecisionSession(s) }))}>继续练习</Button><Button variant="ghost" onClick={openHabits}>我的习惯</Button></div>{state.recommendation.level === 4 && !state.allowDeep && <Button variant="ghost" onClick={() => change(s => { const next = { ...s, manualLevel: 4, allowDeep: true }; return { ...next, session: createDecisionSession(next) }; })}>挑战更难</Button>}</div>;
  }
  let q: DecisionQuestion; try { q = decisionQuestion(session.questions[session.index]); } catch { return <InlineNotice title="这组练习无法恢复" actions={<Button onClick={() => change(s => ({ ...s, session: createDecisionSession(s) }))}>重新开始</Button>} />; }
  const answer = session.selected === null ? undefined : q.context.hand[session.selected], example = decisionQuestions.find(x => x.level === q.level && x.pool === 'example')!;
  const submit = () => {
    if (!answer || session.submitted || lock.current) return; lock.current = true;
    const input = { id: crypto.randomUUID(), questionId: q.id, answer, assisted: session.assisted, durationMs: elapsed(), at: new Date().toISOString(), review: false };
    try { change(s => { if (s.session?.id !== session.id || s.session.submitted || s.session.index !== session.index) return s; const updated = recordDecision(s, input); return { ...updated, session: { ...s.session, submitted: true, attemptIds: [...s.session.attemptIds, input.id] } }; }); } catch (e) { lock.current = false; notice((e as Error).message); }
  };
  return <div className="mj-decision-practice"><div className="mj-decision-questionbar"><AppLink to={base + '/'}>← 练习</AppLink><span>{state.attempts.some(a=>a.family===q.family&&!session.attemptIds.includes(a.id))?'复习 · ':''}{session.index + 1} / 5</span></div><div className="mj-decision-questiontitle"><h1 ref={heading} tabIndex={-1}>这一手，打哪张？</h1><Button ref={helpTrigger} variant="ghost" size="sm" onClick={() => setHelp(true)}>看个例子</Button></div><p className="mj-decision-window">接下来摸{q.model.horizon}次</p>
    <Hand tiles={q.context.hand} onSelect={session.submitted ? undefined : (_, i) => patch({ selected: i })} selectedIndex={session.selected ?? -1} /><Conditions q={q} />
    {!session.submitted ? <><div className="mj-decision-answer"><Button variant="primary" disabled={!answer} onClick={submit}>{answer ? '打掉' + tileName(answer) : '选一张牌'}</Button><Button variant="ghost" onClick={() => patch({ assisted: true })} disabled={session.assisted}>一点提示</Button></div>{session.assisted && <InlineNotice title={q.note} />}</> : <section aria-live="polite"><Feedback q={q} answer={answer!} /><Button variant="primary" onClick={() => patch({ index: session.index + 1, selected: null, assisted: false, submitted: false })}>{session.index === 4 ? '完成这一组' : '下一手'}</Button></section>}
    <Dialog open={help} onClose={() => setHelp(false)} presentation="sheet" title="先看一手" onCloseAutoFocus={e => { if (helpTrigger.current?.isConnected) { e.preventDefault(); helpTrigger.current.focus(); } }} footer={<Button variant="primary" onClick={() => setHelp(false)}>回去试试</Button>}><div className="mj-decision-guide"><p>选出要打掉的牌，比较本题摸牌次数内，成牌机会与牌型分值的综合结果。</p><Hand tiles={example.context.hand} selected={revealed ? example.certificate.accepted : []} /><Button variant="ghost" onClick={() => setRevealed(true)}>看看怎样选</Button>{revealed && <><p>这手可打{example.certificate.accepted.map(tileName).join('、')}。{example.note}</p><details><summary>展开计算</summary><DecisionMath q={example} /></details></>}<h3>先认识一个连接</h3><div className="mj-decision-mini"><Hand tiles={['4s', '5s']} /><span>可以接三条或六条</span></div><p>四五是两面；四六等五是嵌张；一二等三是边张。它们只是局部连接，最后仍要放回整手牌，比较距离、余量与番数。</p></div></Dialog>
  </div>;
}

function Evidence({ ids, state }: { ids: string[]; state: DecisionState }) {
  const records = ids.map(id => state.attempts.find(a => a.id === id)).filter(a => !!a);
  return <details className="mj-decision-disclosure"><summary>查看题目证据</summary>{records.map(a => { const q = decisionQuestion(a.questionId); return <div className="mj-decision-evidence" key={a.id}><p>{skills[q.skill].title} · 选择{tileName(a.answer)}</p><Hand tiles={q.context.hand} /><p>{choiceEvidence(q, a.answer)}</p></div>; })}</details>;
}

export function Habits({ open, onClose }: { open: boolean; onClose(): void }) {
  const { state, data, change, update, client, trainingClient, profileClient, notice } = useDecision(), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), first = independentDecisions(state.attempts), facts = decisionFacts(state), stats = decisionStats(state), latest = state.reports.at(-1), focus = focusSkill(state);
  const generate = async () => {
    setConfirm(false); setBusy(true); setError('');
    try { const report = await client.generate(decisionSnapshot(state, data.training?.attempts.length ? trainingSnapshot(data.training) : undefined)); validateDecisionProfile(report.profile); const allowed = new Set(state.attempts.map(a => a.id)); if (report.profile.evidenceIds.some(id => !allowed.has(id)) || report.profile.facts.some(f => f.evidenceIds.some(id => !allowed.has(id)))) throw new Error('学习建议引用了当前记录以外的题目。'); change(s => report.profile.evidenceIds.every(id => s.attempts.some(a => a.id === id)) ? ({ ...s, reports: [...s.reports.filter(p => p.reportId !== report.reportId), report] }) : s); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <><Dialog open={open} onClose={onClose} presentation="sheet" title="我的习惯"><div className="mj-decision-habits"><p>{first.length ? '已经独立比较了' + first.length + '种牌形。' : '先独立试一手，再看看自己的取舍。'}</p>{facts.length ? facts.slice(0, 2).map(f => <section key={f.id}><p>{f.text}</p><Evidence ids={f.evidenceIds} state={state} /></section>) : first.length > 0 && <p className="mj-muted">还在了解你的选择，暂不判断稳定习惯。</p>}<h3>下一组重点</h3><p>{skills[focus].title}</p><p>{skills[focus].tip}</p><Button disabled={!first.length || busy} onClick={() => setConfirm(true)}>请AI分析这段练习</Button>{busy && <AIActivity>正在整理你的取舍…</AIActivity>}<ErrorNotice message={error} />{latest && <section className="mj-decision-coaching"><p>{latest.profile.summary}</p>{latest.profile.facts.map(f => <div key={f.id}><p>{f.text}</p><Evidence ids={f.evidenceIds} state={state} /></div>)}<AIResponse content={latest.profile.suggestion} responseId={latest.reportId} /><Evidence ids={latest.profile.evidenceIds} state={state} /><details><summary>这份建议的依据与范围</summary>{latest.profile.uncertainties.map((u, i) => <p key={i}>{u}</p>)}</details><Button variant="ghost" size="sm" onClick={async () => { try { await client.remove(latest.reportId); change(s => ({ ...s, reports: s.reports.filter(p => p.reportId !== latest.reportId) })); } catch (e) { notice((e as Error).message); } }}>删除这份建议</Button></section>}
    <details className="mj-decision-disclosure"><summary>详细练习数据</summary>{stats.map(s => <section key={[s.skill, s.level, s.kind, s.horizon].join(':')}><h3>{skills[s.skill].title} · {levels[s.level - 1]}</h3><p>{s.horizon}次摸牌 · {s.kind === 'remaining' ? '全部余牌' : '指定抽牌袋'} · {s.status}</p><p>{s.correct} / {s.count}道首次独立作答达到最高期望基础分；95%区间{(s.interval![0] * 100).toFixed(0)}%—{(s.interval![1] * 100).toFixed(0)}%。</p>{s.medianTime !== null && <p>本类独立正确作答的有效用时中位数：{(s.medianTime / 1000).toFixed(1)}秒。</p>}<Evidence ids={s.evidenceIds} state={state} /></section>)}{reviewOutcomes(state).map(r=><p key={r.id}>{skills[r.skill].title} · 至少间隔24小时的复习：{r.count}种牌形中，{r.correct}种最近一次答对。</p>)}<p className="mj-muted">不同难度、摸牌条件分别统计。提示和复习不增加独立样本；区间只描述这些练习，不换算成实战能力。</p></details>
    <details className="mj-decision-disclosure"><summary>历史记录与建议</summary><p>旧版原始作答、课程与草稿仍可导出。旧牌效记录不换算为计番和综合收益结论。</p>{state.reports.slice(0, -1).map(p => <section key={p.reportId}><p>{p.profile.summary}</p><p>{p.profile.suggestion}</p><Button variant="ghost" size="sm" onClick={async () => { try { await client.remove(p.reportId); change(s => ({ ...s, reports: s.reports.filter(x => x.reportId !== p.reportId) })); } catch (e) { notice((e as Error).message); } }}>删除建议</Button></section>)}{data.training?.reports.map(p => <section key={p.reportId}><p>{p.profile.summary}</p><p>{p.profile.suggestion}</p><div className="mj-actions"><Button size="sm" onClick={async () => { try { const r = await trainingClient.read(p.reportId); update(d => ({ ...d, training: d.training ? { ...d.training, reports: d.training.reports.map(x => x.reportId === p.reportId ? { ...x, ...r } : x) } : undefined })); notice('已读取原报告。'); } catch (e) { notice((e as Error).message); } }}>读取原报告</Button><Button size="sm" onClick={async () => { try { await trainingClient.remove(p.reportId); update(d => ({ ...d, training: d.training ? { ...d.training, reports: d.training.reports.filter(x => x.reportId !== p.reportId) } : undefined })); notice('原报告已删除。'); } catch (e) { notice((e as Error).message); } }}>删除原报告</Button></div></section>)}{data.profiles.map(p => <section key={p.reportId}><p>{p.profile.summary}</p><Button size="sm" onClick={async () => { try { await profileClient.remove(p.reportId); update(d => ({ ...d, profiles: d.profiles.filter(x => x.reportId !== p.reportId) })); notice('原画像已删除。'); } catch (e) { notice((e as Error).message); } }}>删除原画像</Button></section>)}</details>
  </div></Dialog><Dialog open={confirm} onClose={() => setConfirm(false)} title="整理这段练习？" description="将上传全部相关作答，核验后请本站模型给出建议。" footer={<><Button onClick={() => setConfirm(false)}>取消</Button><Button variant="primary" onClick={generate}>上传并分析</Button></>}><p>只用题目证据解释取舍。报告保存90天，可随时删除。</p></Dialog></>;
}

export function Rules({ open, onClose }: { open: boolean; onClose(): void }) {
  return <Dialog open={open} onClose={onClose} presentation="sheet" title="怎样比较这一手"><div className="mj-decision-guide"><p>只练缺门后的条、筒舍牌。普通成牌是四组面子加一对将；七对也可成牌。</p><h3>推荐怎样产生</h3><p>每题规定未来摸牌次数与可摸牌。均匀、不放回抽取，每次摸牌后重新选择舍牌，首次成牌就结束。比较这个窗口内的平均基础分。</p><Table density="compact"><TableHead><TableRow><TableHeaderCell>番型</TableHeaderCell><TableHeaderCell>番数</TableHeaderCell></TableRow></TableHead><TableBody>{[['普通和型','0'],['每一根（四张同牌）','+1'],['碰碰胡','+1'],['金钩钓','+1（另计碰碰胡）'],['清一色','+2'],['七对','+2']].map(([name,value])=><TableRow key={name}><TableCell>{name}</TableCell><TableCell>{value}</TableCell></TableRow>)}</TableBody></Table><p>三番封顶，基础分为1、2、4、8分。四张同牌可算两对并加一根；龙七对不重复添加另一项番。金钩钓需要四组已经固定的碰杠。</p><p>题目只包含已固定碰杠，后续不新增碰杠，也不计算杠分、自摸加点、特殊事件番和对手结算。</p><h3>听牌、向听和进张</h3><p>听牌是再来一张合适的牌就能成牌。向听0是听牌，1表示还需改善一次；进张是能降低向听的牌。见尽牌不计入可摸机会。</p><p>两花色72张是本工具的训练约定。<RecordLink actionId="mahjong.rule-source" href={RULE_SOURCE} target="_blank" rel="noreferrer">查看MIL四川规则依据 ↗</RecordLink></p></div></Dialog>;
}
