import { analyze, countsOf, decompose, parseHand, RULES_VERSION, ENGINE_VERSION, sevenPairsShanten, shanten, sorted, TILES, tileIndex, type HandContext, type TileId } from '../engine/index.js';
import { lessons } from './lessons.js';
import { scenarios, scenarioAnswers, type Scenario } from './scenarios.js';
export { lessons, UNIT_TITLES } from './lessons.js';
export { scenarios, scenarioAnswers } from './scenarios.js';
export const CONTENT_VERSION='1.0.1';
export const MODES=['discard','ukeire','waits','seven-pairs','defense'] as const;
export type Mode=typeof MODES[number];
export const MODE_NAMES:Record<Mode,string>={discard:'何切',ukeire:'有效进张',waits:'听牌与多面听','seven-pairs':'七对路线',defense:'攻防情境'};
export type ExerciseRef={mode:Mode;seed:number};
export type Exercise={id:string;ref:ExerciseRef;context:HandContext;title:string;prompt:string;lessonId:string;scenario?:Scenario};
export type Attempt={id:string;ref:ExerciseRef;answer:TileId[];assisted:boolean;durationMs:number;at:string;correct:boolean;exerciseId:string;review:boolean};
export type Evidence={id:string;ref:ExerciseRef;answer:TileId[];assisted:boolean;durationMs:number;at:string};
export type LearningSnapshot={schemaVersion:1;rulesVersion:string;engineVersion:string;contentVersion:string;attempts:Evidence[]};
export type Dimension={mode:Mode;count:number;correct:number;accuracy:number|null;medianMs:number|null};
export type ProfileClaim={mode:Mode;text:string;evidenceIds:string[]};
export type LearningProfile={summary:string;strengths:ProfileClaim[];weaknesses:ProfileClaim[];uncertainties:string[];plan:{day:number;lessonId:string;mode:Mode;task:string}[]};
export const CURATED_HANDS=[
 '123456789p12459s','1123456789p2345s','12456789p234569s','123456p11234589s','11223345p234569s','123789p12345689s','234567p11234569s','12345678p123459s','11234567p234589s','23456789p123459s',
 '123456789p1245s','123456p1123456s','112233p2345678s','123789p1234567s','234567p1123456s','11234567p23456s','12345678p12345s','123456p2345678s','23456789p12345s','123p1123456789s',
 '1112345678999p','1122334455667s','123456789p1112s','123456789s1112p','111222333p4445s','123123789p4445s','2233445566778p','1122334455789s','123456789p2223s','234567789p1112s',
 '1111223344p5567s','11223344556678p','1122334455p6678s','11112222p334567s','2233445566p7789s','11224466p335579s','11335577p224469s','22446688p113359s','112233p44556678s','33445566p112279s',
];
function rng(seed:number):()=>number {let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function randomHand(seed:number,size:number):TileId[]{
  const random=rng(seed);const pool=TILES.flatMap(t=>Array(4).fill(t) as TileId[]);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return sorted(pool.slice(0,size));
}
function waitingHand(seed:number):TileId[]{
  const random=rng(seed);
  for(let attempt=0;attempt<100;attempt++){
    const hand:TileId[]=[];
    for(let m=0;m<4;m++){
      const suit=random()<.5?'p':'s';const rank=1+Math.floor(random()*7);
      if(random()<.75)hand.push(`${rank}${suit}` as TileId,`${rank+1}${suit}` as TileId,`${rank+2}${suit}` as TileId);
      else hand.push(...Array(3).fill(`${rank}${suit}`) as TileId[]);
    }
    const pair=TILES[Math.floor(random()*18)];hand.push(pair,pair);
    if(countsOf(hand).some(n=>n>4))continue;
    hand.splice(Math.floor(random()*hand.length),1);
    if(analyze({hand}).waits.some(t=>t.remaining>0))return sorted(hand);
  }
  return parseHand('123456789p1112s');
}
export function exercise(ref:ExerciseRef):Exercise {
  if(!ref||!MODES.includes(ref.mode)||!Number.isSafeInteger(ref.seed)||ref.seed<0||ref.seed>2147483647)throw new Error('题目引用无效。');
  const {mode,seed}=ref;
  if(mode==='defense'){
    const s=scenarios[seed%scenarios.length];return {id:`${CONTENT_VERSION}:${s.id}`,ref,context:s.context,title:s.title,prompt:`${s.goal==='efficiency'?'效率优先':s.goal==='safety'?'安全优先':'避开确定危险，再保留效率'}：选择舍牌。`,lessonId:s.lessonId,scenario:s};
  }
  const group=mode==='discard'?0:mode==='ukeire'?1:mode==='waits'?2:3;
  let hand=seed<10?parseHand(CURATED_HANDS[group*10+seed]):mode==='waits'?waitingHand(seed):randomHand(seed,mode==='ukeire'?13:14);
  if(mode==='seven-pairs'&&seed>=10){
    const random=rng(seed),pool=[...TILES];
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    hand=sorted([...pool.slice(0,6).flatMap(t=>[t,t]),pool[6],pool[7]]);
  }
  return {id:`${CONTENT_VERSION}:${mode}:${seed}`,ref,context:{hand},title:MODE_NAMES[mode],prompt:mode==='waits'?'选出所有能和牌的牌种，再提交。':mode==='ukeire'?'选出所有仍有剩余张数、能降低综合向听的进张。':mode==='seven-pairs'?'以七对路线为目标：先比较向听，再比较七对进张。':'先比较舍牌后的向听，再比较有效进张，选择一张舍牌。',lessonId:mode==='waits'?'lesson-13':mode==='ukeire'?'lesson-08':mode==='seven-pairs'?'lesson-15':'lesson-10'};
}
export function answers(q:Exercise):TileId[]{
  if(q.scenario)return scenarioAnswers(q.scenario);
  const r=analyze(q.context);
  if(q.ref.mode==='waits')return r.waits.map(x=>x.tile);
  if(q.ref.mode==='ukeire')return r.improvements.map(x=>x.tile);
  if(q.ref.mode==='seven-pairs'){
    const c=countsOf(q.context.hand),remaining=c.map(n=>4-n);
    const candidates=TILES.flatMap((t,i)=>{if(!c[i])return[];c[i]--;const s=sevenPairsShanten(c);let u=0;for(let j=0;j<18;j++){c[j]++;if(sevenPairsShanten(c)<s)u+=remaining[j];c[j]--;}c[i]++;return[{t,s,u}];}).sort((a,b)=>a.s-b.s||b.u-a.u);
    return candidates.filter(x=>x.s===candidates[0].s&&x.u===candidates[0].u).map(x=>x.t);
  }
  return r.discards.filter(x=>x.best).map(x=>x.tile);
}
export function grade(q:Exercise,answer:TileId[]):boolean {
  const expected=answers(q);if(q.ref.mode==='waits'||q.ref.mode==='ukeire')return new Set(answer).size===expected.length&&answer.length===expected.length&&answer.every(t=>expected.includes(t));
  return answer.length===1&&expected.includes(answer[0]);
}
export const QUIZ_MODES:Mode[]=[...Array(10).fill('discard'),...Array(4).fill('waits'),...Array(2).fill('seven-pairs'),...Array(4).fill('defense')];
export function uniqueAttempts(attempts:Attempt[]):Attempt[]{
  const seen=new Set<string>();return [...attempts].sort((a,b)=>a.at.localeCompare(b.at)).filter(a=>{if(a.review||a.assisted||seen.has(a.exerciseId))return false;seen.add(a.exerciseId);return true;});
}
export function dimensions(attempts:Attempt[]):Dimension[]{
  const first=uniqueAttempts(attempts);
  return MODES.map(mode=>{const xs=first.filter(a=>a.ref.mode===mode),times=xs.map(a=>a.durationMs).sort((a,b)=>a-b);return{mode,count:xs.length,correct:xs.filter(a=>a.correct).length,accuracy:xs.length>=5?xs.filter(a=>a.correct).length/xs.length:null,medianMs:times.length>=5?times[Math.floor(times.length/2)]:null};});
}
export function snapshot(attempts:Attempt[]):LearningSnapshot{
  const first=uniqueAttempts(attempts).slice(-100);
  if(first.length<20)throw new Error('完成至少20道独立作答后才能生成画像。');
  return {schemaVersion:1,rulesVersion:RULES_VERSION,engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,attempts:first.map(({id,ref,answer,assisted,durationMs,at})=>({id,ref,answer,assisted,durationMs,at}))};
}
export function validateSnapshot(raw:unknown):{snapshot:LearningSnapshot;attempts:Attempt[];dimensions:Dimension[]}{
  const s=raw as LearningSnapshot;
  if(!s||s.schemaVersion!==1||s.rulesVersion!==RULES_VERSION||s.engineVersion!==ENGINE_VERSION||s.contentVersion!==CONTENT_VERSION||!Array.isArray(s.attempts)||s.attempts.length<20||s.attempts.length>100)throw new Error('画像快照版本或样本数量无效。');
  const ids=new Set<string>(),keys=new Set<string>();
  const checked=s.attempts.map(a=>{
    if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(a.id)||ids.has(a.id)||!Array.isArray(a.answer)||a.answer.length>18||new Set(a.answer).size!==a.answer.length||a.answer.some(t=>!TILES.includes(t))||a.assisted!==false||!Number.isInteger(a.durationMs)||a.durationMs<0||a.durationMs>1800000||typeof a.at!=='string'||!Number.isFinite(Date.parse(a.at)))throw new Error('答题证据无效。');
    const q=exercise(a.ref);if(keys.has(q.id))throw new Error('快照不能重复计算同一道题。');
    ids.add(a.id);keys.add(q.id);
    return {id:a.id,ref:q.ref,answer:a.answer,assisted:false,durationMs:a.durationMs,at:a.at,correct:grade(q,a.answer),exerciseId:q.id,review:false};
  });
  return {snapshot:snapshot(checked),attempts:checked,dimensions:dimensions(checked)};
}
export function validateProfile(raw:unknown,s:LearningSnapshot):LearningProfile{
  const p=raw as LearningProfile,ids=new Set(s.attempts.map(a=>a.id));
  const text=(x:unknown,max=600)=>typeof x==='string'&&x.length>0&&x.length<=max;
  if(!p||!text(p.summary)||![p.strengths,p.weaknesses,p.uncertainties,p.plan].every(Array.isArray)||p.strengths.length>7||p.weaknesses.length>7||p.uncertainties.length>10||p.plan.length!==7)throw new Error('画像格式不完整。');
  for(const claim of [...p.strengths,...p.weaknesses])if(!claim||!MODES.includes(claim.mode)||s.attempts.filter(a=>a.ref.mode===claim.mode).length<5||!text(claim.text)||!Array.isArray(claim.evidenceIds)||claim.evidenceIds.length<1||claim.evidenceIds.length>5||claim.evidenceIds.some(id=>!ids.has(id)||s.attempts.find(a=>a.id===id)?.ref.mode!==claim.mode))throw new Error('画像引用了不存在或不足的答题证据。');
  if(!p.uncertainties.every(x=>text(x)))throw new Error('画像未知项无效。');
  p.plan.forEach((d,i)=>{if(d.day!==i+1||!lessons.some(l=>l.id===d.lessonId)||!MODES.includes(d.mode)||!text(d.task,300))throw new Error('学习计划引用无效。');});
  return p;
}
export function solutionText(q:Exercise):string {
  if(q.scenario)return `${q.scenario.rationale} 本题${q.scenario.goal==='efficiency'?'先比较向听，再比较进张':'先排除题设中确定危险的牌，再比较向听与进张'}。这不是实战胜率评估。`;
  const r=analyze(q.context);
  return q.ref.mode==='waits'?`逐一补入每种牌，验证普通和型或七对。共${r.waits.length}种形状听口，重复拆法不重复计数。`:q.ref.mode==='ukeire'?`只有降低综合向听且仍有剩余张数的牌计入本题。当前${r.shanten}向听，有${r.improvements.length}种有效进张。`:q.ref.mode==='seven-pairs'?'四张相同牌算两对。比较舍牌后的七对向听，若相同再比较能改善七对结构的剩余牌。':'按向听优先、进张其次排序；所有达到同样最优数值的舍牌都被接受。刚舍出的牌不会重新计入未知牌。';
}
