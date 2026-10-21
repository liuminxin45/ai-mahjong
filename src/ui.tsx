import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, RecordLink, InlineNotice } from 'chatgpt-desktop-kit';
import { useNavigate, useResolvedPath } from 'react-router';
import { analyze, tileName, type AnalysisResult, type HandContext, type TileId } from './engine/index.js';
import type { LearningData, LearningRepository } from './learning/storage.js';
import type { ProfileClient } from './client.js';
export type AppContext={data:LearningData;update:(fn:(data:LearningData)=>LearningData)=>void;assets:string;profileClient:ProfileClient;repository:LearningRepository;notice:(message:string)=>void};
export const LearningContext=createContext<AppContext>(null!);
export const useLearning=()=>useContext(LearningContext);
export function AppLink({to,children,...props}:{to:string;children:ReactNode;actionId?:string;className?:string}){
  const nav=useNavigate(),resolved=useResolvedPath(to,{relative:'path'});return <RecordLink {...props} actionId={props.actionId??`mahjong.navigate.${to}`} href={resolved.pathname+resolved.search} onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();nav(to,{relative:'path'});}}}>{children}</RecordLink>;
}
export function Tile({tile,onClick,selected=false,disabled=false,small=false}:{tile:TileId;onClick?:()=>void;selected?:boolean;disabled?:boolean;small?:boolean}){
  const {assets}=useLearning();const [failed,setFailed]=useState(false);
  const picture=<><img src={`${assets}/${tile}-96.webp`} srcSet={`${assets}/${tile}-96.webp 96w, ${assets}/${tile}-192.webp 192w, ${assets}/${tile}-384.webp 384w`} sizes={small?'32px':'64px'} alt={tileName(tile)} draggable={false} onError={()=>setFailed(true)} hidden={failed}/>{failed&&<span className="mj-missing-tile">{tileName(tile)}</span>}<span className="mj-tile-caption" aria-hidden="true">{tileName(tile)}</span>{selected&&<span className="mj-tile-selection" aria-hidden="true">✓</span>}</>;
  return onClick?<Button layout="surface" className={`mj-tile ${small?'mj-tile--small':''}`} aria-label={tileName(tile)} aria-pressed={selected} onClick={onClick} disabled={disabled}>{picture}</Button>:<span className={`mj-tile mj-tile-static ${small?'mj-tile--small':''}`}>{picture}</span>;
}
export function Hand({tiles,onSelect,selected=[],disabled=false}:{tiles:TileId[];onSelect?:(tile:TileId,index:number)=>void;selected?:TileId[];disabled?:boolean}){
  return <div className="mj-hand" aria-label="手牌">{tiles.map((t,i)=><Tile key={`${t}-${i}`} tile={t} onClick={onSelect?()=>onSelect(t,i):undefined} selected={selected.includes(t)} disabled={disabled}/>)}</div>;
}
export function ErrorNotice({message}:{message:string}){return message?<InlineNotice tone="danger" title={message}/>:null;}
export function useAnalysis(context:HandContext,createWorker?:()=>Worker){
  const [result,setResult]=useState<AnalysisResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const worker=useRef<Worker|null>(null),seq=useRef(0),key=JSON.stringify(context);
  useEffect(()=>{if(createWorker){try{worker.current=createWorker();}catch{worker.current=null;}}return()=>{worker.current?.terminate();worker.current=null;};},[createWorker]);
  useEffect(()=>{
    const id=++seq.current;setBusy(true);setError('');setResult(null);
    const receive=(event:MessageEvent)=>{if(event.data.id!==seq.current)return;setBusy(false);setError(event.data.error??'');setResult(event.data.result??null);};
    const fail=()=>{if(id===seq.current){setBusy(false);setError('分析线程中断，请修改手牌后重试。');}};
    if(worker.current){worker.current.addEventListener('message',receive);worker.current.addEventListener('error',fail);worker.current.postMessage({id,context});return()=>{worker.current?.removeEventListener('message',receive);worker.current?.removeEventListener('error',fail);};}
    const timer=setTimeout(()=>{try{const r=analyze(context);if(id===seq.current){setResult(r);setBusy(false);}}catch(e){if(id===seq.current){setError((e as Error).message);setBusy(false);}}},50);
    return()=>clearTimeout(timer);
  },[key]);
  return {result,error,busy};
}
export function useActiveTime(key:string){
  const total=useRef(0),start=useRef<number|null>(null);
  useEffect(()=>{total.current=0;start.current=document.hidden?null:performance.now();const visibility=()=>{if(document.hidden&&start.current!==null){total.current+=performance.now()-start.current;start.current=null;}else if(!document.hidden&&start.current===null)start.current=performance.now();};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[key]);
  return ()=>Math.min(1800000,Math.round(total.current+(start.current===null?0:performance.now()-start.current)));
}
