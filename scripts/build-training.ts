// Offline compilation: deterministic structures, theme-specific filters and exact grading.
import { writeFileSync } from 'node:fs';
import { analyze, parseHand, sorted, TILES, countsOf, validateContext, type HandContext, type TileId } from '../src/engine/index.js';
import { structure, type TrainingQuestion } from '../src/training/questions.js';
import { topics, TRAINING_VERSION } from '../src/training/topics.js';
let seed=86171;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const pick=<T>(xs:T[])=>xs[Math.floor(next()*xs.length)];
const meld=()=>{const n=1+Math.floor(next()*7),s=pick(['p','s']);return next()<.8?parseHand(`${n}${n+1}${n+2}${s}`):Array(3).fill(pick(TILES));};
const pair=()=>Array(2).fill(pick(TILES)) as TileId[];
const link=()=>{const n=1+Math.floor(next()*7),s=pick(['p','s']);return parseHand(`${n}${n+(next()<.65?1:2)}${s}`);};
const used=new Set<string>(),out:TrainingQuestion[]=[];
for(const t of topics){
 let n=0,tries=0;
 while(n<12&&tries++<30000){
  let groups:TileId[][]=[],ctx:HandContext;
  if(t.id==='shape'||t.id==='pairs'){groups=[meld(),meld(),meld(),pair(),t.id==='pairs'?pair():link(),[pick(TILES)]];ctx={hand:sorted(groups.flat())};}
  else if(t.id==='seven'){groups=[pair(),pair(),pair(),pair(),pair(),...Array.from({length:4},()=>[pick(TILES)])];ctx={hand:sorted(groups.flat())};}
  else if(t.id==='combined'){
   const fixed=pick(TILES);groups=[meld(),link(),pair(),[pick(TILES)]];
   ctx={hand:sorted(groups.flat()),fixedSets:[{kind:n%2?'quad':'triplet',tile:fixed},{kind:'triplet',tile:pick(TILES)}]};
  }else {groups=[meld(),meld(),link(),link(),link(),pair()];ctx={hand:sorted(groups.flat())};}
  try{validateContext(ctx);}catch{continue;}
  const before=analyze(ctx);if(before.shanten<0)continue;
  if(t.id==='visible'){
   const count=countsOf(ctx.hand),visible:Partial<Record<TileId,number>>={};
   for(let i=0;i<3;i++){const tile=pick(TILES),capacity=4-count[TILES.indexOf(tile)];if(capacity>0)visible[tile]=1+Math.floor(next()*capacity);}
   ctx={...ctx,visible};
  }
  const r=t.id==='visible'?analyze(ctx):before,best=r.discards.filter(d=>d.best),other=r.discards.filter(d=>!d.best);
  if(!best.length||!other.length||best.length>4)continue;
  if((t.id==='shape'||t.id==='pairs')&&(best[0].shanten!==0||!other.some(d=>d.shanten>0)))continue;
  if(t.id==='distance'&&!other.some(d=>d.shanten>best[0].shanten))continue;
  if(['connections','chances','visible'].includes(t.id)&&!other.some(d=>d.shanten===best[0].shanten&&d.ukeire<best[0].ukeire))continue;
  if(t.id==='seven'&&(r.sevenPairs===null||r.sevenPairs>r.normal||r.sevenPairs>2))continue;
  if(t.id==='visible'&&best.every(d=>before.discards.find(b=>b.tile===d.tile)?.best)&&before.discards.filter(d=>d.best).length===best.length)continue;
  const family=structure(ctx);if(used.has(family))continue;used.add(family);n++;
  const note=t.id==='visible'?'先扣除下方已见牌，再比较改善机会。':t.id==='seven'?'这一手要同时比较普通和牌与七对；对子多不代表只能走七对。':t.id==='combined'?'公开碰杠已经占用两组，暗手只需凑足另外两组和一对将。':t.id==='pairs'?'先找将牌，再看多余对子是否值得保留。':t.id==='connections'?'这些连接可能共用牌，比较整手牌的余量，不逐组相加。':t.id==='distance'?'先比较离听牌的距离，距离相同后再比较余量。':t.id==='chances'?'距离相同的舍牌，比较摸到哪些牌能立刻前进一步。':'找出完整组合，再比较剩余牌的连接。';
  out.push({id:`${TRAINING_VERSION}:${t.id}:${String(n).padStart(2,'0')}`,topic:t.id,context:ctx,family,accepted:best.map(d=>d.tile),note,exampleGroups:groups.filter(g=>g.length>1)});
 }
 if(n!==12)throw new Error(`${t.id}: only ${n} questions after ${tries}`);
 console.log(t.id,n);
}
writeFileSync('src/training/questions.json',JSON.stringify(out,null,2)+'\n');
