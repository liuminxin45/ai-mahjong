import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, InlineNotice, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from 'chatgpt-desktop-kit';
import { setTiles, sorted, TILES, type TileId } from './engine/index.js';
import { competitionPapers, type CompetitionBoard, type CompetitionPaper, type CompetitionRun } from './learning/competition.js';
import { DIFFICULTY_NAMES } from './learning/curriculum.js';
import { recordAttempt, type LearningData } from './learning/storage.js';
import { AppLink, ErrorNotice, Hand, Tile, useLearning } from './ui.js';
import { ResultDetails } from './practice.js';

export const durationLabel=(ms:number,precise=false)=>{const s=Math.max(0,Math.floor(ms/1000)),fraction=precise?'.'+String(Math.max(0,Math.floor(ms))%1000).padStart(3,'0'):'';return `${Math.floor(s/3600)?Math.floor(s/3600)+'小时':''}${Math.floor(s/60)%60}分${s%60}${fraction}秒`;};
export function LeaderboardPage(){
 const {data,update,competitionClient:client}=useLearning();
 const [papers,setPapers]=useState<CompetitionPaper[]>(competitionPapers),[paperId,setPaperId]=useState(competitionPapers[0].id),[board,setBoard]=useState<CompetitionBoard|null>(null),[offset,setOffset]=useState(0);
 const [run,setRun]=useState<CompetitionRun|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(false),[consent,setConsent]=useState(false),[abandon,setAbandon]=useState(false),[resumeId,setResumeId]=useState(''),[lostRun,setLostRun]=useState(false);
 const [judgmentSelected,setJudgmentSelected]=useState(false);
 const [selection,setSelection]=useState<TileId[]>([]),[selectedIndex,setSelectedIndex]=useState<number|undefined>(),[tick,setTick]=useState(0);
 const clock=useRef({server:0,received:0}),mounted=useRef(true),boardRequest=useRef(0),pendingIndex=useRef(-1);
 const saved=data.drafts['competition-run'] as string|undefined;
 const accept=(next:CompetitionRun)=>{
  clock.current={server:Date.parse(next.serverNow),received:performance.now()};setRun(next);setLostRun(false);setSelection([]);setJudgmentSelected(false);setSelectedIndex(undefined);
  update(d=>{let nextData:LearningData={...d,drafts:{...d.drafts,'competition-run':next.runId,'competition-start':null}};
   if(next.status==='complete')for(const a of next.attempts??[])if(!nextData.attempts.some(x=>x.id===a.id))nextData=recordAttempt(nextData,a);
   return nextData;
  });
 };
 const loadBoard=async(id=paperId,start=offset)=>{const seq=++boardRequest.current;try{const b=await client.board(id,start);if(mounted.current&&seq===boardRequest.current){setBoard(b);setOnline(true);}}catch(e){if(mounted.current&&seq===boardRequest.current){setError((e as Error).message);if((e as Error&{code?:string;status?:number}).code==='UNAVAILABLE'&&(e as Error&{status?:number}).status===404)setLostRun(true);setBoard(null);}}};
 const resume=async(id=saved)=>{if(!id)return;setBusy(true);setError('');try{const next=await client.resume(id);accept(next);setPaperId(next.paperId);setResumeId('');setOnline(true);}catch(e){setError((e as Error).message);if((e as Error&{code?:string;status?:number}).code==='UNAVAILABLE'&&(e as Error&{status?:number}).status===404)setLostRun(true);}finally{setBusy(false);}};
 useEffect(()=>{mounted.current=true;let live=true;
  client.papers().then(xs=>{if(live){setPapers(xs);setOnline(true);}}).catch(e=>{if(live)setError(e.message);});
  if(saved)void resume(saved);
  return()=>{live=false;mounted.current=false;};
 },[client]);
 useEffect(()=>{setBoard(null);void loadBoard();},[paperId,offset,client]);
 useEffect(()=>{if(run?.status!=='active')return;const timer=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(timer);},[run?.runId,run?.status]);
 const start=async()=>{setConsent(false);setBusy(true);setError('');
  const old=data.drafts['competition-start'] as {paperId:string;requestId:string}|undefined;
  const requestId=old?.paperId===paperId?old.requestId:crypto.randomUUID();update(d=>({...d,drafts:{...d.drafts,'competition-start':{paperId,requestId}}}));
  try{accept(await client.start(paperId,requestId));setOnline(true);}catch(e){setError((e as Error).message);if((e as Error&{code?:string;status?:number}).code==='UNAVAILABLE'&&(e as Error&{status?:number}).status===404)setLostRun(true);setResumeId((e as Error&{runId?:string}).runId??'');}finally{setBusy(false);}
 };
 const submit=async()=>{if(!run||pendingIndex.current===run.index)return;pendingIndex.current=run.index;setBusy(true);setError('');
  try{const next=await client.answer(run.runId,run.index,selection);accept(next);if(next.status==='complete')void loadBoard(next.paperId,0);}catch(e){setError((e as Error).message);if((e as Error&{code?:string;status?:number}).code==='UNAVAILABLE'&&(e as Error&{status?:number}).status===404)setLostRun(true);}finally{pendingIndex.current=-1;setBusy(false);}
 };
 const quit=async()=>{if(!run)return;setBusy(true);try{await client.abandon(run.runId);setRun(null);setAbandon(false);update(d=>({...d,drafts:{...d.drafts,'competition-run':null}}));}catch(e){setError((e as Error).message);if((e as Error&{code?:string;status?:number}).code==='UNAVAILABLE'&&(e as Error&{status?:number}).status===404)setLostRun(true);}finally{setBusy(false);}};
 const q=run?.question,judgment=q?.metadata?.response==='judgment',multi=q&&['waits','ukeire'].includes(q.ref.mode),hand=q?sorted(q.context.hand):[];
 const select=(tile:TileId,index?:number)=>{setSelection(previous=>multi?previous.includes(tile)?previous.filter(t=>t!==tile):[...previous,tile]:[tile]);if(!multi)setSelectedIndex(index);};
 const elapsed=run?run.status==='complete'?run.durationMs??0:Math.max(0,clock.current.server-Date.parse(run.startedAt)+performance.now()-clock.current.received):0;
 return <div className="mj-page"><p className="mj-eyebrow">同卷挑战 · 匿名参赛</p><h1>排行榜</h1><p>每个难度固定20题，何切、进张、听牌、七对、攻防各4题。每题5分，完整交卷后按得分、总用时排名；可以反复挑战，保留最好成绩。</p>
  <ErrorNotice message={error}/>{lostRun&&<Button onClick={()=>{setRun(null);setLostRun(false);update(d=>({...d,drafts:{...d.drafts,'competition-run':null}}));}}>移除本地失效答卷入口</Button>}{resumeId&&<Button onClick={()=>void resume(resumeId)} disabled={busy}>恢复现有挑战</Button>}
  {run?.status==='active'&&q?<section className="mj-question">
   <div className="mj-page-heading"><h2>{papers.find(p=>p.id===run.paperId)?.title??'进行中的挑战'} · {run.index+1}/20</h2><span role="timer" aria-live="off">{durationLabel(elapsed)}</span></div><p className="mj-muted">服务端连续计时，后台与断网均计入。提交后不能改答案，结束后统一展示解析。</p><h3>{q.title}</h3><p>{q.prompt}</p>
   <Hand tiles={hand} selected={selection} selectedIndex={!multi?selectedIndex??-1:undefined} onSelect={!multi&&!judgment?select:undefined} disabled={busy}/>
   {!!q.context.fixedSets?.length&&<div className="mj-public-groups">{q.context.fixedSets.map((s,i)=><div key={i}><span>自己的{s.kind==='quad'?'杠':'碰'}</span><Hand tiles={setTiles(s)}/></div>)}</div>}
   {q.context.visible&&!q.scenario&&<p>其他可见牌：{Object.entries(q.context.visible).map(([tile,n])=>`${tile}×${n}`).join('、')}</p>}
   {q.scenario&&<section className="mj-scenario"><h3>已知条件</h3>{q.scenario.facts.map(f=><p key={f}>{f}</p>)}{q.scenario.rivers.map(r=><div key={r.label}><span>{r.label}</span><Hand tiles={r.tiles}/></div>)}</section>}
   {q.model&&<section><h3>本题完整抽牌袋</h3><Hand tiles={q.model.bag}/><p>未来{q.model.horizon}次均匀不放回摸打，无对手行动；目标为{q.model.target==='seven-pairs'?'七对成牌':'普通型或七对成牌'}。</p></section>}
   {judgment&&<div className="mj-actions"><Button disabled={busy} aria-pressed={judgmentSelected&&selection.length===1} onClick={()=>{setSelection([q!.metadata!.judgmentTile!]);setJudgmentSelected(true);}}>题设足以保证</Button><Button disabled={busy} aria-pressed={judgmentSelected&&selection.length===0} onClick={()=>{setSelection([]);setJudgmentSelected(true);}}>信息不足，无法保证</Button></div>}{multi&&<><h3>选择全部答案</h3><div className="mj-palette">{TILES.map(tile=><Tile key={tile} tile={tile} selected={selection.includes(tile)} onClick={()=>select(tile)} disabled={busy}/>)}</div></>}
   <div className="mj-actions"><Button variant="primary" disabled={busy||(!multi&&!selection.length&&!(judgment&&judgmentSelected))} onClick={submit}>{run.index===19?'提交并交卷':'提交并进入下一题'}</Button><Button disabled={busy} onClick={()=>void resume(run.runId)}>恢复服务器进度</Button><Button variant="ghost" disabled={busy} onClick={()=>setAbandon(true)}>放弃本次挑战</Button></div>
  </section>:<>
   {run?.status==='complete'&&<section><h2>本次挑战完成 · {run.score}分</h2><p>服务端总用时：{durationLabel(run.durationMs??0,true)}。最好成绩按分数优先、同分用时短优先更新。</p><div className="mj-actions"><Button onClick={()=>{setRun(null);update(d=>({...d,drafts:{...d.drafts,'competition-run':null}}));}}>收起本次结果</Button><AppLink to="../profile">查看学习画像</AppLink></div><details><summary>逐题查看答案与解析</summary>{run.attempts?.map((a,i)=><details key={a.id}><summary>第{i+1}题 · {a.correct?'正确':'待复习'}</summary><ResultDetails refValue={a.ref}/></details>)}</details></section>}
   {run&&['expired','abandoned'].includes(run.status)&&<InlineNotice title={run.status==='expired'?'这次挑战已超过24小时有效期':'这次挑战已放弃'} description="没有加入排行榜；可以开始新的挑战。"/>}
   <div className="mj-actions"><Select aria-label="比赛难度" value={paperId} options={papers.map(p=>({value:p.id,label:`${DIFFICULTY_NAMES[p.difficulty]} · ${p.archived?'归档 '+p.version:'20题'}`}))} onValueChange={id=>{setPaperId(id);setOffset(0);setError('');}}/><Button variant="primary" disabled={busy||!online||papers.find(p=>p.id===paperId)?.archived} onClick={()=>setConsent(true)}>开始挑战</Button><Button disabled={busy} onClick={()=>void loadBoard()}>刷新排名</Button></div>
   {saved&&!run&&<Button onClick={()=>void resume(saved)} disabled={busy}>恢复上次答卷</Button>}
   {!online&&<p className="mj-muted">排行榜需要本站在线服务。<AppLink to="../practice">继续本地专项练习 →</AppLink></p>}
  </>}
  <section>{board?.archived&&<p className="mj-muted">这份试卷已归档，成绩仅供回看，不开放新挑战。</p>}<h2>{papers.find(p=>p.id===paperId)?.title??'挑战'}排名</h2>{board?.mine&&<p>本浏览器最好成绩：第{board.mine.rank}名，{board.mine.score}分，{durationLabel(board.mine.durationMs,true)}。</p>}{board?.entries.length?<div className="mj-table-wrap"><Table density="compact"><TableHead><TableRow><TableHeaderCell>名次</TableHeaderCell><TableHeaderCell>匿名牌友</TableHeaderCell><TableHeaderCell>得分</TableHeaderCell><TableHeaderCell>用时</TableHeaderCell></TableRow></TableHead><TableBody>{board.entries.map(e=><TableRow key={e.publicId}><TableCell>{e.rank}</TableCell><TableCell>{e.alias}{e.mine?' · 本人':''}</TableCell><TableCell>{e.score}</TableCell><TableCell>{durationLabel(e.durationMs,true)}</TableCell></TableRow>)}</TableBody></Table><div className="mj-actions"><Button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>上一页</Button><span>{board.total}位浏览器访客</span><Button disabled={offset+50>=board.total} onClick={()=>setOffset(offset+50)}>下一页</Button></div></div>:<p className="mj-muted">{board?'还没有完整交卷的成绩。':'正在读取或等待比赛服务恢复。'}</p>}</section>
  <p className="mj-muted">身份仅属于当前浏览器，无账号。清理本站Cookie或更换浏览器会成为新访客；匿名开放榜无法保证真人唯一性或排除外部计算。普通练习仍默认保存在本地。</p>
  <Dialog open={consent} onClose={()=>setConsent(false)} title="开始匿名挑战" description="参赛会把本次选择提交到本站服务端，使用本站签名访客身份记录成绩，并公开匿名代号、最好分数与用时。没有提示；从开赛起连续计时，切后台和断网也计入，24小时内可恢复答卷。" footer={<><Button onClick={()=>setConsent(false)}>取消</Button><Button variant="primary" onClick={start}>开始并计时</Button></>}/>
  <Dialog open={abandon} onClose={()=>setAbandon(false)} title="放弃本次挑战？" description="这次答卷不计入排行榜，之前的最好成绩保留。" footer={<><Button onClick={()=>setAbandon(false)}>继续答题</Button><Button variant="danger" onClick={quit} disabled={busy}>放弃本次挑战</Button></>}/>
 </div>;
}
