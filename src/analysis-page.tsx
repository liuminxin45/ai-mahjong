import { useState } from 'react';
import { Button, Input, Select } from 'chatgpt-desktop-kit';
import { useSearchParams } from 'react-router';
import { countsOf, formatHand, parseHand, setTiles, sorted, TILES, tileName, validateContext, type FixedSet, type HandContext, type TileId } from './engine/index.js';
import { AppLink, ErrorNotice, Hand, Tile, useAnalysis, useLearning } from './ui.js';
import { DiscardTable } from './practice.js';
export function AnalysisPage({createWorker}:{createWorker?:()=>Worker}){
  const [params]=useSearchParams();const {data,update}=useLearning();
  const saved=data.drafts.analysis as {text:string;context:HandContext}|undefined;
  const [text,setText]=useState(params.get('hand')??saved?.text??'123456789p12459s');
  const [context,setContext]=useState<HandContext>(()=>{try{return params.has('hand')?{hand:parseHand(params.get('hand')!)}:saved?.context??{hand:parseHand(text)};}catch{return{hand:[]};}});
  const [inputError,setInputError]=useState(''),[kind,setKind]=useState<FixedSet['kind']>('sequence'),[base,setBase]=useState<TileId>('1p'),[visibleOpen,setVisibleOpen]=useState(false);
  const {result,error,busy}=useAnalysis(context,createWorker);
  const save=(next:HandContext,nextText=formatHand(next.hand))=>{setContext(next);setText(nextText);setInputError('');update(d=>({...d,drafts:{...d.drafts,analysis:{context:next,text:nextText}}}));};
  const edit=(v:string)=>{setText(v);try{const next={...context,hand:parseHand(v)};validateContext(next,false);save(next,v);}catch(e){setInputError((e as Error).message);}};
  const add=(tile:TileId)=>{const next={...context,hand:[...context.hand,tile]};try{validateContext(next,false);save(next);}catch(e){setInputError((e as Error).message);}};
  const addSet=()=>{try{const set={kind,tile:base};const tiles=setTiles(set);const hand=[...context.hand];if(tiles.every((t,i)=>hand.filter(x=>x===t).length>=tiles.slice(0,i+1).filter(x=>x===t).length))for(const t of tiles)hand.splice(hand.indexOf(t),1);const next={...context,hand,fixedSets:[...(context.fixedSets??[]),set]};validateContext(next,false);save(next);}catch(e){setInputError((e as Error).message);}};
  return <div className="mj-page"><div className="mj-page-heading"><div><p className="mj-eyebrow">把每个选择的依据看清</p><h1>手牌分析</h1></div><Button variant="ghost" onClick={()=>save({hand:[]})}>清空</Button></div>
    <div className="mj-analysis-layout"><section><label className="mj-field"><span>输入手牌 · p筒 / s条</span><Input aria-label="输入手牌" value={text} onChange={e=>edit(e.target.value)} placeholder="例如123456789p12459s" aria-invalid={!!inputError}/></label><p className="mj-muted">点击下方牌添加，点击手牌移除。当前{context.hand.length}张，固定组合{context.fixedSets?.length??0}组。</p>
      <Hand tiles={context.hand} onSelect={(_,i)=>save({...context,hand:context.hand.filter((_,j)=>i!==j)})}/>
      <h2>选牌</h2><div className="mj-palette">{TILES.map(t=><Tile key={t} tile={t} onClick={()=>add(t)} disabled={context.hand.length>=14}/>)}</div>
      <details className="mj-editor-details"><summary>固定组合编辑</summary><p className="mj-muted">组合已在手牌中时，会移出对应牌；其他公开牌在下方单独填写。</p><div className="mj-actions"><Select aria-label="组合类型" value={kind} onValueChange={v=>setKind(v as FixedSet['kind'])} options={[{value:'sequence',label:'顺子'},{value:'triplet',label:'刻子'},{value:'quad',label:'杠子'}]}/><Select aria-label="组合起始牌" value={base} onValueChange={v=>setBase(v as TileId)} options={TILES.map(value=>({value,label:tileName(value)}))}/><Button disabled={(context.fixedSets?.length??0)>=4} onClick={addSet}>添加组合</Button></div>{context.fixedSets?.map((s,i)=><div className="mj-fixed-set" key={i}><Hand tiles={setTiles(s)}/><Button size="sm" onClick={()=>save({...context,hand:[...context.hand,...setTiles(s)],fixedSets:context.fixedSets!.filter((_,j)=>i!==j)})}>放回手牌</Button></div>)}</details>
      <details className="mj-editor-details" open={visibleOpen} onToggle={e=>setVisibleOpen(e.currentTarget.open)}><summary>其他可见牌</summary><p className="mj-muted">只填写手牌与自己的固定组合之外，已经公开的牌。</p><div className="mj-visible-grid">{TILES.map(t=><label className="mj-visible-item" key={t}><span>{tileName(t)}</span><Input type="number" min={0} max={4} aria-label={`${tileName(t)}其他可见数量`} value={context.visible?.[t]??0} onChange={e=>save({...context,visible:{...context.visible,[t]:Number(e.target.value)}})}/></label>)}</div></details>
      <ErrorNotice message={inputError||error}/>
    </section><section className="mj-analysis-results" aria-live="polite"><h2>分析结果</h2>{busy?<p>正在计算…</p>:result&&!inputError?<><div className="mj-stat-line"><div><span>综合向听</span><strong>{result.shanten===-1?'已成牌':result.shanten}</strong></div><div><span>普通型</span><strong>{result.normal}</strong></div><div><span>七对</span><strong>{result.sevenPairs??'不可用'}</strong></div></div>
      {result.waits.length>0&&<><h3>全部形状听口</h3><div className="mj-improvements">{result.waits.map(t=><div key={t.tile}><Tile tile={t.tile}/><span>{t.remaining===0?'已经见尽':`剩余${t.remaining}张`}</span></div>)}</div></>}
      {result.improvements.length>0&&!result.waits.length&&<><h3>有效进张</h3><div className="mj-improvements">{result.improvements.map(t=><div key={t.tile}><Tile tile={t.tile}/><span>剩余{t.remaining}张</span></div>)}</div></>}
      {result.discards.length>0&&<><h3>舍牌比较</h3><DiscardTable result={result}/></>}
      {result.decomposition&&<><h3>一种完整拆法</h3><div className="mj-decomposition">{result.decomposition.map((g,i)=><Hand key={i} tiles={g}/>)}</div></>}
      <p className="mj-muted">先比较向听，再比较进张；进张是当前改善张数，不是实战和牌概率。</p><AppLink to="../manual/lesson-09">了解可见牌如何影响结果 →</AppLink></>:!busy&&<p className="mj-muted">输入有效的13或14张手牌后开始分析；有固定组合时，手牌张数会相应减少。</p>}</section></div></div>;
}
