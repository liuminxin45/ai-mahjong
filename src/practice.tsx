import { useMemo, useState } from 'react';
import { Button, Select, InlineNotice, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from 'chatgpt-desktop-kit';
import { useSearchParams } from 'react-router';
import { analyze, sorted, TILES, tileName, type TileId } from './engine/index.js';
import { answers, exercise, grade, lessons, MODE_NAMES, MODES, QUIZ_MODES, solutionText, type Attempt, type ExerciseRef, type Mode } from './learning/index.js';
import { localDate, recordAttempt } from './learning/storage.js';
import { AppLink, Hand, Tile, useActiveTime, useLearning } from './ui.js';
type Draft={seed:number;selected:TileId[];submitted:boolean;hint:boolean};
const fresh=(seed=0):Draft=>({seed,selected:[],submitted:false,hint:false});
export function ResultDetails({refValue}:{refValue:ExerciseRef}){
  const q=useMemo(()=>exercise(refValue),[refValue.mode,refValue.seed]);const r=useMemo(()=>analyze(q.context),[q]);
  return <section className="mj-explanation"><h2>拆开看这一手</h2><p>{solutionText(q)}</p><p className="mj-muted">可接受答案</p><Hand tiles={answers(q)}/>{r.discards.length>0&&<details><summary>比较全部舍牌方案</summary><DiscardTable result={r}/></details>}<AppLink to={'../manual/'+q.lessonId}>阅读关联课程 →</AppLink></section>;
}
export function DiscardTable({result}:{result:ReturnType<typeof analyze>}){
  return <div className="mj-table-wrap"><Table density="compact"><TableHead><TableRow><TableHeaderCell>舍牌</TableHeaderCell><TableHeaderCell>向听</TableHeaderCell><TableHeaderCell>进张</TableHeaderCell><TableHeaderCell>有效牌种</TableHeaderCell></TableRow></TableHead><TableBody>{result.discards.map(d=><TableRow key={d.tile}><TableCell>{tileName(d.tile)}{d.best?' · 最优':''}</TableCell><TableCell>{d.shanten}</TableCell><TableCell>{d.ukeire}张</TableCell><TableCell>{d.improvements.map(t=>tileName(t.tile)+'×'+t.remaining).join('、')||'无'}</TableCell></TableRow>)}</TableBody></Table></div>;
}
export function PracticePage(){
  const [params,setParams]=useSearchParams();const raw=params.get('mode');const mode:Mode=MODES.includes(raw as Mode)?raw as Mode:'discard';
  return <div className="mj-page"><div className="mj-page-heading"><div><p className="mj-eyebrow">一次练好一个判断</p><h1>专项练习</h1></div><Select aria-label="练习类型" value={mode} options={MODES.map(value=>({value,label:MODE_NAMES[value]}))} onValueChange={v=>setParams({mode:v})}/></div><Practice key={mode+params.get('seed')} mode={mode} seedOverride={params.has('seed')?Number(params.get('seed')):undefined} review={params.get('review')==='1'}/></div>;
}
export function Practice({mode,seedOverride,review=false,quizRef,onQuizAnswer}:{mode:Mode;seedOverride?:number;review?:boolean;quizRef?:ExerciseRef;onQuizAnswer?:(a:Attempt)=>void}){
  const {data,update}=useLearning();const key=review?'review:'+mode+':'+seedOverride:'practice:'+mode;
  const initial=seedOverride!==undefined?fresh(seedOverride):(data.drafts[key] as Draft|undefined)??fresh();
  const quizSaved=(data.drafts.quiz as QuizState|undefined)?.answers.find(a=>quizRef&&a.ref.mode===quizRef.mode&&a.ref.seed===quizRef.seed);
  const [draft,setDraft]=useState<Draft>(quizRef?{...fresh(quizRef.seed),...(quizSaved?{selected:quizSaved.answer,submitted:true}:{})}:initial);
  const refValue=quizRef??{mode,seed:draft.seed};const q=useMemo(()=>exercise(refValue),[refValue.mode,refValue.seed]);const elapsed=useActiveTime(q.id);
  const change=(next:Draft)=>{setDraft(next);if(!quizRef)update(d=>({...d,drafts:{...d.drafts,[key]:next}}));};
  const multi=mode==='waits'||mode==='ukeire';const correct=draft.submitted&&grade(q,draft.selected);
  const select=(t:TileId)=>{if(draft.submitted)return;change({...draft,selected:multi?(draft.selected.includes(t)?draft.selected.filter(x=>x!==t):[...draft.selected,t]):[t]});};
  const submit=()=>{
    if(draft.submitted)return;
    const a:Attempt={id:crypto.randomUUID(),ref:refValue,answer:draft.selected,assisted:draft.hint,durationMs:elapsed(),at:new Date().toISOString(),correct:grade(q,draft.selected),exerciseId:q.id,review:review||data.attempts.some(x=>x.exerciseId===q.id)};
    update(d=>recordAttempt(d,a));change({...draft,submitted:true});onQuizAnswer?.(a);
  };
  const favorite=data.mistakes.some(m=>m.exerciseId===q.id&&m.favorite);
  return <><div className="mj-practice-layout"><section className="mj-question"><div className="mj-question-heading"><span className="mj-muted">{review?'错题复习':MODE_NAMES[mode]} · {quizRef?'测验':String(refValue.seed+1).padStart(2,'0')}</span>{!quizRef&&<Button size="sm" variant="ghost" onClick={()=>update(d=>({...d,mistakes:d.mistakes.some(m=>m.exerciseId===q.id)?d.mistakes.map(m=>m.exerciseId===q.id?{...m,favorite:!m.favorite}:m):[...d.mistakes,{ref:refValue,exerciseId:q.id,stage:0,due:localDate(),favorite:true}]}))}>{favorite?'取消收藏':'收藏这题'}</Button>}</div>
    <h2>{q.scenario?q.title:'你会怎样处理这手牌？'}</h2><p>{q.prompt}</p><Hand tiles={sorted(q.context.hand)} onSelect={!multi?select:undefined} selected={draft.selected} disabled={draft.submitted}/>
    {q.scenario&&<div className="mj-scenario"><h3>本题已知信息</h3>{q.scenario.facts.map(f=><p key={f}>{f}</p>)}<div className="mj-scenario-board">{q.scenario.rivers.map(r=><div className="mj-river" key={r.label}><span>{r.label}</span><Hand tiles={r.tiles}/></div>)}{q.scenario.publicSets.map(r=><div className="mj-river" key={r.label}><span>{r.label}</span><Hand tiles={r.tiles}/></div>)}</div><p className="mj-muted">等待集合是题设事实，不是根据牌河推算出的精确概率。</p></div>}
    {multi&&<><h3>选择全部答案</h3><div className="mj-palette">{TILES.map(t=><Tile key={t} tile={t} selected={draft.selected.includes(t)} onClick={()=>select(t)} disabled={draft.submitted}/>)}</div></>}
    {draft.hint&&!quizRef&&<InlineNotice title="提示" description={mode==='seven-pairs'?'四张相同牌算两对，分别比较丢掉单张与拆掉对子。':mode==='defense'?'先读题目目标，再检查已知等待，最后比较向听与进张。':multi?'逐一加入候选牌，尝试拆出完整和型或降低向听。':'先检查舍牌是否增加向听，再比较有效进张。'}/>}
    <div className="mj-question-actions">{!draft.submitted?<><Button variant="primary" disabled={!multi&&!draft.selected.length} onClick={submit}>提交答案</Button>{!quizRef&&<Button variant="ghost" onClick={()=>change({...draft,hint:true})}>给我一个提示</Button>}</>:quizRef?<p role="status">答案已记录。</p>:<><Button variant="primary" onClick={()=>change(fresh(draft.seed+1))}>下一题</Button><span role="status" className={correct?'mj-correct':'mj-incorrect'}>{correct?'判断正确':'再看一次解析'}{draft.hint?' · 使用过提示':''}</span></>}</div>
    {!quizRef&&!draft.submitted&&<p className="mj-muted">{multi?'可以提交空选择；答案将在提交后揭晓。':'选择一张手牌后提交。并列最优的选择都会被接受。'}</p>}</section>
    {draft.submitted&&!quizRef&&<ResultDetails refValue={refValue}/>}</div></>;
}
type QuizState={seed:number;index:number;answers:Attempt[]};
export function QuizPage(){
  const {data,update}=useLearning();const [session,setSession]=useState<QuizState|null>((data.drafts.quiz as QuizState)??null);
  const save=(s:QuizState)=>{setSession(s);update(d=>({...d,drafts:{...d.drafts,quiz:s}}));};
  if(!session)return <div className="mj-page mj-reading"><p className="mj-eyebrow">看看知识能否连起来</p><h1>20题阶段测验</h1><p>10道何切、4道听牌、2道七对、4道攻防。过程中不显示解析，不设置倒计时。</p><Button variant="primary" onClick={()=>save({seed:Math.floor(Date.now()/1000)%1000000,index:0,answers:[]})}>开始测验</Button></div>;
  if(session.index>=20){
    const missed=session.answers.filter(a=>!a.correct),recommended=[...new Set(missed.map(a=>exercise(a.ref).lessonId))];
    return <div className="mj-page"><h1>本次测验完成</h1><p>答对{session.answers.filter(a=>a.correct).length} / 20题。</p><h2>这次需要巩固的判断</h2>{MODES.filter(mode=>session.answers.some(a=>a.ref.mode===mode)).map(mode=>{const xs=session.answers.filter(a=>a.ref.mode===mode);return <div className="mj-record" key={mode}><div><strong>{MODE_NAMES[mode]}</strong><p>{xs.filter(a=>a.correct).length} / {xs.length}题正确 · {xs.every(a=>a.correct)?'本次均答对':'建议结合错题再练习'}</p></div><AppLink to={'../practice?mode='+mode}>专项练习 →</AppLink></div>;})}
      {recommended.length>0&&<><h2>从这些课程开始复习</h2><div className="mj-actions">{recommended.map(id=><AppLink key={id} to={'../manual/'+id}>{lessons.find(l=>l.id===id)?.title} →</AppLink>)}</div></>}
      <div className="mj-actions"><AppLink to="../profile">查看学习统计</AppLink><Button onClick={()=>{setSession(null);update(d=>({...d,drafts:{...d.drafts,quiz:null}}));}}>重新测验</Button></div>{session.answers.map((a,i)=><details key={a.id}><summary>第{i+1}题 · {MODE_NAMES[a.ref.mode]} · {a.correct?'正确':'待复习'}</summary><Hand tiles={exercise(a.ref).context.hand}/><ResultDetails refValue={a.ref}/></details>)}</div>;
  }
  const refValue={mode:QUIZ_MODES[session.index],seed:session.seed+session.index*23};const answered=session.answers.length>session.index;
  return <div className="mj-page"><div className="mj-page-heading"><h1>阶段测验</h1><span>{session.index+1} / 20</span></div><Practice key={session.index} mode={refValue.mode} quizRef={refValue} onQuizAnswer={a=>save({...session,answers:[...session.answers,a]})}/>{answered&&<Button variant="primary" onClick={()=>save({...session,index:session.index+1})}>{session.index===19?'查看测验结果':'下一题'}</Button>}</div>;
}
export function ReviewPage(){
  const {data}=useLearning();const [filter,setFilter]=useState('due'),[topic,setTopic]=useState('all');const list=data.mistakes.filter(m=>(topic==='all'||m.ref.mode===topic)&&(filter==='all'||filter==='favorite'&&m.favorite||filter==='due'&&m.due<=localDate()));
  return <div className="mj-page mj-reading"><div className="mj-page-heading"><div><p className="mj-eyebrow">把知道变成会用</p><h1>错题复习</h1></div><Select aria-label="复习范围" value={filter} onValueChange={setFilter} options={[{value:'due',label:'今天待复习'},{value:'all',label:'全部记录'},{value:'favorite',label:'收藏题'}]}/></div><div className="mj-actions"><Select aria-label="复习知识点" value={topic} onValueChange={setTopic} options={[{value:'all',label:'全部知识点'},...MODES.map(value=>({value,label:MODE_NAMES[value]}))]}/></div><p>答对后按1、3、7天安排复习，重做不增加独立样本数。</p>{list.length===0?<p className="mj-empty">这里暂时没有题目。完成练习后，错误、提示题和收藏会出现在这里。</p>:list.map(m=><div className="mj-record" key={m.exerciseId}><div><strong>{exercise(m.ref).title}</strong><p>{m.favorite?'已收藏 · ':''}复习阶段{m.stage} · {m.due}</p></div><AppLink to={'../practice?mode='+m.ref.mode+'&seed='+m.ref.seed+'&review=1'}>重新练习</AppLink></div>)}</div>;
}

