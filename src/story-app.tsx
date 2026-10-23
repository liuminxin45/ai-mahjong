import {useEffect,useMemo,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router';
import {AIResponseProvider,Button,ChatAppSurface,DesktopProvider,Dialog,IconButton,InlineNotice,Popover,PopoverContent,PopoverTrigger,Select,UIStringsProvider} from 'chatgpt-desktop-kit';
import {Progress} from 'chatgpt-desktop-kit/compat/progress';
import {createCompetitionClient,createDecisionClient,createProfileClient,createStoryClient,createTrainingClient} from './client.js';
import type {StoryClient} from './client.js';
import type {MahjongAppProps as LegacyProps} from './decision-app.js';
import {emptyData,LearningRepository,type LearningData} from './learning/storage.js';
import {Hand,Tile,LearningContext,useActiveTime} from './ui.js';
import {GitHubLink} from './github-link.js';
import {ARTWORK_VERSION} from './artwork.js';
import {countsOf,setTiles,tileName,TILES,type TileId} from './engine/index.js';
import {usePresentation,useReducedMotion} from './experience/presentation.js';
import {emptyStory,nextStory,nodeFor,patchJourney,restoreStory,startNarrativeJourney,submitStory,type JourneyState} from './story/core.js';
import {NARRATIVE_VERSION,chapterClosings,endingPages,narrativeResponse,narrativeScene,openingLines,siblingChapters} from './story/narrative.js';
import {audioAssets,AudioDirector,ResourceStore,type Preparation} from './story/resources.js';
import {StorySurface,useStory} from './story/context.js';
import {ReadScene} from './story/reader.js';
import {Mirror,Rules} from './story-panels.js';
import {sceneryUrl} from './story/scenery.js';

export {createCompetitionClient,createDecisionClient,createProfileClient,createTrainingClient,createStoryClient} from './client.js';
export type MahjongAppProps=LegacyProps&{storyClient?:StoryClient;audioBaseUrl?:string};
const stores=new Map<string,ResourceStore>();

export function MahjongApp({basePath='',assetsBaseUrl='/tiles/'+ARTWORK_VERSION,audioBaseUrl,theme='system',storyClient,profileClient,trainingClient,competitionClient,exitUrl='/works'}:MahjongAppProps){
  const [data,setData]=useState<LearningData>(emptyData),[localReady,setLocalReady]=useState(false),[preparation,setPreparation]=useState<Preparation>({phase:'checking',loaded:0,total:0,temporary:false});
  const [entered,setEntered]=useState(false),[menu,setMenu]=useState(false),[mirror,setMirror]=useState(false),[rules,setRules]=useState(false),[about,setAbout]=useState(false),[sound,setSound]=useState(false),[history,setHistory]=useState(false),[clearing,setClearing]=useState(false),[replaying,setReplaying]=useState(false);
  const [notice,setNotice]=useState(''),[audio,setAudio]=useState<AudioDirector|null>(null),repo=useRef(new LearningRepository()),scroll=useRef<HTMLElement>(null);
  const location=useLocation(),navigate=useNavigate(),base=basePath.replace(/\/$/,'');
  const resources=useMemo(()=>{const key=assetsBaseUrl+'|'+audioBaseUrl;if(!stores.has(key))stores.set(key,new ResourceStore(assetsBaseUrl,audioBaseUrl));return stores.get(key)!;},[assetsBaseUrl,audioBaseUrl]);
  const clients=useMemo(()=>({profile:profileClient??createProfileClient(),training:trainingClient??createTrainingClient(),competition:competitionClient??createCompetitionClient(),story:storyClient??createStoryClient()}),[profileClient,trainingClient,competitionClient,storyClient]);
  useEffect(()=>{
    let live=true;const director=new AudioDirector(resources);setAudio(director);
    const unsubscribe=resources.subscribe(p=>{if(live)setPreparation(p);});void resources.prepare().catch(()=>{});
    void repo.current.open().then(d=>{if(!live)return;try{setData({...d,story:restoreStory(d.story)});}catch{setData({...d,story:emptyStory(),drafts:{...d.drafts,unreadableStory:d.story}});setNotice('旧谱已留存，这次从新的一页开始。');}setLocalReady(true);if(repo.current.temporary)setNotice('这次进度暂不能保存，仍可以继续读。');});
    return()=>{live=false;unsubscribe();director.dispose();repo.current.close();};
  },[resources]);
  useEffect(()=>{if(localReady)void repo.current.save(data).catch(e=>setNotice(e.message));},[data,localReady]);
  const journey=[...(data.story?.journeys??[])].reverse().find(j=>j.edition===NARRATIVE_VERSION),paused=menu||mirror||rules||about||sound||history||clearing||replaying,ready=localReady&&preparation.phase==='ready';
  useEffect(()=>{scroll.current?.scrollTo({top:0});},[journey?.id,journey?.position,journey?.phase,journey?.endingStep]);
  useEffect(()=>{if(new URLSearchParams(location.search).get('panel')==='habits'||/profile|habits|progress/.test(location.pathname))setMirror(true);},[location.search,location.pathname]);
  const flip=()=>{
    const opening=!journey||journey.phase==='done'||!journey.opened;
    const quiet=!opening&&(journey.phase==='chapter'&&journey.position===15||journey.phase==='ending'&&journey.endingStep===0);
    const music=opening||journey?.phase==='ending'?'clear-waters':siblingChapters[Math.ceil(journey!.position/5)-1].music;
    void audio?.unlock(music,quiet);
    if(!journey||journey.phase==='done')setData(d=>({...d,story:startNarrativeJourney(d.story??emptyStory())}));
    setEntered(true);navigate(base+'/practice',{replace:true});
  };
  const open=(fn:(v:boolean)=>void)=>{setMenu(false);fn(true);};
  const scene=entered&&journey?(journey.phase==='chapter'&&journey.position===15||journey.phase==='ending'||journey.phase==='done'?'present':siblingChapters[Math.ceil(journey.position/5)-1].scene):'present';
  return <DesktopProvider className="mahjong-app" theme={theme}><UIStringsProvider locale="zh-CN" translate={key=>key}><AIResponseProvider>
    <LearningContext.Provider value={{data,update:setData,assets:assetsBaseUrl,profileClient:clients.profile,trainingClient:clients.training,competitionClient:clients.competition,base,repository:repo.current,notice:setNotice}}>
    <StorySurface.Provider value={{audio,paused,client:clients.story}}><ChatAppSurface className="mj-story-shell" data-scene={scene}>
      <div className="mj-book-scenery" aria-hidden="true">{['table','notebook','tea','door','present'].map(id=>sceneryUrl(id)&&<img key={id} src={sceneryUrl(id)} alt="" className={scene===id?'is-visible':''}/>)}</div>
      <div className="mj-story-more"><Popover open={menu} onOpenChange={setMenu}><PopoverTrigger asChild><IconButton aria-label="更多" title="更多"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></IconButton></PopoverTrigger><PopoverContent>
        <div className="mj-book-menu"><h2>未完的牌谱</h2><Button variant="ghost" layout="row" onClick={()=>open(setMirror)}>我的取舍</Button><Button variant="ghost" layout="row" disabled={!ready} onClick={()=>open(setSound)}>声音</Button>
          {!!journey?.readingLog?.length&&<Button variant="ghost" layout="row" onClick={()=>open(setHistory)}>刚才的话</Button>}
          {journey&&<Button variant="ghost" layout="row" onClick={()=>open(setReplaying)}>重读牌谱</Button>}
          <Button variant="ghost" layout="row" onClick={()=>open(setRules)}>怎么落牌</Button><Button variant="ghost" layout="row" onClick={()=>open(setAbout)}>制作信息</Button>
          <div className="mj-book-github"><GitHubLink/><span>GitHub 项目</span></div><Button variant="ghost" layout="row" onClick={()=>window.location.assign(exitUrl)}>返回造物</Button>
        </div>
      </PopoverContent></Popover></div>
      <main ref={scroll} className="mj-story-scroll" id="mahjong-main">
        {notice&&<div className="mj-story-notice"><InlineNotice title={notice} actions={<Button size="sm" onClick={()=>setNotice('')}>知道了</Button>}/></div>}
        {!ready?<section className="mj-book-cover"><h1>未完的牌谱</h1><p>{preparation.phase==='failed'?'这一页暂时没能翻开。':'那一晚，还差一张牌。'}</p><div className="mj-resource-progress" data-phase={preparation.phase}><Progress value={preparation.total?preparation.loaded/preparation.total*100:0} aria-label="等这一页准备好"/></div>{preparation.phase==='failed'&&<div className="mj-actions"><Button onClick={()=>void resources.prepare().catch(()=>{})}>再试一次</Button><Button variant="ghost" onClick={()=>window.location.assign(exitUrl)}>先回去</Button></div>}</section>:
          !entered?<section className="mj-book-cover"><h1>未完的牌谱</h1><p>{journey&&journey.phase!=='done'?'刚才那一页，还给你留着。':'那一晚，还差一张牌。'}</p><Button variant="ghost" className="mj-cover-flip" onClick={flip}>{journey?journey.phase==='done'?'再翻开':'接着读':'翻开'}</Button></section>:
          journey?<Book journey={journey}/>:<div className="mj-book-cover"/>}
      </main>
      <Mirror open={mirror} onClose={()=>setMirror(false)} clear={()=>setClearing(true)}/><Rules open={rules} onClose={()=>setRules(false)}/><Sound open={sound} onClose={()=>setSound(false)} audio={audio}/>
      <Dialog open={history} onClose={()=>setHistory(false)} title="刚才的话"><div className="mj-story-transcript">{journey?.readingLog?.map(line=><p key={line.id}>{line.text}</p>)}</div></Dialog>
      <Dialog open={about} onClose={()=>setAbout(false)} title="未完的牌谱"><p>一段原创的兄妹故事。牌谱里的重演，保留选择和得失；那次相聚与后来发生的事，各有自己的时间。</p><p>音乐：Kevin MacLeod（incompetech.com），CC BY 4.0。音效：Kenney，CC0。</p><ul>{audioAssets.filter(a=>a.kind==='music').map(a=><li key={a.id}><a href={a.sourcePage} target="_blank" rel="noreferrer">{a.title}</a></li>)}</ul><p><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">音乐许可</a> · 配乐经过响度统一、重新编码及播放淡化。</p></Dialog>
      <Dialog open={clearing} onClose={()=>setClearing(false)} title="清除这个浏览器的记录？" description="新旧作答和阅读位置都会清除。云端回望需要另行删除。" footer={<><Button onClick={()=>setClearing(false)}>留下</Button><Button variant="danger" onClick={()=>{setData(emptyData());setClearing(false);setMirror(false);setEntered(false);navigate(base);}}>清除</Button></>}/>
      <Dialog open={replaying} onClose={()=>setReplaying(false)} title="从头翻开？" description="先前的阅读与选择都会留下。" footer={<><Button onClick={()=>setReplaying(false)}>留在这页</Button><Button variant="primary" onClick={()=>{setData(d=>({...d,story:startNarrativeJourney(d.story??emptyStory())}));setReplaying(false);setEntered(true);void audio?.unlock('clear-waters');navigate(base+'/practice');}}>从头翻开</Button></>}/>
    </ChatAppSurface></StorySurface.Provider></LearningContext.Provider>
  </AIResponseProvider></UIStringsProvider></DesktopProvider>;
}

function Book({journey:j}:{journey:JourneyState}){
  const {change,audio}=useStory();
  if(!j.opened)return <div className="mj-story-opening"><ReadScene id="opening" lines={openingLines} journey={j} mode="single" action="落座" onNext={()=>{change(s=>patchJourney(s,j.id,{opened:true}));audio?.effect('page',j.id+':opening');}}/></div>;
  if(j.phase==='chapter')return <ChapterEnd journey={j}/>;
  if(j.phase==='ending'||j.phase==='done')return <Finale journey={j}/>;
  return <StoryRound key={j.id+':'+j.position} journey={j}/>;
}

function StoryRound({journey:j}:{journey:JourneyState}){
  const {change,audio}=useStory(),n=nodeFor(j),scene=narrativeScene(n,j),beforeId='before:'+n.id;
  const [read,setRead]=useState(!!j.readScenes?.includes(beforeId));
  useEffect(()=>{void audio?.play(siblingChapters[n.chapter-1].music);},[audio,n.chapter]);
  return <section className="mj-story-round" data-node={n.id} data-position={j.position}>
    {!j.submitted&&<ReadScene key={beforeId} id={beforeId} lines={scene.before} journey={j} onComplete={()=>setRead(true)}/>}
    {(read||j.submitted)&&<CardDecision journey={j}/>}
    {j.submitted&&<StoryResponse journey={j}/>}
  </section>;
}

function CardDecision({journey:j}:{journey:JourneyState}){
  const {change,paused,assets,audio}=useStory(),n=nodeFor(j),q=n.question,root=useRef<HTMLDivElement>(null),quote=useRef<HTMLParagraphElement>(null),lock=useRef(false),focus=useRef(false);
  const patch=(p:Partial<JourneyState>)=>change(s=>patchJourney(s,j.id,p));
  const presentation=usePresentation({key:j.id+':'+n.id,first:false,seen:j.presented.includes(n.id),submitted:j.submitted,paused,assets,tiles:q.context.hand,nextTiles:[],root,quote,enter:()=>patch({presented:[...new Set([...j.presented,n.id])]}),immersive:()=>{}});
  const elapsed=useActiveTime(j.id+':'+n.id,!presentation.ready||paused||j.submitted),answer=j.selected===null?undefined:q.context.hand[j.selected];
  useEffect(()=>{audio?.setThinking(presentation.ready&&!j.submitted);if(presentation.ready){audio?.effect('deal',j.id+':'+n.id+':deal');}return()=>audio?.setThinking(false);},[presentation.ready,j.submitted,audio]);
  const visible=Object.entries(q.context.visible??{}).filter(([,count])=>count),bag=Array(18).fill(0) as number[];
  if(!n.scenario){if(q.model.kind==='explicit')for(const tile of q.model.bag)bag[TILES.indexOf(tile)]++;else{const used=countsOf([...q.context.hand,...(q.context.fixedSets??[]).flatMap(setTiles)]);TILES.forEach((t,i)=>bag[i]=4-used[i]-(q.context.visible?.[t]??0));}}
  const submit=()=>{if(lock.current||paused||!answer||!presentation.ready||j.submitted)return;lock.current=true;change(s=>{const current=s.journeys.find(x=>x.id===j.id);return current?.position===j.position?submitStory(s,j.id,j.selected!,elapsed()):s;});audio?.effect('discard',j.id+':'+n.id+':discard');};
  return <div ref={root} className="mj-story-decision" data-presenting={!presentation.ready}>
    {!n.scenario&&<div className="mj-book-margin"><p>{q.model.horizon===1?'她在页边留了记号：摸一次，成了就停。':'她在页边留了记号：最多摸两次，成了就停。'}</p><div className="mj-story-public" aria-label="纸上记下的余牌"><span>余牌</span><div>{TILES.filter((_,i)=>bag[i]>0).map(t=><Tile key={t} tile={t} small detail={'×'+bag[TILES.indexOf(t)]}/>)}</div></div></div>}
    {!!visible.length&&<div className="mj-story-public" aria-label="桌上已经打出的牌"><span>桌上</span><div>{visible.map(([t,count])=><Tile key={t} tile={t as TileId} small detail={'×'+count}/>)}</div></div>}
    {!!q.context.fixedSets?.length&&<div className="mj-story-public" aria-label="已经碰杠的牌"><span>碰杠</span><div>{q.context.fixedSets.map((s,i)=><Hand key={i} tiles={Array(s.kind==='quad'?4:3).fill(s.tile)}/>)}</div></div>}
    <Hand tiles={q.context.hand} selectedIndex={j.selected??-1} disabled={!presentation.ready||j.submitted||paused} onSelect={(_,index)=>{patch({selected:index});audio?.effect('select',crypto.randomUUID());}}/>
    {presentation.error&&<InlineNotice tone="warning" title="有几张牌还没展开。" actions={<Button onClick={presentation.retry}>再试一次</Button>}/>}
    {!j.submitted&&<div className="mj-story-action"><Button variant="ghost" disabled={!answer||!presentation.ready||paused} onClick={submit}>{answer?'打出'+tileName(answer):'选一张牌'}</Button></div>}
  </div>;
}

function StoryResponse({journey:j}:{journey:JourneyState}){
  const {change,audio}=useStory(),n=nodeFor(j),scene=narrativeScene(n,j),answer=n.question.context.hand[j.selected!],lines=[...narrativeResponse(n,j,answer),...scene.after],lock=useRef(false);
  const advance=()=>{if(lock.current)return;lock.current=true;audio?.effect('page',j.id+':'+n.id+':next');change(s=>{const current=s.journeys.find(x=>x.id===j.id);return current?.position===j.position&&current.phase===j.phase?nextStory(s,j.id):s;});};
  return <div className="mj-story-response"><ReadScene id={'after:'+n.id} lines={lines} journey={j} action={scene.next} onNext={advance}/></div>;
}

function ChapterEnd({journey:j}:{journey:JourneyState}){
  const {change,audio}=useStory(),chapter=Math.ceil(j.position/5),scene=chapterClosings[chapter];
  useEffect(()=>{audio?.setThinking(false);if(chapter===3)audio?.silence();},[audio,chapter]);
  return <section className="mj-story-interlude"><ReadScene id={'chapter:'+chapter} lines={scene.lines} journey={j} action={scene.next} onNext={()=>change(s=>{const current=s.journeys.find(x=>x.id===j.id);return current?.phase==='chapter'&&current.position===j.position?nextStory(s,j.id):s;})}/></section>;
}

function Finale({journey:j}:{journey:JourneyState}){
  const {change,audio}=useStory(),scene=endingPages[j.endingStep],reduced=useReducedMotion();
  useEffect(()=>{audio?.setThinking(false);if(j.endingStep===0)audio?.silence();if(j.endingStep===1)void audio?.play('clear-waters');if(j.phase==='done')audio?.silence();},[j.endingStep,j.phase,audio]);
  if(j.phase==='done')return <section className="mj-book-cover mj-book-closed" data-journey-complete="true"><p>这本，我带走。</p><h1>未完的牌谱</h1></section>;
  return <section className="mj-story-finale" data-ending-step={j.endingStep}><ReadScene key={j.endingStep} id={'ending:'+j.endingStep} lines={scene.lines} journey={j} action={scene.next} onNext={()=>{audio?.effect(j.endingStep===3?'close':'page',j.id+':ending:'+j.endingStep);change(s=>{const current=s.journeys.find(x=>x.id===j.id);return current?.phase==='ending'&&current.endingStep===j.endingStep?nextStory(s,j.id):s;});}}/></section>;
}

function Sound({open,onClose,audio}:{open:boolean;onClose():void;audio:AudioDirector|null}){
  const [prefs,setPrefs]=useState(audio?.preferences??{muted:false,volume:0.55});useEffect(()=>{if(audio)setPrefs(audio.preferences);},[audio,open]);
  const update=(muted:boolean,volume=prefs.volume)=>{audio?.settings(muted,volume);setPrefs({muted,volume});if(!muted)void audio?.unlock('clear-waters');};
  return <Dialog open={open} onClose={onClose} title="声音"><div className="mj-sound-controls"><Button variant="ghost" onClick={()=>update(!prefs.muted)}>{prefs.muted?'让声音回来':'静音'}</Button><Select aria-label="音量" value={String(prefs.volume)} onValueChange={v=>update(false,Number(v))} options={[{value:'0.35',label:'轻声'},{value:'0.55',label:'适中'},{value:'0.8',label:'清晰'}]}/></div></Dialog>;
}
