import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, InlineNotice, RecordRow, Select } from 'chatgpt-desktop-kit';
import { setTiles, sorted, TILES, tileName, type TileId } from './engine/index.js';
import { competitionPapers, type CompetitionBoard, type CompetitionPaper, type CompetitionRun } from './learning/competition.js';
import { DIFFICULTY_NAMES } from './learning/curriculum.js';
import { MODE_NAMES } from './learning/index.js';
import { recordAttempt } from './learning/storage.js';
import { CompetitionSession, pendingCompetition, restoreCompetitionChoice, sameCompetitionQuestion, type CompetitionChoice, type PendingCompetition } from './competition-session.js';
import { AppLink, ErrorNotice, Hand, Tile, useLearning } from './ui.js';
import { ResultDetails } from './practice.js';

export const durationLabel=(ms:number,precise=false)=>{const s=Math.max(0,Math.floor(ms/1000)),fraction=precise?'.'+String(Math.max(0,Math.floor(ms))%1000).padStart(3,'0'):'';return `${Math.floor(s/3600)?Math.floor(s/3600)+'小时':''}${Math.floor(s/60)%60}分${s%60}${fraction}秒`;};

const rankingTime=(ms:number)=>{const total=Math.max(0,Math.floor(ms)),seconds=Math.floor(total/1000);return (seconds>=3600?Math.floor(seconds/3600)+':'+String(Math.floor(seconds/60)%60).padStart(2,'0'):Math.floor(seconds/60))+':'+String(seconds%60).padStart(2,'0')+'.'+String(total%1000).padStart(3,'0');};

export function LeaderboardPage(){
 const {data,update,competitionClient:client}=useLearning();
 const session=useMemo(()=>new CompetitionSession(client),[client]);
 const [papers,setPapers]=useState<CompetitionPaper[]>(competitionPapers),[paperId,setPaperId]=useState(competitionPapers[0].id),[board,setBoard]=useState<CompetitionBoard|null>(null),[offset,setOffset]=useState(0);
 const [run,setRun]=useState<CompetitionRun|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(false),[network,setNetwork]=useState(()=>typeof navigator==='undefined'||navigator.onLine),[consent,setConsent]=useState(false),[restart,setRestart]=useState(false);
 const [boardError,setBoardError]=useState('');
 const [judgmentSelected,setJudgmentSelected]=useState(false),[selection,setSelection]=useState<TileId[]>([]),[selectedIndex,setSelectedIndex]=useState<number>();
 const [,setTick]=useState(0),clock=useRef({server:0,received:0}),mounted=useRef(true),boardRequest=useRef(0),recovering=useRef(false),runRef=useRef<CompetitionRun|null>(null);
 const saved=useRef(typeof data.drafts['competition-run']==='string'?data.drafts['competition-run']:null),pending=useRef(pendingCompetition(data.drafts['competition-start']));
 const choice=useRef<unknown>(data.drafts['competition-selection']);
 const currentPaper=useRef(paperId),currentOffset=useRef(offset);currentPaper.current=paperId;currentOffset.current=offset;
 const savePending=(value:PendingCompetition|null)=>{pending.current=value;update(d=>({...d,drafts:{...d.drafts,'competition-start':value}}));};
 const accept=(next:CompetitionRun)=>{
  if(!mounted.current)return;
  if(!sameCompetitionQuestion(runRef.current,next)){const restored=restoreCompetitionChoice(next,choice.current);setSelection(restored?.selected??[]);setJudgmentSelected(restored?.judgmentSelected??false);setSelectedIndex(restored?.selectedIndex);choice.current=restored;}
  clock.current={server:Date.parse(next.serverNow),received:performance.now()};runRef.current=next;setRun(next);setPaperId(next.paperId);setError('');setOnline(true);pending.current=null;
  saved.current=['active','complete'].includes(next.status)?next.runId:null;
  update(d=>{
   let result=d;
   if(d.drafts['competition-run']!==saved.current||d.drafts['competition-start']||d.drafts['competition-selection']!==choice.current)result={...d,drafts:{...d.drafts,'competition-run':saved.current,'competition-start':null,'competition-selection':choice.current}};
   if(next.status==='complete')for(const a of next.attempts??[])if(!result.attempts.some(x=>x.id===a.id))result=recordAttempt(result,a);
   return result;
  });
 };
 const fail=(e:unknown)=>{
  if(!mounted.current)return;
  const failure=e as Error&{status?:number;code?:string};
  if(failure.code==='UNAVAILABLE'&&failure.status===404){saved.current=null;pending.current=null;choice.current=null;runRef.current=null;setRun(null);update(d=>({...d,drafts:{...d.drafts,'competition-run':null,'competition-start':null,'competition-selection':null}}));setError('上次比赛已无法继续，可以重新挑战。');}
  else setError(/fetch|network|load failed|连接|超时/i.test(failure.message)?'连接中断，恢复后会自动继续。':failure.message);
 };
 const loadBoard=async(id=currentPaper.current,start=currentOffset.current)=>{
  const seq=++boardRequest.current;
  try{const next=await client.board(id,start);if(mounted.current&&seq===boardRequest.current){setBoard(next);setOnline(true);setBoardError('');}}
  catch(e){if(mounted.current&&seq===boardRequest.current){setBoard(null);setBoardError((e as Error).message);}}
 };
 const recover=async(foreground=false)=>{
  if(recovering.current||session.busy||!navigator.onLine)return;
  const draft=pending.current,id=saved.current;if(!draft&&!id)return;
  const blocking=foreground||!!draft;recovering.current=true;if(blocking)setBusy(true);
  try{const next=draft?await session.start(draft):await session.restore(id!);if(next)accept(next);}
  catch(e){fail(e);}finally{recovering.current=false;if(mounted.current&&blocking)setBusy(false);}
 };
 useEffect(()=>{
  mounted.current=true;let live=true;
  client.papers().then(next=>{if(live){setPapers(next);setOnline(true);}}).catch(e=>{if(live)setBoardError(e.message);});
  void recover(true);
  const sync=()=>{if(document.visibilityState!=='hidden'){void recover();void loadBoard();}};
  const connected=()=>{setNetwork(true);sync();},disconnected=()=>setNetwork(false);
  window.addEventListener('online',connected);window.addEventListener('offline',disconnected);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);
  const timer=setInterval(()=>{if(document.visibilityState!=='hidden'&&(pending.current||runRef.current?.status==='active'||!runRef.current&&saved.current))void recover();},15000);
  return()=>{live=false;mounted.current=false;clearInterval(timer);window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);};
 },[client]);
 useEffect(()=>{setBoard(null);void loadBoard();},[paperId,offset,client]);
 useEffect(()=>{if(run?.status!=='active')return;const timer=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(timer);},[run?.runId,run?.status]);
 const begin=async(restarting=false)=>{
  if(session.busy)return;
  setConsent(false);setRestart(false);setBusy(true);setError('');
  const draft=pending.current??{paperId:restarting?runRef.current?.paperId??paperId:paperId,requestId:crypto.randomUUID(),...(restarting&&runRef.current?.status==='active'?{abandonId:runRef.current.runId}:{})};
  savePending(draft);
  try{const next=await session.start(draft);if(next)accept(next);}catch(e){fail(e);}finally{if(mounted.current)setBusy(false);}
 };
 const submit=async()=>{
  if(!run||session.busy)return;setBusy(true);setError('');
  try{const next=await session.answer(run.index,selection);if(next){accept(next);if(next.status==='complete')void loadBoard(next.paperId,0);}}catch(e){fail(e);}finally{if(mounted.current)setBusy(false);}
 };
 const q=run?.question,active=run?.status==='active'&&!!q,judgment=q?.metadata?.response==='judgment',multi=q&&['waits','ukeire'].includes(q.ref.mode),hand=q?sorted(q.context.hand):[];
 const choose=(selected:TileId[],index?:number,judged=false)=>{if(!run)return;const draft:CompetitionChoice={runId:run.runId,index:run.index,selected,selectedIndex:index,judgmentSelected:judged};choice.current=draft;setSelection(selected);setSelectedIndex(index);setJudgmentSelected(judged);update(d=>({...d,drafts:{...d.drafts,'competition-selection':draft}}));};
 const select=(tile:TileId,index?:number)=>choose(multi?selection.includes(tile)?selection.filter(t=>t!==tile):[...selection,tile]:[tile],multi?undefined:index);
 const elapsed=run?Math.max(0,clock.current.server-Date.parse(run.startedAt)+performance.now()-clock.current.received):0;
 const completed=run?.status==='complete'&&run.paperId===paperId;
 return <div className="mj-page mj-competition">
  <div className="mj-page-heading"><h1>排位赛</h1>{!active&&<Select aria-label="比赛难度" value={paperId} options={papers.map(p=>({value:p.id,label:DIFFICULTY_NAMES[p.difficulty]+(p.archived?' · 已归档':'')}))} onValueChange={id=>{setPaperId(id);setOffset(0);setError('');}}/>}</div>
  <ErrorNotice message={error||(!active?boardError:'')}/>{!network&&<InlineNotice title="已离线，联网后自动继续。"/>}
  {active&&q&&run?<section className="mj-question">
   <div className="mj-match-progress"><span>{DIFFICULTY_NAMES[papers.find(p=>p.id===run.paperId)?.difficulty??1]} · {run.index+1}/20</span><span role="timer" aria-label="本轮用时" aria-live="off">{durationLabel(elapsed)}</span><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setRestart(true)}>重新挑战</Button></div>
   <h2>{MODE_NAMES[q.ref.mode]}</h2><p>{q.prompt}</p>
   <Hand tiles={hand} selected={selection} selectedIndex={!multi?selectedIndex??-1:undefined} onSelect={!multi&&!judgment?select:undefined} disabled={busy}/>
   {!!q.context.fixedSets?.length&&<div className="mj-public-groups">{q.context.fixedSets.map((s,i)=><div key={i}><span>{s.kind==='quad'?'已杠':'已碰'}</span><Hand tiles={setTiles(s)}/></div>)}</div>}
   {q.context.visible&&!q.scenario&&<p className="mj-muted">已见牌：{Object.entries(q.context.visible).map(([tile,n])=>`${tileName(tile as TileId)}×${n}`).join('、')}</p>}
   {q.scenario&&<section className="mj-scenario"><h3>已知条件</h3>{q.scenario.facts.map(f=><p key={f}>{f}</p>)}<div className="mj-scenario-board">{[...q.scenario.rivers,...q.scenario.publicSets].map(r=><div className="mj-river" key={r.label}><span>{r.label}</span><Hand tiles={r.tiles}/></div>)}</div></section>}
   {q.model&&<section className="mj-draw-bag"><h3>抽牌袋</h3><Hand tiles={q.model.bag}/><p>均匀不放回摸打{q.model.horizon}次，无对手行动；目标为{q.model.target==='seven-pairs'?'七对成牌':'普通型或七对成牌'}。</p></section>}
   {judgment&&<div className="mj-actions"><Button disabled={busy} aria-pressed={judgmentSelected&&selection.length===1} onClick={()=>choose([q.metadata!.judgmentTile!],undefined,true)}>题设足以保证</Button><Button disabled={busy} aria-pressed={judgmentSelected&&selection.length===0} onClick={()=>choose([],undefined,true)}>信息不足，无法保证</Button></div>}
   {multi&&<><h3>选择全部答案</h3><div className="mj-palette">{TILES.map(tile=><Tile key={tile} tile={tile} selected={selection.includes(tile)} onClick={()=>select(tile)} disabled={busy}/>)}</div></>}
   <div className="mj-question-actions"><Button variant="primary" disabled={busy||!network||(!multi&&!selection.length&&!(judgment&&judgmentSelected))} onClick={submit}>{run.index===19?'提交并交卷':'提交答案'}</Button></div>
  </section>:<>
   {completed&&run&&<section className="mj-match-result"><h2>本次成绩 · {run.score}分</h2><p>用时 {durationLabel(run.durationMs??0,true)}</p><details><summary>查看答案与解析</summary>{run.attempts?.map((a,i)=><details key={a.id}><summary>第{i+1}题 · {a.correct?'正确':'待复习'}</summary><ResultDetails refValue={a.ref}/></details>)}</details><AppLink to="../profile">查看学习画像</AppLink></section>}
   {run&&['expired','abandoned'].includes(run.status)&&<p className="mj-muted">上次比赛已结束，开始新一轮吧。</p>}
   <div className="mj-match-start"><p>20题一轮，挑战你的最好成绩。</p><Button variant="primary" disabled={busy||!online||!network||papers.find(p=>p.id===paperId)?.archived} onClick={()=>setConsent(true)}>{busy?'连接中…':run?'重新挑战':'开始排位'}</Button></div>
   {!online&&<p className="mj-muted"><AppLink to="../practice">去专项练习</AppLink></p>}
  </>}
  {!active&&<section className="mj-ranking"><h2>成绩榜</h2>{board?.archived&&<p className="mj-muted">已归档，仅供回看。</p>}
   {board?.mine&&<div className="mj-stat-line" aria-label="个人最佳"><div><span>最好成绩</span><strong>{board.mine.score}<small>分</small></strong></div><div><span>排名</span><strong>{board.mine.rank}</strong></div><div><span>用时</span><strong className="mj-personal-time">{rankingTime(board.mine.durationMs)}</strong></div></div>}
   {board?.entries.length?<><div className="mj-ranking-labels"><span>名次</span><span>牌友</span><span>得分 / 用时</span></div><div role="list" aria-label="排位成绩">{board.entries.map(entry=><RecordRow key={entry.publicId} role="listitem" separator className="mj-ranking-entry"><span>{entry.rank}</span><div className="mj-ranking-identity"><span>{entry.alias}</span>{entry.mine&&<span className="mj-muted">本人</span>}</div><div className="mj-ranking-score"><strong>{entry.score}分</strong><span className="mj-muted">{rankingTime(entry.durationMs)}</span></div></RecordRow>)}</div>{board.total>50&&<div className="mj-actions"><Button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>上一页</Button><span>{Math.floor(offset/50)+1} / {Math.ceil(board.total/50)}</span><Button disabled={offset+50>=board.total} onClick={()=>setOffset(offset+50)}>下一页</Button></div>}</>:<p className="mj-empty">{board?'暂无成绩':'正在读取成绩…'}</p>}
  </section>}
  {!active&&<details className="mj-secondary-details"><summary>比赛规则</summary><p>每轮20题，五类训练各4题，每题5分。得分高的优先；同分按用时短、达到成绩早的顺序排名，只保留个人最佳。</p><p>开始后持续计时，切换页面或断网也计入；24小时内可自动续接。每题提交后锁定答案，交卷后查看解析。</p><p>参赛会上传答卷，公开匿名代号、最好成绩与用时。身份随浏览器保存，清理Cookie或更换浏览器会成为新访客。允许重复挑战，榜单不保证真人唯一性或排除外部工具。</p></details>}
  <Dialog open={consent} onClose={()=>setConsent(false)} title="开始排位赛" description="20题，满分100分。开始后持续计时，24小时内可以继续。答卷将上传，并以匿名代号上榜。" footer={<><Button onClick={()=>setConsent(false)}>取消</Button><Button variant="primary" onClick={()=>void begin()}>开始比赛</Button></>}/>
  <Dialog open={restart} onClose={()=>setRestart(false)} title="重新挑战？" description="当前进度将结束，新一轮从第一题开始计时。此前的最好成绩保留。" footer={<><Button onClick={()=>setRestart(false)}>继续本轮</Button><Button variant="primary" onClick={()=>void begin(true)} disabled={busy}>重新挑战</Button></>}/>
 </div>;
}
