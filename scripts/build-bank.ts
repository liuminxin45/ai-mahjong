import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { analyze, countsOf, parseHand, setTiles, sorted, TILES, tileName, validateContext, type HandContext, type TileId, type FixedSet } from '../src/engine/index.js';
import { solveDrawModel, type DrawModel } from '../src/engine/deep.js';
import { answers, MODES, MODE_NAMES, type Exercise, type Mode } from '../src/learning/index.js';
import { BANK_VERSION, DIFFICULTIES, SKILLS } from '../src/learning/curriculum.js';
import { canonicalFamily, type BankExercise } from '../src/learning/bank.js';
import { verifyModel } from './verify-model.js';

let state=20261021;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const pick=<T>(xs:T[]):T=>xs[Math.floor(random()*xs.length)];
const shuffle=<T>(xs:T[]):T[]=>{for(let i=xs.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[xs[i],xs[j]]=[xs[j],xs[i]];}return xs;};
function context(mode:Mode,level:number):HandContext{
 const count=mode==='seven-pairs'?0:mode==='waits'?Math.max(0,4-level):level<=3?4-level:0;
 const fixedSets:FixedSet[]=[],known=Array(18).fill(0),hand:TileId[]=[];
 for(let i=0;i<count;i++){const tile=pick(TILES.filter((_,j)=>known[j]===0));known[TILES.indexOf(tile)]=3;fixedSets.push({kind:'triplet',tile});}
 const add=(tiles:TileId[])=>{const c=countsOf(tiles);if(c.some((n,i)=>n+known[i]>4))return false;tiles.forEach(t=>{hand.push(t);known[TILES.indexOf(t)]++;});return true;};
 if(mode==='seven-pairs'){
  const pairTypes=shuffle([...TILES]);const n=level<=2?6:level===3?5:level===4?4:5;
  for(const t of pairTypes.slice(0,n))add([t,t]);
  if(level===2&&random()<.5){const t=pick(pairTypes.slice(0,n));add([t,t]);}
  while(hand.length<14){const t=pick(TILES.filter((_,i)=>known[i]<4));add([t]);}
 }else{
  for(let g=0;g<4-count;g++)for(let tries=0;tries<200;tries++){
   const suit=level>=5?'p':random()<.5?'p':'s',rank=1+Math.floor(random()*7),tile=`${rank}${suit}` as TileId;
   const group=random()<.18?[tile,tile,tile]:[tile,`${rank+1}${suit}`,`${rank+2}${suit}`] as TileId[];
   if(add(group))break;
  }
  const pair=pick(TILES.filter((_,i)=>known[i]<=2));add([pair,pair]);
  const short=mode==='waits'||mode==='ukeire';
  if(short)hand.splice(Math.floor(random()*hand.length),1);
  // Break one part for discard/ukeire: never randomize away the tier's structure.
  if(mode!=='waits'&&random()<.75){hand.splice(Math.floor(random()*hand.length),1);const now=countsOf([...hand,...fixedSets.flatMap(setTiles)]);hand.push(pick(TILES.filter((_,i)=>now[i]<4)));}
 }
 const ctx:HandContext={hand:sorted(hand),...(fixedSets.length?{fixedSets}:{})};
 if(level>=3&&level<5){const c=countsOf([...hand,...fixedSets.flatMap(setTiles)]),visible:Partial<Record<TileId,number>>={};
  for(let i=0;i<(level===3?2:6);i++){const t=pick(TILES.filter((_,j)=>c[j]<4));c[TILES.indexOf(t)]++;visible[t]=(visible[t]??0)+1;}ctx.visible=visible;
 }
 validateContext(ctx);return ctx;
}
const records:BankExercise[]=[],families=new Set<string>();
for(const mode of MODES)for(const level of DIFFICULTIES){
 let accepted=0,tries=0;
 while(accepted<24){
  if(++tries>10000)throw new Error(`无法补齐覆盖 ${mode}/${level}`);
  const ctx=context(mode,level),r=analyze(ctx);
  if(mode==='waits'&&(!r.waits.length||level===1&&r.waits.length!==1||level>=4&&r.waits.length<2))continue;
  if(mode==='ukeire'&&level<5&&(!r.improvements.length||r.shanten<0))continue;
  if(mode!=='waits'&&mode!=='seven-pairs'&&r.shanten===-1)continue;
  const skills=SKILLS.filter(s=>s.mode===mode),skill=skills[accepted%skills.length];
  const q:Exercise={id:'pending',ref:{mode,seed:0},context:ctx,title:MODE_NAMES[mode],prompt:mode==='waits'?'选出全部形状听口，包括已经见尽但结构可和的牌种。':mode==='ukeire'?'选出全部仍有余量、能降低综合向听的牌种。':mode==='seven-pairs'?'仅比较七对路线：先看向听，再看剩余进张。':'先比较舍牌后向听，再比较剩余进张，选择一张舍牌。',lessonId:skill.lessonId};
  if(mode==='defense'){
   const goal=accepted%3===0?'efficiency':accepted%3===1?'safety':'balance';
   const waits=shuffle([...new Set(ctx.hand)]).slice(0,level>=3?3:1);
   q.scenario={id:'pending',title:'公开事实下的攻防选择',goal,context:ctx,waits,rivers:ctx.visible?[{label:'公开弃牌（已计入可见数）',tiles:Object.entries(ctx.visible).flatMap(([t,n])=>Array(n).fill(t))}]:[],publicSets:[],facts:[`已确认的对手等待：${waits.join('、')}。${level>=3?'这是两家对手等待集合的并集。':'这是当前题设已确认的信息。'}`,'其余对手手牌未知；旧弃牌不提供永久安全保证。','本题采用成都缺门后的双花色专项约定，不使用吃牌、地区计分或日麻振听结论。'],rationale:'根据题目目标区分效率与已确认危险；未列入等待的牌只在本题已知条件下可选，不代表实战绝对安全。',lessonId:skill.lessonId};
   q.prompt=goal==='efficiency'?'效率优先：按向听、进张选择舍牌；风险另外解释。':'安全优先：避开已确认等待，再比较向听与进张。';
  }
  let judgmentTile:TileId|undefined,judgmentCorrect=false;
  if(mode==='defense'&&level<=4&&accepted%4<2){
   const uncertain=accepted%4===0,known=countsOf([...ctx.hand,...(ctx.fixedSets??[]).flatMap(setTiles)]);
   judgmentTile=ctx.hand.find(t=>uncertain?known[TILES.indexOf(t)]+(ctx.visible?.[t]??0)<4:!q.scenario!.waits.includes(t));
   if(!judgmentTile)continue;
   judgmentCorrect=!uncertain;
   if(uncertain){ctx.visible={...ctx.visible,[judgmentTile]:(ctx.visible?.[judgmentTile]??0)+1};q.scenario!.waits=[];}
   q.title=uncertain?'旧弃牌能保证未来安全吗？':'已确认信息的适用范围';
   q.prompt=uncertain?`对手早巡弃过${tileName(judgmentTile)}，暗手与当前等待未知。仅凭这条弃牌，能否保证${tileName(judgmentTile)}以后永远不会放铳？`:`本题只判断这位对手当前已确认的完整等待集合，不考虑其他对手与后续摸打。能否确定${tileName(judgmentTile)}当前不在这位对手的等待集合内？`;
   q.scenario!.facts=uncertain?[`已知：对手早巡弃过${tileName(judgmentTile)}。`,'未知：当前暗手、等待与后续摸打。成都规则不能从一次旧弃牌推出永久安全。']:[`已确认这位对手当前完整等待集合：${q.scenario!.waits.map(tileName).join('、')}。`,`目标牌为${tileName(judgmentTile)}；只判断当前集合的包含关系。`,'这个结论不保证其他对手与下一次摸打后的安全。'];
   q.scenario!.rivers=ctx.visible?[{label:'公开牌（已计入可见数）',tiles:Object.entries(ctx.visible).flatMap(([t,n])=>Array(n).fill(t))}]:[];
  }
  let deep:BankExercise['deep'];
  if(level>=5&&mode!=='waits'){
   const held=countsOf([...ctx.hand,...(ctx.fixedSets??[]).flatMap(setTiles)]),available=TILES.flatMap((t,i)=>Array(4-held[i]).fill(t) as TileId[]);
   // Use a fully stated small bag: finite exact search, not a wall/probability guess.
   const relevant=shuffle(available.filter(t=>mode==='seven-pairs'?ctx.hand.includes(t):t[1]==='p'||ctx.hand.includes(t)));
   const h=level===5?2:4+accepted%3,bag=sorted(relevant.slice(0,level===5?h+2:h+2));
   const safe=mode==='defense'&&q.scenario!.goal!=='efficiency'?[...new Set(ctx.hand)].filter(t=>!q.scenario!.waits.includes(t)):undefined;
   if(safe?.length===0)continue;
   const model:DrawModel={version:1,bag,horizon:h,target:mode==='seven-pairs'?'seven-pairs':'win',kind:mode==='ukeire'?'first-draw':'discard',...(safe?{safeDiscards:safe}:{})};
   let solved:ReturnType<typeof solveDrawModel>;try{solved=solveDrawModel(ctx,model,1000000);}catch{continue;}
   if(solved.options.every(o=>o.numerator==='0')||solved.answers.length===solved.options.length)continue;
   if(level===6){const ranked=[...new Set(solved.options.map(o=>o.numerator))].map(BigInt).sort((a,b)=>a>b?-1:a<b?1:0);if(solved.nodes<(h===4?2000:h===5?8000:20000)||ranked.length<2||(ranked[0]-ranked[1])*10n>BigInt(solved.options[0].denominator))continue;}
   const check=verifyModel(ctx,model,1000000);
   if(JSON.stringify([...solved.options].sort((a,b)=>a.tile.localeCompare(b.tile)))!==JSON.stringify(check))throw new Error('独立校验不一致');
   deep={...solved,verified:true,verifier:'independent-path-enumeration-v1'};
   q.prompt=(mode==='ukeire'?'选出首摸后、允许后续最优摸打时，窗口内成牌机会最高的全部牌种。':mode==='defense'&&safe?'先避开已确认危险，再选择窗口内成牌机会最高的舍牌。':'选择在窗口内成牌机会最高的舍牌。')+` 未来${h}次摸牌，均匀不放回；抽牌袋已全部列出，无对手行动。`;
  }
  const dualRoute=mode==='seven-pairs'&&level>=3&&level<=4&&accepted%4===0;
  if(dualRoute)q.prompt='同时考虑普通型与七对：比较综合向听，再比较综合进张，选择舍牌。';
  let expected:TileId[];try{expected=judgmentTile?(judgmentCorrect?[judgmentTile]:[]):deep?.answers??(dualRoute?r.discards.filter(d=>d.best).map(d=>d.tile):answers(q));}catch{continue;}
  const ids:string[]=[];
  const tag=(name:string)=>ids.push(`${mode}.${name}`);
  if(mode==='discard'){if(deep)tag('planning');else{tag('distance');tag('comparison');if(new Set(ctx.hand).size>=6)tag('shapes');if(expected.length>1)tag('ties');if(!ctx.fixedSets?.length&&r.sevenPairs!==null&&Math.abs(r.normal-r.sevenPairs)<=1)tag('routes');}}
  if(mode==='ukeire'){if(deep)tag('future');else{tag('reduction');tag('counting');if(new Set(ctx.hand).size>=8)tag('overlap');if(ctx.visible)tag('visible');}}
  if(mode==='waits'){tag((ctx.fixedSets?.length??0)>=2?'basic':'compound');if(new Set([...ctx.hand,...(ctx.fixedSets??[]).flatMap(setTiles)].map(t=>t[1])).size===1)tag('one-suit');if(r.normal===0&&r.sevenPairs===0)tag('routes');if(r.waits.some(w=>w.remaining===0))tag('dead');}
  if(mode==='seven-pairs'){tag(deep?'planning':dualRoute?'routes':'counting');if(!deep&&!dualRoute)tag('discard');if(countsOf(ctx.hand).some(n=>n===4))tag('quad');}
  if(mode==='defense'){tag('goal');tag('information');tag('certainty');tag('boundary');if(level>=3&&!judgmentTile)tag('opponents');if(q.scenario!.goal!=='efficiency'&&!judgmentTile)tag('tradeoff');}
  q.lessonId=SKILLS.find(s=>s.id===ids[0])!.lessonId;
  const canonical=canonicalFamily(mode,ctx,judgmentTile?`judgment:${judgmentCorrect}`:q.scenario?.goal,q.scenario?.waits,deep?.model,judgmentTile),familyId='family-v2:'+createHash('sha256').update(canonical).digest('hex');
  if(families.has(familyId))continue;families.add(familyId);
  const pool=accepted<20?'practice':'competition',seed=level*1000+(pool==='competition'?100000:0)+accepted;
  const ref={mode,seed,version:BANK_VERSION},id=`${BANK_VERSION}:${mode}:${seed}`;
  const conditions=['成都缺门后的条筒专项；不是完整108张对局。','公开组合仅碰、杠；内部顺子仍可成牌。',...(ctx.visible?['公开牌已经计入四张上限。']:[]),...(deep?[`抽牌袋共${deep.model.bag.length}张；${deep.model.horizon}次摸打。`]:[])];
  records.push({...q,id,ref,accepted:expected,...(deep?{deep}:{}),metadata:{version:BANK_VERSION,difficulty:level,skillIds:ids,familyId,pool,conditions,objective:q.prompt,sources:['mil-sbr','tool-two-suits'],calibration:'design',structureBranches:judgmentTile?2:deep?.nodes??(r.discards.length+r.waits.length+r.improvements.length),...(judgmentTile?{response:'judgment',judgmentTile}:{})},...(q.scenario?{scenario:{...q.scenario,id}}:{})});accepted++;
  if(deep)process.stdout.write(`${mode} L${level} ${accepted}/24: ${deep.nodes} states\n`);
 }
 process.stdout.write(`completed ${mode}/${level}\n`);
}
writeFileSync(new URL('../src/learning/bank.json',import.meta.url),JSON.stringify(records));
process.stdout.write(`Published ${records.length} legal questions; ${records.filter(q=>q.deep).length} deep models independently verified.\n`);
