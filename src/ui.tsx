import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, RecordLink, InlineNotice } from 'chatgpt-desktop-kit';
import { useNavigate, useResolvedPath } from 'react-router';
import { analyze, tileName, type AnalysisResult, type HandContext, type TileId } from './engine/index.js';
import type { LearningData, LearningRepository } from './learning/storage.js';
import type { ProfileClient } from './client.js';
import type { CompetitionClient } from './learning/competition.js';
export type AppContext={data:LearningData;update:(fn:(data:LearningData)=>LearningData)=>void;assets:string;profileClient:ProfileClient;competitionClient:CompetitionClient;repository:LearningRepository;notice:(message:string)=>void};
export const LearningContext=createContext<AppContext>(null!);
export const useLearning=()=>useContext(LearningContext);
export function AppLink({to,children,...props}:{to:string;children:ReactNode;actionId?:string;className?:string}){
  const nav=useNavigate(),resolved=useResolvedPath(to,{relative:'path'});return <RecordLink {...props} actionId={props.actionId??`mahjong.navigate.${to}`} href={resolved.pathname+resolved.search} onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();nav(to,{relative:'path'});}}}>{children}</RecordLink>;
}
export function Tile({tile,onClick,selected=false,disabled=false,small=false,detail}:{tile:TileId;onClick?:()=>void;selected?:boolean;disabled?:boolean;small?:boolean;detail?:string}){
  const {assets}=useLearning();const [failed,setFailed]=useState(false);
  const picture=<><img src={`${assets}/${tile}-96.webp`} srcSet={`${assets}/${tile}-96.webp 96w, ${assets}/${tile}-192.webp 192w, ${assets}/${tile}-384.webp 384w`} sizes={small?'32px':'64px'} alt={tileName(tile)} draggable={false} onError={()=>setFailed(true)} hidden={failed}/>{failed&&<span className="mj-missing-tile">{tileName(tile)}</span>}<span className="mj-tile-caption" aria-hidden="true">{tileName(tile)}</span>{selected&&<span className="mj-tile-selection" aria-hidden="true">✓</span>}</>;
  return onClick?<Button layout="surface" className={`mj-tile ${small?'mj-tile--small':''}`} aria-label={tileName(tile)} aria-pressed={selected} onClick={onClick} disabled={disabled}>{picture}{detail&&<span className="mj-tile-detail" aria-hidden="true">{detail}</span>}</Button>:<span className={`mj-tile mj-tile-static ${small?'mj-tile--small':''}`}>{picture}{detail&&<span className="mj-tile-detail">{detail}</span>}</span>;
}
export function Hand({tiles,onSelect,selected=[],selectedIndex,disabled=false}:{tiles:TileId[];onSelect?:(tile:TileId,index:number)=>void;selected?:TileId[];selectedIndex?:number;disabled?:boolean}){
  return <div className="mj-hand" aria-label="手牌">{tiles.map((t,i)=><Tile key={`${t}-${i}`} tile={t} onClick={onSelect?()=>onSelect(t,i):undefined} selected={selectedIndex===undefined?selected.includes(t):selectedIndex===i} disabled={disabled}/>)}</div>;
}
export function ErrorNotice({message}:{message:string}){return message?<InlineNotice tone="danger" title={message}/>:null;}
export function useAnalysis(context:HandContext,createWorker?:()=>Worker,enabled=true){
  const [result,setResult]=useState<AnalysisResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const worker=useRef<Worker|null>(null),seq=useRef(0),key=JSON.stringify(context);
  useEffect(()=>{if(createWorker){try{worker.current=createWorker();}catch{worker.current=null;}}return()=>{worker.current?.terminate();worker.current=null;};},[createWorker]);
  useEffect(()=>{
    const id=++seq.current;setBusy(enabled);setError('');setResult(null);
    if(!enabled)return;
    const receive=(event:MessageEvent)=>{if(event.data.id!==seq.current)return;setBusy(false);setError(event.data.error??'');setResult(event.data.result??null);};
    const fail=()=>{if(id===seq.current){setBusy(false);setError('分析线程中断，请修改手牌后重试。');}};
    if(worker.current){worker.current.addEventListener('message',receive);worker.current.addEventListener('error',fail);worker.current.postMessage({id,context});return()=>{worker.current?.removeEventListener('message',receive);worker.current?.removeEventListener('error',fail);};}
    const timer=setTimeout(()=>{try{const r=analyze(context);if(id===seq.current){setResult(r);setBusy(false);}}catch(e){if(id===seq.current){setError((e as Error).message);setBusy(false);}}},50);
    return()=>clearTimeout(timer);
  },[key,enabled]);
  return {result,error,busy};
}
export function useActiveTime(key:string,paused=false){
  const total=useRef(0),start=useRef<number|null>(null),activeKey=useRef<string|null>(null);
  useEffect(()=>{
   const storageKey='neo-mahjong-active:'+key;
   if(activeKey.current!==key){activeKey.current=key;try{const saved=Number(sessionStorage.getItem(storageKey));total.current=Number.isFinite(saved)&&saved>=0&&saved<=1800000?saved:0;}catch{total.current=0;}}
   start.current=document.hidden||paused?null:performance.now();
   const stop=()=>{if(start.current!==null){total.current=Math.min(1800000,total.current+performance.now()-start.current);start.current=null;}};
   const persist=()=>{try{sessionStorage.setItem(storageKey,String(Math.min(1800000,total.current+(start.current===null?0:performance.now()-start.current))));}catch{}};
   const visibility=()=>{if(document.hidden||paused)stop();else if(start.current===null)start.current=performance.now();persist();};
   const interval=setInterval(persist,1000);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',persist);
   return()=>{stop();persist();clearInterval(interval);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',persist);};
  },[key,paused]);
  return ()=>Math.min(1800000,Math.round(total.current+(start.current===null?0:performance.now()-start.current)));
}
