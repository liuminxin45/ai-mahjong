import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent,type ReactNode} from 'react';
import {Button} from 'chatgpt-desktop-kit';
import {useReducedMotion,useTimeline} from '../experience/presentation.js';
import {patchJourney,type JourneyState} from './core.js';
import {readingDuration} from './narrative.js';
import {useStory} from './context.js';

function consume(e:KeyboardEvent|PointerEvent) {
  e.preventDefault();e.stopPropagation();
  const type=e.type==='keydown'?'keyup':'click',key=e.type==='keydown'?(e as KeyboardEvent).key:undefined;
  const swallow=(next:Event)=>{if(key&&next instanceof globalThis.KeyboardEvent&&next.key!==key)return;next.preventDefault();next.stopImmediatePropagation();clearTimeout(timer);document.removeEventListener(type,swallow,true);};
  const timer=setTimeout(()=>document.removeEventListener(type,swallow,true),500);
  document.addEventListener(type,swallow,true);
}

/** Authored text owns the rhythm. Reading progress is local and never profiling evidence. */
export function ReadScene({id,lines,journey,mode='page',action,onComplete,onNext,children}:{
  id:string;lines:string[];journey:JourneyState;mode?:'page'|'single';action?:string;onComplete?():void;onNext?():void;children?:ReactNode;
}) {
  const {change,paused}=useStory(),reduced=useReducedMotion(),root=useRef<HTMLDivElement>(null),animation=useRef<Animation|null>(null),lock=useRef(false);
  const stored=journey.readScenes?.includes(id)??false;
  const [revealed,setRevealed]=useState(stored?lines.length:journey.reading?.scene===id?Math.min(journey.reading.revealed,lines.length):0);
  const complete=stored||revealed>=lines.length;
  const callback=useRef(onComplete);callback.current=onComplete;
  const persist=(count:number)=>{
    change(s=>{const j=s.journeys.find(j=>j.id===journey.id);if(!j)return s;const logs=new Map((j.readingLog??[]).map(l=>[l.id,l]));for(let i=0;i<count;i++)logs.set(id+':'+i,{id:id+':'+i,text:lines[i]});return patchJourney(s,j.id,{reading:{scene:id,revealed:count},readingLog:[...logs.values()],readScenes:count===lines.length?[...new Set([...(j.readScenes??[]),id])]:j.readScenes});});
    setRevealed(count);
  };
  useEffect(()=>{if(complete){callback.current?.();return;}root.current?.focus({preventScroll:true});},[complete,id]);
  useTimeline(!complete&&!reduced,id+':'+revealed,paused,()=>{
    const element=root.current?.querySelector<HTMLElement>('[data-line="'+revealed+'"]');if(!element)return [];
    const hold=readingDuration(lines[revealed]),duration=900+hold+(mode==='single'?1000:200);
    const frames=mode==='single'?[{opacity:0},{opacity:1,offset:900/duration},{opacity:1,offset:(900+hold)/duration},{opacity:0,offset:(duration-300)/duration},{opacity:0}]:[{opacity:0},{opacity:1,offset:900/duration},{opacity:1}];
    const a=element.animate(frames,{duration,fill:'both',easing:'linear'});animation.current=a;return[a];
  },()=>persist(revealed+1));
  const advance=(e:KeyboardEvent|PointerEvent)=>{
    if(paused||complete||(e.target as HTMLElement).closest('button,a,input,[role=dialog]'))return;
    if(e.type==='keydown'){const k=e as KeyboardEvent;if(k.nativeEvent.isComposing||k.repeat||!['Enter',' ','Escape','ArrowRight'].includes(k.key))return;}
    consume(e);if(reduced)persist(revealed+1);else animation.current?.finish();
  };
  const next=()=>{if(lock.current||!complete)return;lock.current=true;onNext?.();};
  return <div ref={root} className={'mj-reading mj-reading--'+mode} data-reading={id} data-complete={complete} tabIndex={complete?-1:0} onPointerDown={advance} onKeyDown={advance}>
    {mode==='single'?(!complete&&<p key={revealed} data-line={revealed} className="mj-reading-line" aria-live="polite" style={{opacity:reduced?1:0}}>{lines[revealed]}</p>):<div className="mj-reading-page" aria-live="polite">{lines.slice(0,Math.min(lines.length,revealed+(complete?0:1))).map((line,i)=><p key={i} data-line={i} style={{opacity:i<revealed||reduced?1:0}}>{line}</p>)}</div>}
    {reduced&&!complete&&<Button variant="ghost" className="mj-reader-turn" onClick={()=>persist(revealed+1)} aria-label="继续阅读">读下去</Button>}
    {complete&&children}
    {complete&&action&&<Button variant="ghost" className="mj-reader-turn" onClick={next}>{action}</Button>}
  </div>;
}
