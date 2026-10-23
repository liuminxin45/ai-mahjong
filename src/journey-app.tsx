import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useLocation,useNavigate} from 'react-router';
import {AIResponseProvider,Button,ChatAppSurface,DesktopProvider,Dialog,IconButton,InlineNotice,Popover,PopoverContent,PopoverTrigger,UIStringsProvider} from 'chatgpt-desktop-kit';
import {Progress} from 'chatgpt-desktop-kit/compat/progress';
import type {MahjongAppProps as OldProps} from './story-app.js';
import {createCompetitionClient,createProfileClient,createTrainingClient,createTableClient,type TableClient} from './client.js';
import {LearningContext,Tile,Hand,useActiveTime,useLearning} from './ui.js';
import {emptyData,LearningRepository,type LearningData} from './learning/storage.js';
import {ARTWORK_VERSION} from './artwork.js';
import {GitHubLink} from './github-link.js';
import {usePresentation,useReducedMotion,useTimeline} from './experience/presentation.js';
import {audioAssets,AudioDirector,ResourceStore,type Preparation} from './story/resources.js';
import {sceneryUrl} from './story/scenery.js';
import {storySnapshot,emptyStory} from './story/core.js';
import {emptyDecision} from './decision/core.js';
import {migrateTraining,trainingSnapshot} from './training/core.js';
import {activeRound,beginTable,changeTable,completeRound,emptyTables,pageFor,restoreTables,tableSnapshot,turnPage,type TableJourney} from './journey/core.js';
import {automaticStep,playerDiscard,type RoundState,type Seat} from './journey/round.js';
import {chapters,middleBeat,type Portrait,type Scene} from './journey/narrative.js';
import {tableFacts,questions,validateTableProfile,type DecisionFact} from './journey/facts.js';
import {analyze,decompose,tileName,type TileId} from './engine/index.js';
export type MahjongAppProps=OldProps&{tableClient?:TableClient;createJourneyWorker?:()=>Worker};
const stores=new Map<string,ResourceStore>();
type Surface={paused:boolean;audio:AudioDirector|null;client:TableClient;change:(id:string,fn:(j:TableJourney)=>TableJourney)=>void;createWorker?:()=>Worker};
const Context=createContext<Surface>(null!);const useTable=()=>useContext(Context);
const seatNames=['你 · 替妹妹','母亲','舅舅','姨妈'];
const Arrow=()=> <svg width="26" height="16" viewBox="0 0 26 16" fill="none" aria-hidden="true"><path d="M1 8h23m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.2"/></svg>;

export function MahjongApp({basePath='',assetsBaseUrl='/tiles/'+ARTWORK_VERSION,audioBaseUrl,theme='system',profileClient,trainingClient,competitionClient,tableClient,createJourneyWorker,exitUrl='/works'}:MahjongAppProps){
 const [data,setData]=useState<LearningData>(emptyData),[localReady,setLocalReady]=useState(false),[preparation,setPreparation]=useState<Preparation>({phase:'checking',loaded:0,total:0,temporary:false});
 const [entered,setEntered]=useState(false),[panel,setPanel]=useState(''),[menu,setMenu]=useState(false),[notice,setNotice]=useState(''),[audio,setAudio]=useState<AudioDirector|null>(null);
 const repo=useRef(new LearningRepository()),scroll=useRef<HTMLElement>(null),location=useLocation(),nav=useNavigate(),base=basePath.replace(/\/$/,'');
 const resources=useMemo(()=>{const key=assetsBaseUrl+'|'+audioBaseUrl+'|table';if(!stores.has(key))stores.set(key,new ResourceStore(assetsBaseUrl,audioBaseUrl,undefined,'journey'));return stores.get(key)!;},[assetsBaseUrl,audioBaseUrl]);
 const client=useMemo(()=>tableClient??createTableClient(),[tableClient]);
 const learningClients=useMemo(()=>({profile:profileClient??createProfileClient(),training:trainingClient??createTrainingClient(),competition:competitionClient??createCompetitionClient()}),[profileClient,trainingClient,competitionClient]);
 useEffect(()=>{let live=true;const a=new AudioDirector(resources);setAudio(a);const unsub=resources.subscribe(p=>{if(live)setPreparation(p);});void resources.prepare().catch(()=>{});
  void repo.current.open().then(d=>{if(!live)return;try{setData({...d,tables:restoreTables(d.tables)});}catch{setData({...d,tables:emptyTables(),drafts:{...d.drafts,unreadableTables:d.tables}});setNotice('旧页已经留好，这次从第一页开始。');}setLocalReady(true);if(repo.current.temporary)setNotice('这次进度暂不能留下。只要不关掉这一页，就能继续。');});
  return()=>{live=false;unsub();a.dispose();repo.current.close();};
 },[resources]);
 useEffect(()=>{if(localReady)void repo.current.save(data).catch(e=>setNotice(e.message));},[data,localReady]);
 useEffect(()=>{if(new URLSearchParams(location.search).get('panel')==='habits'||/profile|habits/.test(location.pathname))setPanel('mirror');},[location.pathname,location.search]);
 const journey=data.tables?.journeys.at(-1),beat=journey?pageFor(journey):undefined,paused=menu||!!panel,ready=localReady&&preparation.phase==='ready';
 const scene:Scene=!entered?'eve-door':beat?.scene??(journey?.phase==='done'?'dinner-table':journey&&journey.chapter>3?'open-notebook':'family-table');
 const music=journey?chapters[journey.chapter-1].music:'clear-waters';
 useEffect(()=>{if(entered)void audio?.play(music);},[audio,music,entered]);
 useEffect(()=>{if(entered&&beat?.id==='cut')audio?.silence();},[audio,entered,beat?.id]);
 useEffect(()=>{scroll.current?.scrollTo({top:0});},[journey?.id,journey?.chapter,journey?.phase,journey?.page]);
 const change=(id:string,fn:(j:TableJourney)=>TableJourney)=>setData(d=>({...d,tables:changeTable(d.tables??emptyTables(),id,fn)}));
 const enter=()=>{void audio?.unlock(music);if(!journey)setData(d=>({...d,tables:beginTable(d.tables??emptyTables())}));setEntered(true);nav(base+'/practice',{replace:true});};
 const open=(id:string)=>{setMenu(false);setPanel(id);};
 return <DesktopProvider className="mahjong-app" theme={theme}><UIStringsProvider locale="zh-CN" translate={k=>k}><AIResponseProvider><LearningContext.Provider value={{data,update:setData,assets:assetsBaseUrl,base,repository:repo.current,notice:setNotice,profileClient:learningClients.profile,trainingClient:learningClients.training,competitionClient:learningClients.competition}}><Context.Provider value={{paused,audio,client,change,createWorker:createJourneyWorker}}>
  <ChatAppSurface className="mj-novel-shell" data-scene={scene}>
   <div className="mj-novel-scenery" aria-hidden="true">{(['eve-door','family-table','winter-window','present-cabinet','open-notebook','dinner-table'] as Scene[]).map(s=>sceneryUrl(s)&&<img key={s} src={sceneryUrl(s)} className={s===scene?'is-visible':''} alt=""/>)}</div>
   <div className="mj-story-more"><Popover open={menu} onOpenChange={setMenu}><PopoverTrigger asChild><IconButton aria-label="更多" title="更多"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></IconButton></PopoverTrigger><PopoverContent><div className="mj-book-menu"><h2>未完的牌谱</h2><Button variant="ghost" layout="row" onClick={()=>open('mirror')}>我的取舍</Button><Button variant="ghost" layout="row" onClick={()=>open('sound')} disabled={!ready}>声音</Button><Button variant="ghost" layout="row" onClick={()=>open('rules')}>怎么落牌</Button><Button variant="ghost" layout="row" onClick={()=>open('archive')}>过往</Button>{journey&&<Button variant="ghost" layout="row" onClick={()=>open('restart')}>从头读起</Button>}<Button variant="ghost" layout="row" onClick={()=>open('about')}>制作信息</Button><div className="mj-book-github"><GitHubLink/><span>GitHub 项目</span></div><Button variant="ghost" layout="row" onClick={()=>window.location.assign(exitUrl)}>返回造物</Button></div></PopoverContent></Popover></div>
   <main ref={scroll} className="mj-novel-scroll" id="mahjong-main">{notice&&<InlineNotice title={notice} actions={<Button onClick={()=>setNotice('')}>知道了</Button>}/>}
    {!ready?<section className="mj-novel-cover"><h1>未完的牌谱</h1><p>{preparation.phase==='failed'?'门还没推开。再等一会儿，好吗。':'屋里还亮着灯。'}</p><div className="mj-resource-progress"><Progress value={preparation.total?preparation.loaded/preparation.total*100:0} aria-label="等这一页准备好"/></div>{preparation.phase==='failed'&&<Button variant="ghost" onClick={()=>void resources.prepare().catch(()=>{})}>再等一会儿</Button>}</section>:
    !entered?<section className="mj-novel-cover"><h1>未完的牌谱</h1><p>{journey?'椅子还给你留着。':'门里，有人在等你。'}</p><Button variant="ghost" onClick={enter}>{journey?'回到这一页':'推门'}</Button></section>:
    journey?<>{journey.phase==='playing'?<><div hidden={!!journey.middle} inert={!!journey.middle}><TableRound key={journey.id+':'+journey.chapter} journey={journey}/></div>{journey.middle&&<NovelReader key={journey.id+':'+journey.middle.id} journey={journey}/>}</>:beat?<NovelReader key={journey.id+':'+journey.phase+':'+journey.chapter+':'+(journey.middle?.id??journey.page)} journey={journey}/>:<section className="mj-novel-cover mj-novel-end"><p>屋里的灯，还亮着。</p></section>}</>:null}
   </main>
   {panel==='mirror'&&<TableMirror open onClose={()=>setPanel('')} clear={()=>setPanel('clear')}/>}
   <SoundDialog open={panel==='sound'} close={()=>setPanel('')} audio={audio} music={music}/>
   <Dialog open={panel==='rules'} onClose={()=>setPanel('')} title="怎么落牌"><p>这副牌由你替妹妹打。摸到一张，再打出一张；桌上其他三人会依次行动。凑成四组三张和一对，或七对，就能和牌。</p><p>只用筒、条，每种四张。四张同牌可以算两对。这里只摸打与和牌，不操作吃碰杠。</p><p>好选择也可能等不到牌。故事照常往下走，输赢不会改变那晚发生的事。</p></Dialog>
   <Dialog open={panel==='archive'} onClose={()=>setPanel('')} title="过往"><Archive/>{!!data.story?.attempts.length&&<p>旧版的 {data.story.attempts.length} 次选择与报告仍留在浏览器中，按原题目保存，不改算成这次牌局。</p>}</Dialog>
   <Dialog open={panel==='about'} onClose={()=>setPanel('')} title="未完的牌谱"><p>一段原创的兄妹故事。画面由 imagegen 绘制，牌局保留可复现的摸打。</p><p>音乐 Kevin MacLeod（incompetech.com），CC BY 4.0；音效 Kenney，CC0。经过响度调整与编码。</p>{audioAssets.filter(a=>a.kind==='music').map(a=><p key={a.id}><a href={a.sourcePage} target="_blank" rel="noreferrer">{a.title}</a></p>)}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">音乐许可</a></Dialog>
   <Dialog open={panel==='restart'} onClose={()=>setPanel('')} title="从头读起？" description="刚才的阅读与选择都会留下。" footer={<><Button onClick={()=>setPanel('')}>留在这页</Button><Button onClick={()=>{setData(d=>({...d,tables:beginTable(d.tables??emptyTables())}));setPanel('');setEntered(true);void audio?.unlock('clear-waters');}}>从头读起</Button></>}/>
   <Dialog open={panel==='clear'} onClose={()=>setPanel('mirror')} title="清除本地记录？" description="新旧选择和阅读位置都会清除。云端回望需另行删除。" footer={<><Button onClick={()=>setPanel('mirror')}>留下</Button><Button variant="danger" onClick={()=>{setData(emptyData());setPanel('');setEntered(false);audio?.silence();}}>清除</Button></>}/>
  </ChatAppSurface>
 </Context.Provider></LearningContext.Provider></AIResponseProvider></UIStringsProvider></DesktopProvider>;
}

function PortraitImage({id,className=''}:{id?:Portrait;className?:string}){return id&&sceneryUrl(id)?<img className={'mj-novel-portrait '+className} src={sceneryUrl(id)} alt="" aria-hidden="true"/>:null;}
function NovelReader({journey:j}:{journey:TableJourney}){
 const {change,paused,audio}=useTable(),beat=pageFor(j)!,reduced=useReducedMotion(),root=useRef<HTMLDivElement>(null),busy=useRef(false),[visible,setVisible]=useState(false);
 const saved=j.read.includes(beat.id+':'+j.line);
 useTimeline(!reduced&&!saved,beat.id+':'+j.line,paused,()=>root.current?[root.current.animate([{opacity:0},{opacity:1}],{duration:650,fill:'both',easing:'ease'})]:[],()=>setVisible(true));
 useEffect(()=>{setVisible(saved||reduced);busy.current=false;},[beat.id,j.line,saved,reduced]);
 useEffect(()=>{if(!visible)return;change(j.id,x=>({...x,read:[...new Set([...x.read,beat.id+':'+j.line])]}));},[visible,beat.id,j.line]);
 const advance=()=>{if(paused||busy.current)return;if(!visible){setVisible(true);return;}busy.current=true;audio?.effect(final&&beat.action==='合上本子'?'close':'page',j.id+':'+beat.id+':'+j.line);change(j.id,x=>x.line<beat.lines.length-1?{...x,line:x.line+1}:turnPage(x));};
 const final=j.line===beat.lines.length-1;
 return <section className="mj-novel-reader" data-beat={beat.id}>
  {beat.period&&<div className="mj-novel-period">{beat.period}</div>}
  <PortraitImage id={beat.portrait}/>
  <div ref={root} className="mj-novel-passage" onKeyDown={e=>{if(e.repeat||e.nativeEvent.isComposing||!['Enter',' ','ArrowRight'].includes(e.key))return;e.preventDefault();advance();}} tabIndex={0} aria-label="故事">
   {beat.speaker&&<span className="mj-novel-speaker">{beat.speaker}</span>}<p>{beat.lines[j.line]}</p>
  </div>
  <Button variant="ghost" className="mj-novel-turn" onKeyDown={e=>{if(e.repeat||e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();}}} aria-label={final&&beat.action?beat.action:'继续读'} onClick={advance} disabled={paused}>{final&&beat.action?beat.action:<Arrow/>}</Button>
 </section>;
}

function usePausedDelay(fn:()=>void,delay:number,key:string,paused:boolean,enabled=true){
 const callback=useRef(fn);callback.current=fn;const remaining=useRef(delay),[hidden,setHidden]=useState(document.hidden);
 useEffect(()=>{const update=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 useEffect(()=>{remaining.current=delay;},[key,delay]);
 useEffect(()=>{if(paused||hidden||!enabled)return;const start=performance.now(),timer=setTimeout(()=>callback.current(),remaining.current);return()=>{clearTimeout(timer);remaining.current=Math.max(0,remaining.current-(performance.now()-start));};},[key,delay,paused,hidden,enabled]);
}

function TableRound({journey:j}:{journey:TableJourney}){
 const {change,paused,audio,createWorker}=useTable(),round=activeRound(j),[frames,setFrames]=useState<RoundState[]>([]),[frame,setFrame]=useState(0),[error,setError]=useState(''),[retry,setRetry]=useState(0),[primer,setPrimer]=useState(j.chapter===1&&round.commands.length===0&&!j.read.includes('primer'));
 const reduced=useReducedMotion(),root=useRef<HTMLDivElement>(null),quote=useRef<HTMLParagraphElement>(null),worker=useRef<Worker|null>(null),latest=useRef(round);latest.current=round;
 const inFlight=useRef(''),processing=round.phase!=='player'&&round.phase!=='over',animating=frame<frames.length;
 const shown=animating?frames[frame]:round;
 const patch=(fn:(x:TableJourney)=>TableJourney)=>change(j.id,fn);
 const presentation=usePresentation({key:j.id+':'+j.chapter,first:j.chapter===1,seen:j.presented,submitted:false,paused:paused||primer||!!j.middle,assets:useLearning().assets,tiles:round.hands[0].map(t=>t.tile),nextTiles:[],root,quote,enter:()=>patch(x=>({...x,presented:true})),immersive:()=>{}});
 const elapsed=useActiveTime(round.id+':'+round.seq,paused||primer||!presentation.ready||processing||animating||!!j.middle);
 useEffect(()=>{try{worker.current=createWorker?createWorker():new Worker(new URL('./journey/runtime.worker.js',import.meta.url),{type:'module'});}catch{worker.current=null;}return()=>worker.current?.terminate();},[createWorker]);
 useEffect(()=>{
  if(!processing||animating||paused)return;const key=round.id+':'+round.seq+':'+retry;if(inFlight.current===key)return;inFlight.current=key;setError('');let live=true;
  const receive=(response:{id:string;seq:number;state?:RoundState;frames?:RoundState[];error?:string})=>{if(!live||response.id!==latest.current.id||response.seq!==latest.current.seq)return;if(response.error){setError('这一手暂时没接上。');return;}setFrames([round,...response.frames!]);setFrame(0);patch(x=>activeRound(x).seq===response.seq?{...x,rounds:x.rounds.map(r=>r.id===response.id?response.state!:r),selected:undefined}:x);};
  const w=worker.current;if(w){const handler=(e:MessageEvent)=>receive(e.data),fail=()=>{w.terminate();worker.current=null;inFlight.current='';setRetry(n=>n+1);};w.addEventListener('message',handler);w.addEventListener('error',fail);w.postMessage({id:round.id,seq:round.seq,state:round});return()=>{live=false;inFlight.current='';w.removeEventListener('message',handler);w.removeEventListener('error',fail);};}
  const timer=setTimeout(()=>{try{let state=round;const batch:RoundState[]=[];for(let n=0;n<12&&state.phase!=='player'&&state.phase!=='over';n++){state=automaticStep(state);batch.push(state);}receive({id:round.id,seq:round.seq,state,frames:batch});}catch{receive({id:round.id,seq:round.seq,error:'continue'});}},0);return()=>{live=false;inFlight.current="";clearTimeout(timer);};
 },[round.id,round.seq,retry,paused,animating,processing]);
 usePausedDelay(()=>setFrame(i=>i+1),reduced?0:shown.events.at(-1)?.kind==='discard'?650:380,shown.id+':'+shown.seq+':'+frame,paused,animating);
 useEffect(()=>{if(!animating&&frames.length){setFrames([]);setFrame(0);const last=round.commands.at(-1),middle=middleBeat(j.chapter,round.commands.length,round.events.some(e=>e.kind==='discard'&&e.seat!==0&&e.seq>(last?.seq??0)));if(round.phase==='player'&&middle&&!j.read.includes('mid:'+middle.id))patch(x=>({...x,middle,line:0,read:[...x.read,'mid:'+middle.id]}));}},[animating,frames.length,round.seq]);
 useEffect(()=>{audio?.setThinking(presentation.ready&&!primer&&!processing&&!animating);if(presentation.ready&&!primer)audio?.effect('deal',round.id+':deal');return()=>audio?.setThinking(false);},[audio,presentation.ready,primer,processing,animating]);
 useEffect(()=>{const e=shown.events.at(-1);if(e?.kind==='discard')audio?.effect(e.seat===0?'discard':'opponent',shown.id+':'+e.seq);},[shown.seq,audio]);
 const disabled=paused||!!j.middle||primer||!presentation.ready||processing||animating||round.phase==='over',selected=shown.hands[0].find(t=>t.id===j.selected);
 const submit=()=>{if(disabled||!selected)return;patch(x=>{const r=activeRound(x);if(r.phase!=='player'||r.seq!==round.seq)return x;const next=playerDiscard(r,{id:r.id+':'+r.seq,seq:r.seq,tileId:selected.id,elapsedMs:elapsed(),assisted:x.chapter===1&&r.commands.length===0});return {...x,rounds:x.rounds.map(s=>s.id===r.id?next:s),selected:undefined};});};
 const lastEvent=shown.events.at(-1),turnText=shown.phase==='over'?endingLine(shown):animating||processing?lastEvent?.kind==='discard'?`${seatNames[lastEvent.seat]}打出${tileName(lastEvent.tile!.tile)}`:`${seatNames[shown.seat]}摸牌`:'轮到你了';
 return <section className="mj-novel-table" data-chapter={j.chapter} data-seq={shown.seq} data-round-id={shown.id}>
  <div className="mj-table-heading"><span>{chapters[j.chapter-1].title}</span>{j.chapter>3&&<span>循着页边，重摆这一局</span>}</div>
  <div className="mj-seat-map"><SeatRiver seat={2} round={shown} active={shown.seat===2&&processing}/><div className="mj-table-sides"><SeatRiver seat={3} round={shown} active={shown.seat===3&&processing}/><SeatRiver seat={1} round={shown} active={shown.seat===1&&processing}/></div></div>
  <div className="mj-table-turn" aria-live="polite">{turnText}</div>
  <div className="mj-player-area" ref={root} data-presenting={!presentation.ready}>
   <div className="mj-player-label"><span>{j.chapter<4?'你 · 替妹妹':'我在纸上，接着这一局'}</span>{j.chapter<4&&<PortraitImage id={j.chapter===2?'sister-orange':'sister-think'} className="mj-table-sister"/>}</div>
   <div className="mj-hand mj-continuous-hand" aria-label="你的手牌" onKeyDown={e=>{if(disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')],i=buttons.indexOf(e.target as HTMLButtonElement);if(i<0)return;e.preventDefault();const columns=getComputedStyle(e.currentTarget).gridTemplateColumns.split(' ').length,step=e.key==='ArrowUp'?-columns:e.key==='ArrowDown'?columns:e.key==='ArrowLeft'?-1:1;buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+step))]?.focus();}}>
    {shown.hands[0].map(t=><div key={t.id} className={'mj-physical-tile '+(t.id===shown.lastDraw?'mj-just-drawn'+(animating?' mj-draw-arrives':''):'')} data-tile-id={t.id}><Tile tile={t.tile} onClick={()=>{if(disabled)return;patch(x=>({...x,selected:t.id}));audio?.effect('select',crypto.randomUUID());}} selected={j.selected===t.id} disabled={disabled}/>{t.id===shown.lastDraw&&<span className="mj-new-tile-label">新摸</span>}</div>)}
   </div>
   <div className="mj-own-river" aria-label="你打出的牌">{shown.rivers[0].map(t=><Tile key={t.id} tile={t.tile} small/>)}</div>
   {primer?<div className="mj-first-guide"><p>这副牌，你替妹妹打。</p><p>四组三张，再留一对。</p><div className="mj-winning-example" aria-label="成牌示例">{[['1p','2p','3p'],['4p','5p','6p'],['2s','3s','4s'],['7s','8s','9s'],['5s','5s']].map((group,i)=><div key={i}><Hand tiles={group as TileId[]}/></div>)}</div><p>点一张牌，再点“打出”。</p><Button variant="ghost" onClick={()=>{setPrimer(false);patch(x=>({...x,read:[...x.read,'primer']}));audio?.effect('deal',round.id+':deal');}}>接过手牌</Button></div>:
   shown.phase==='over'&&!animating?<div className="mj-table-end"><Button variant="ghost" onClick={()=>patch(completeRound)} aria-label="收起这一局"><Arrow/></Button></div>:
   <div className="mj-story-action"><Button variant="ghost" disabled={disabled||!selected} onClick={submit}>{selected?'打出'+tileName(selected.tile):processing||animating?'稍候':'打出'}</Button></div>}
   {error&&<InlineNotice title={error} actions={<Button onClick={()=>{inFlight.current='';setRetry(n=>n+1);}}>接着这一手</Button>}/>}
  </div>
 </section>;
}
function SeatRiver({seat,round,active}:{seat:Seat;round:RoundState;active:boolean}){const portrait=seat===2?'uncle-think':seat===1?'mother-eve':'aunt';return <div className={'mj-seat-river '+(active?'is-active':'')} data-seat={seat}><div className="mj-seat-name"><PortraitImage id={portrait}/><span>{seatNames[seat]}</span></div><div className="mj-seat-tiles" aria-label={seatNames[seat]+'打出的牌'}>{round.rivers[seat].map(t=><Tile key={t.id} tile={t.tile} small/>)}</div></div>;}
function endingLine(r:RoundState){return r.end?.kind==='exhausted'?'最后一张也摸完了。谁都没和。':r.end?.winner===0?'这回，我先和了。':`${seatNames[r.end!.winner!]}把牌推开，和了。`;}

function SoundDialog({open,close,audio,music}:{open:boolean;close:()=>void;audio:AudioDirector|null;music:string}){const [settings,setSettings]=useState(audio?.preferences??{muted:false,volume:.55});useEffect(()=>{if(open&&audio)setSettings(audio.preferences);},[open,audio]);return <Dialog open={open} onClose={close} title="声音"><div className="mj-sound-controls"><Button variant="ghost" onClick={()=>{const next={...settings,muted:!settings.muted};setSettings(next);audio?.settings(next.muted,next.volume);if(!next.muted)void audio?.unlock(music);}}>{settings.muted?'打开声音':'静音'}</Button><label>音量<input aria-label="音量" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={e=>{const next={...settings,volume:Number(e.target.value)};setSettings(next);audio?.settings(next.muted,next.volume);}}/></label></div></Dialog>;}

function TableMirror({open,onClose,clear}:{open:boolean;onClose:()=>void;clear:()=>void}){
 const {data,update}=useLearning(),{client}=useTable(),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[detail,setDetail]=useState(false),[past,setPast]=useState(false),[remove,setRemove]=useState('');
 const snapshot=useMemo(()=>tableSnapshot(data.tables??emptyTables()),[data.tables]),facts=useMemo(()=>tableFacts(snapshot),[snapshot]),report=data.tables?.reports.at(-1),selected=report&&facts.observations.find(o=>o.id===report.profile.observationId),observation=selected??facts.fallback,question=questions.find(q=>q.id===(selected?report!.profile.questionId:observation?.questionIds[0]));
 const generate=async()=>{if(busy)return;setConsent(false);setBusy(true);setError('');try{const historical=migrateTraining(data),legacy=storySnapshot(data.decision??emptyDecision(),data.story??emptyStory(),historical.attempts.length?trainingSnapshot(historical):undefined),s=tableSnapshot(data.tables??emptyTables(),legacy),saved=await client.generate(s);validateTableProfile(saved.profile,s);update(d=>({...d,tables:{...(d.tables??emptyTables()),reports:[...(d.tables?.reports.filter(r=>r.reportId!==saved.reportId)??[]),saved]}}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <><Dialog open={open} onClose={onClose} title="我的取舍"><div className="mj-small-mirror">{observation?<><p className="mj-mirror-observation">{observation.text}</p><p className="mj-mirror-question">{question?.text}</p><Button variant="ghost" onClick={()=>setDetail(x=>!x)}>回到那一手</Button>{detail&&facts.facts.filter(f=>observation.evidenceIds.includes(f.id)).map(f=><Evidence key={f.id} fact={f}/>)}<p className="mj-mirror-scope">{facts.summary.rounds} 局，{facts.summary.choices} 次选择。{facts.independent.length<5?'这几局，还不足以说成习惯。':'不同开局分开看，同局的选择相互关联。'}</p><Button variant="ghost" disabled={busy} onClick={()=>setConsent(true)}>{busy?'再看一会儿…':'再看一层'}</Button></>:<p>落过的牌，会在这里留下痕迹。</p>}{error&&<InlineNotice title={error}/>}<div className="mj-mirror-secondary"><Button variant="ghost" size="sm" onClick={()=>setPast(x=>!x)}>过往</Button><Button variant="ghost" size="sm" onClick={clear}>清除本地记录</Button></div>{past&&data.tables?.reports.map(r=><div key={r.reportId}><p>{new Date(r.at).toLocaleDateString()} 的回望</p><Button variant="ghost" size="sm" onClick={()=>setRemove(r.reportId)}>删除这份回望</Button></div>)}</div></Dialog><Dialog open={consent} onClose={()=>setConsent(false)} title="再看一层？" description="确认后，把答题记录交给本站模型，只根据落过的牌整理一段回望。" footer={<><Button onClick={()=>setConsent(false)}>先留着</Button><Button onClick={()=>void generate()}>确认回望</Button></>}/><Dialog open={!!remove} onClose={()=>setRemove('')} title="删除这份回望？" description="本地选择与阅读进度会留下。" footer={<><Button onClick={()=>setRemove('')}>留下</Button><Button variant="danger" onClick={async()=>{try{await client.remove(remove);update(d=>({...d,tables:{...(d.tables??emptyTables()),reports:d.tables!.reports.filter(r=>r.reportId!==remove)}}));setRemove('');}catch(e){setError((e as Error).message);setRemove('');}}}>删除</Button></>}/></>;
}
function Evidence({fact:f}:{fact:DecisionFact}){return <div className="mj-mirror-evidence"><Hand tiles={f.hand}/><p>你打出{tileName(f.answer)}。按当时可见的牌，{f.best.map(tileName).join('、')}留下最短距离与最多进张。</p><p>离听牌：{f.distance===0?'已经听牌':f.distance+'步'}；尚未见到的进张 {f.opportunities} 张。比较方案：{f.bestDistance===0?'已经听牌':f.bestDistance+'步'}，{f.bestOpportunities} 张。</p><p>先比较离听牌的步数，再把能缩短一步的牌去重，每种扣去手牌和桌上已见张数。这衡量牌效，不把未知牌墙或后来输赢当成答案。</p>{f.assisted&&<p>这一手看过示例，单独留存。</p>}</div>;}
function Archive(){const {data}=useLearning();return <div>{data.tables?.journeys.map(j=><p key={j.id}>{new Date(j.at).toLocaleDateString()} · {j.phase==='done'?'合上本子':'读到“'+chapters[j.chapter-1].title+'”'} · {j.rounds.reduce((n,r)=>n+r.commands.length,0)} 次选择</p>)}{data.story?.reports.map(r=><p key={r.reportId}>{r.profile.observation.text}</p>)}{!data.tables?.journeys.length&&!data.story?.attempts.length&&<p>还没有翻过的页。</p>}</div>;}
