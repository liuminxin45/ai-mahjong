import { useRef, useState } from 'react';
import { Button, Dialog, Input, Tabs } from 'chatgpt-desktop-kit';
import { useSearchParams } from 'react-router';
import { formatHand, setTiles, sorted, TILES, type FixedSet, type HandContext, type TileId } from './engine/index.js';
import { availableTiles, changeVisible, checkedEdit, fixSet, handLimit, parseEditorHand, unfixSet } from './hand-editor.js';
import { AppLink, ErrorNotice, Hand, Tile, useAnalysis, useLearning } from './ui.js';
import { DiscardTable, HandMetricsHelp } from './practice.js';

function TilePicker({label,remaining,onSelect,disabled=()=>false,selected}:{label:string;remaining:number[];onSelect:(tile:TileId)=>void;disabled?:(tile:TileId)=>boolean;selected?:TileId}){
  return <div className="mj-tile-picker" role="group" aria-label={label}>{(['p','s'] as const).map((suit,index)=><div className="mj-picker-suit" key={suit}><span className="mj-muted">{suit==='p'?'筒子':'条子'}</span><div className="mj-picker-row">{TILES.slice(index*9,index*9+9).map((tile,i)=><Tile key={tile} tile={tile} onClick={()=>onSelect(tile)} selected={selected===tile} disabled={disabled(tile)} detail={remaining[index*9+i]===4?undefined:remaining[index*9+i]>0?`余${remaining[index*9+i]}张`:'已用完'}/>)}</div></div>)}</div>;
}
const setNames={sequence:'顺子',triplet:'刻子',quad:'杠子'};
export function AnalysisPage({createWorker}:{createWorker?:()=>Worker}){
  const [params]=useSearchParams();const {data,update}=useLearning();
  const saved=data.drafts.analysis as {text:string;context:HandContext}|undefined;
  const [context,setContext]=useState<HandContext>(()=>{try{return params.has('hand')?checkedEdit({hand:parseEditorHand(params.get('hand')!)}):saved?.context??{hand:[]};}catch{return{hand:[]};}});
  const [history,setHistory]=useState<HandContext[]>([]),[inputError,setInputError]=useState('');
  const [target,setTarget]=useState('hand'),[kind,setKind]=useState<FixedSet['kind']>('triplet'),[base,setBase]=useState<TileId>('1p');
  const [textOpen,setTextOpen]=useState(false),[text,setText]=useState(''),[textError,setTextError]=useState('');
  const textTrigger=useRef<HTMLButtonElement>(null);
  const limit=handLimit(context),complete=[limit-1,limit].includes(context.hand.length),remaining=availableTiles(context);
  const {result,error,busy}=useAnalysis(context,createWorker,complete);
  const store=(next:HandContext)=>{setContext(next);setInputError('');update(d=>({...d,drafts:{...d.drafts,analysis:{context:next,text:formatHand(next.hand)}}}));};
  const save=(next:HandContext)=>{try{const checked=checkedEdit(next);setHistory(items=>[...items.slice(-29),context]);store(checked);}catch(e){setInputError((e as Error).message);}};
  const undo=()=>{const previous=history.at(-1);if(previous){setHistory(history.slice(0,-1));store(previous);}};
  const remove=(tile:TileId)=>{const hand=[...context.hand];hand.splice(hand.indexOf(tile),1);save({...context,hand});};
  const visible=TILES.filter(tile=>(context.visible?.[tile]??0)>0),candidate={kind,tile:base};let candidateError='';
  try{fixSet(context,candidate);}catch(e){candidateError=(e as Error).message;}
  const applyText=()=>{try{save(checkedEdit({...context,hand:parseEditorHand(text)}));setTextOpen(false);}catch(e){setTextError((e as Error).message);}};
  const changeKind=(value:string)=>{setKind(value as FixedSet['kind']);if(value==='sequence'&&Number(base[0])>7)setBase(`7${base[1]}` as TileId);};
  return <div className="mj-page"><div className="mj-page-heading"><h1>手牌分析</h1></div>
    <div className="mj-analysis-layout"><section className="mj-hand-editor" aria-label="手牌编辑器">
      <div className="mj-editor-heading"><h2>我的手牌</h2><span role="status" className="mj-muted">{context.hand.length} / {limit}张{context.fixedSets?.length?` · 已固定${context.fixedSets.length}组`:''}</span></div>
      <div className="mj-editor-commands"><Button size="sm" variant="ghost" disabled={!history.length} onClick={undo}>撤销</Button><Button size="sm" variant="ghost" disabled={!context.hand.length} onClick={()=>save({...context,hand:[]})}>清空手牌</Button><Button ref={textTrigger} size="sm" variant="ghost" onClick={()=>{setText(formatHand(context.hand).replaceAll('p','筒').replaceAll('s','条'));setTextError('');setTextOpen(true);}}>粘贴牌谱</Button></div>
      {context.hand.length?<Hand tiles={sorted(context.hand)} onSelect={remove}/>:<div className="mj-hand-empty"><p>从下方点选牌，组成你的手牌。</p><Button size="sm" onClick={()=>save({hand:parseEditorHand('123456789筒12459条')})}>试用示例牌</Button></div>}
      {!!context.fixedSets?.length&&<div className="mj-fixed-list" aria-label="已固定组合">{context.fixedSets.map((set,index)=>{let restore=true;try{unfixSet(context,index,true);}catch{restore=false;}return <div className="mj-fixed-set" key={index}><div><span className="mj-muted">{setNames[set.kind]}</span><Hand tiles={setTiles(set)}/></div><div className="mj-fixed-actions"><Button size="sm" variant="ghost" disabled={!restore} onClick={()=>save(unfixSet(context,index,true))}>还原手牌</Button><Button size="sm" variant="ghost" onClick={()=>save(unfixSet(context,index,false))}>移除组合</Button></div></div>;})}</div>}
      <Tabs value={target} onValueChange={setTarget} ariaLabel="编辑内容" items={[{value:'hand',label:'手牌'},{value:'sets',label:'固定组合'},{value:'visible',label:'可见牌'}]}/>
      {target==='hand'&&<div className="mj-editor-panel"><p className="mj-muted">{context.hand.length>=limit?'手牌已满。点按上方手牌移除，再选新牌。':'点选下方牌添加，点按上方手牌移除。'}{context.hand.length<limit-1?`再选${limit-1-context.hand.length}张即可分析听口。`:''}</p><TilePicker label="添加手牌" remaining={remaining} onSelect={tile=>save({...context,hand:[...context.hand,tile]})} disabled={tile=>context.hand.length>=limit||remaining[TILES.indexOf(tile)]<=0}/></div>}
      {target==='sets'&&<div className="mj-editor-panel"><p className="mj-muted">选择牌面后固定为碰或杠。</p><Tabs value={kind} onValueChange={changeKind} ariaLabel="固定组合类型" items={[{value:'triplet',label:'碰牌'},{value:'quad',label:'杠牌'}]}/><div className="mj-set-preview"><Hand tiles={setTiles(candidate)}/><Button variant="primary" disabled={!!candidateError} onClick={()=>save(fixSet(context,candidate))}>固定这组</Button></div>{candidateError&&<p className="mj-muted">{candidateError}</p>}<TilePicker label="选择组合牌面" remaining={remaining} selected={base} onSelect={setBase}/></div>}
      {target==='visible'&&<div className="mj-editor-panel"><p className="mj-muted">记录其他公开牌：下方添加，上方移除。</p>{visible.length>0?<div className="mj-visible-tiles" role="group" aria-label="已记录的可见牌">{visible.map(tile=><Tile key={tile} tile={tile} detail={`已见${context.visible![tile]}张`} onClick={()=>save(changeVisible(context,tile,-1))}/>)}</div>:<p className="mj-muted">暂无其他可见牌。</p>}<TilePicker label="添加可见牌" remaining={remaining} onSelect={tile=>save(changeVisible(context,tile,1))} disabled={tile=>remaining[TILES.indexOf(tile)]<=0}/></div>}
      <ErrorNotice message={inputError||error}/>
    </section><section className="mj-analysis-results" aria-live="polite"><h2>分析结果</h2>{busy?<p>正在计算…</p>:result&&!inputError?<><div className="mj-stat-line"><div><span>综合向听</span><strong>{result.shanten===-1?'已成牌':result.shanten}</strong></div><div><span>普通型</span><strong>{result.normal===-1?'已成牌':result.normal}</strong></div><div><span>七对</span><strong>{result.sevenPairs===-1?'已成牌':result.sevenPairs??'不可用'}</strong></div></div><HandMetricsHelp/>
      {result.waits.length>0&&<><h3>可和牌种</h3><div className="mj-improvements">{result.waits.map(tile=><div key={tile.tile}><Tile tile={tile.tile}/><span>{tile.remaining===0?'已经见尽':`剩余${tile.remaining}张`}</span></div>)}</div></>}
      {result.improvements.length>0&&!result.waits.length&&<><h3>有效进张</h3><div className="mj-improvements">{result.improvements.map(tile=><div key={tile.tile}><Tile tile={tile.tile}/><span>剩余{tile.remaining}张</span></div>)}</div></>}
      {result.discards.length>0&&<><h3>舍牌比较</h3><DiscardTable result={result} explainTerms={false}/></>}
      {result.decomposition&&<><h3>一种完整拆法</h3><div className="mj-decomposition">{result.decomposition.map((group,index)=><Hand key={index} tiles={group}/>)}</div></>}
      </>:!busy&&<p className="mj-muted">{context.hand.length<limit-1?`再选${limit-1-context.hand.length}张即可分析。`:'请调整手牌后查看分析。'}</p>}</section></div>
    <Dialog open={textOpen} onClose={()=>setTextOpen(false)} onCloseAutoFocus={event=>{if(textTrigger.current?.isConnected){event.preventDefault();textTrigger.current.focus();}}} title="粘贴牌谱" description="粘贴已有的文字牌谱。" footer={<><Button onClick={()=>setTextOpen(false)}>取消</Button><Button variant="primary" onClick={applyText}>应用手牌</Button></>}><label className="mj-field"><span>手牌牌谱</span><Input aria-label="手牌牌谱" value={text} onChange={event=>{setText(event.target.value);setTextError('');}} placeholder="例如123456789筒12459条" aria-invalid={!!textError}/></label><p className="mj-muted">例如123筒456条，也支持p、s写法。固定组合和可见牌会保留。</p><ErrorNotice message={textError}/></Dialog>
  </div>;
}
