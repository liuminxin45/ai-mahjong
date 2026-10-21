import { analyze, countsOf, decompose, parseHand, RULES_VERSION, ENGINE_VERSION, sevenPairsShanten, shanten, sorted, TILES, tileIndex, type HandContext, type TileId } from '../engine/index.js';
import { lessons } from './lessons.js';
import { scenarios, scenarioAnswers, type Scenario } from './scenarios.js';
import { unpackSnapshot } from './history.js';
import { bankExercise, canonicalFamily, type QuestionMetadata } from './bank.js';
import { BANK_VERSION, type Difficulty } from './curriculum.js';
import type { DeepCertificate } from '../engine/deep.js';
export { lessons, UNIT_TITLES } from './lessons.js';
export { scenarios, scenarioAnswers } from './scenarios.js';
export { BANK_VERSION, DIFFICULTIES, DIFFICULTY_NAMES, SKILLS, SOURCES, recommendation } from './curriculum.js';
export { questionBank, practiceQuestions, canonicalFamily } from './bank.js';
export { learningFacts, wilson, diagnose, factualClaims } from './facts.js';
export type { Difficulty } from './curriculum.js';
export { competitionPapers, publicQuestion } from './competition.js';
export type { CompetitionPaper, CompetitionRun, CompetitionBoard, CompetitionClient } from './competition.js';
export const CONTENT_VERSION='1.0.1';
export const MODES=['discard','ukeire','waits','seven-pairs','defense'] as const;
export type Mode=typeof MODES[number];
export const MODE_NAMES:Record<Mode,string>={discard:'何切',ukeire:'有效进张',waits:'听牌与多面听','seven-pairs':'七对路线',defense:'攻防情境'};
export type ExerciseRef={mode:Mode;seed:number;version?:typeof BANK_VERSION};
export type Exercise={id:string;ref:ExerciseRef;context:HandContext;title:string;prompt:string;lessonId:string;scenario?:Scenario;metadata?:QuestionMetadata;accepted?:TileId[];deep?:DeepCertificate};
export type Attempt={id:string;ref:ExerciseRef;answer:TileId[];assisted:boolean;durationMs:number;at:string;correct:boolean;exerciseId:string;review:boolean;difficulty?:Difficulty;familyId?:string;source?:'practice'|'competition';competitionRunId?:string};
export type Evidence={id:string;ref:ExerciseRef;answer:TileId[];assisted:boolean;durationMs:number;at:string;review?:boolean;source?:'practice'|'competition';competitionRunId?:string};
export type LearningSnapshot={schemaVersion:1|2|3;rulesVersion:string;engineVersion:string;contentVersion:string;attempts:Evidence[]};
export { packSnapshot, compressLearningEvidence } from './history.js';
export type Dimension={mode:Mode;count:number;correct:number;accuracy:number|null;medianMs:number|null};
export type ProfileClaim={mode:Mode;text:string;evidenceIds:string[]};
export type LearningProfile={summary:string;strengths:ProfileClaim[];weaknesses:ProfileClaim[];uncertainties:string[];plan:{day:number;lessonId:string;mode:Mode;task:string}[];version?:2};
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
  if(ref.version!==undefined){if(ref.version!==BANK_VERSION)throw new Error('题目版本不支持。');return bankExercise(ref.mode,ref.seed);}
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
  if(q.metadata){if(!q.accepted||q.deep&&!q.deep.verified)throw new Error('题目尚未通过核验。');return [...q.accepted];}
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
  const expected=answers(q);if(q.metadata?.response==='judgment'||q.ref.mode==='waits'||q.ref.mode==='ukeire')return new Set(answer).size===expected.length&&answer.length===expected.length&&answer.every(t=>expected.includes(t));
  return answer.length===1&&expected.includes(answer[0]);
}
export const QUIZ_MODES:Mode[]=[...Array(10).fill('discard'),...Array(4).fill('waits'),...Array(2).fill('seven-pairs'),...Array(4).fill('defense')];
export function uniqueAttempts(attempts:Attempt[]):Attempt[]{
  const seen=new Set<string>();return [...attempts].sort((a,b)=>a.at.localeCompare(b.at)).filter(a=>{const key=a.familyId??a.exerciseId;if(a.review||a.assisted||seen.has(key))return false;seen.add(key);return true;});
}
export function dimensions(attempts:Attempt[]):Dimension[]{
  const first=uniqueAttempts(attempts);
  return MODES.map(mode=>{const xs=first.filter(a=>a.ref.mode===mode),times=xs.map(a=>a.durationMs).sort((a,b)=>a-b);return{mode,count:xs.length,correct:xs.filter(a=>a.correct).length,accuracy:xs.length>=5?xs.filter(a=>a.correct).length/xs.length:null,medianMs:times.length>=5?times[Math.floor(times.length/2)]:null};});
}
export function snapshot(attempts:Attempt[]):LearningSnapshot{
  if(!attempts.length)throw new Error('完成一次作答后即可生成初步报告。');
  return {schemaVersion:attempts.some(a=>a.ref.version)?3:2,rulesVersion:RULES_VERSION,engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,attempts:[...attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).map(({id,ref,answer,assisted,durationMs,at,review,source,competitionRunId})=>({id,ref,answer,assisted,durationMs,at:new Date(at).toISOString(),review,...(source?{source}:{}),...(competitionRunId?{competitionRunId}:{})}))};
}
export function validateSnapshot(raw:unknown):{snapshot:LearningSnapshot;attempts:Attempt[];dimensions:Dimension[]}{
  const s=unpackSnapshot(raw);
  if(!s||![1,2,3].includes(s.schemaVersion)||s.rulesVersion!==RULES_VERSION||s.engineVersion!==ENGINE_VERSION||s.contentVersion!==CONTENT_VERSION||!Array.isArray(s.attempts)||!s.attempts.length||s.attempts.length>50000)throw new Error('画像快照版本或样本数量无效。');
  const ids=new Set<string>(),keys=new Set<string>(),questions=new Map<string,Exercise>(),expected=new Map<string,TileId[]>();
  const checked:Attempt[]=[...s.attempts].sort((a,b)=>Date.parse(a?.at)-Date.parse(b?.at)).map(a=>{
    if(s.schemaVersion<3&&a?.ref?.version!==undefined)throw new Error('旧版快照不能包含新版题目。');
    if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(a.id)||ids.has(a.id)||!Array.isArray(a.answer)||a.answer.length>18||new Set(a.answer).size!==a.answer.length||a.answer.some(t=>!TILES.includes(t))||typeof a.assisted!=='boolean'||(s.schemaVersion===1?a.assisted:typeof a.review!=='boolean')||!Number.isInteger(a.durationMs)||a.durationMs<0||a.durationMs>1800000||typeof a.at!=='string'||!Number.isFinite(Date.parse(a.at)))throw new Error('答题证据无效。');
    const key=JSON.stringify(a.ref),q=questions.get(key)??exercise(a.ref);questions.set(key,q);
    if(s.schemaVersion===1&&keys.has(q.id))throw new Error('旧版快照不能重复计算同一道题。');
    const correctAnswer=expected.get(q.id)??answers(q);expected.set(q.id,correctAnswer);
    const correct=q.metadata?.response==='judgment'||q.ref.mode==='waits'||q.ref.mode==='ukeire'?a.answer.length===correctAnswer.length&&a.answer.every(t=>correctAnswer.includes(t)):a.answer.length===1&&correctAnswer.includes(a.answer[0]);
    const familyId=q.metadata?.familyId??q.id,review=!!a.review||keys.has(familyId);ids.add(a.id);keys.add(familyId);
    if(a.source!==undefined&&!['practice','competition'].includes(a.source)||a.competitionRunId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(a.competitionRunId))throw new Error('记录来源无效。');
    return {id:a.id,ref:q.ref,answer:sorted(a.answer),assisted:a.assisted,durationMs:a.durationMs,at:new Date(a.at).toISOString(),correct,exerciseId:q.id,review,...(q.metadata?{difficulty:q.metadata.difficulty,familyId}:{}),...(a.source?{source:a.source}:{}),...(a.competitionRunId?{competitionRunId:a.competitionRunId}:{})};
  });
  return {snapshot:snapshot(checked),attempts:checked,dimensions:dimensions(checked)};
}
export function validateProfile(raw:unknown,s:LearningSnapshot):LearningProfile{
  const p=raw as LearningProfile,ids=new Map(s.attempts.map(a=>[a.id,a]));
  const first=uniqueAttempts(s.attempts.map(a=>{const q=exercise(a.ref);return {...a,review:!!a.review,correct:false,exerciseId:q.id,...(q.metadata?{familyId:q.metadata.familyId}:{})};})),counts=new Map(MODES.map(mode=>[mode,first.filter(a=>a.ref.mode===mode).length]));
  const text=(x:unknown,max=600)=>typeof x==='string'&&x.length>0&&x.length<=max;
  if(!p||!text(p.summary)||![p.strengths,p.weaknesses,p.uncertainties,p.plan].every(Array.isArray)||p.strengths.length>7||p.weaknesses.length>7||p.uncertainties.length>10||p.plan.length!==7)throw new Error('画像格式不完整。');
  for(const claim of [...p.strengths,...p.weaknesses])if(!claim||!MODES.includes(claim.mode)||(counts.get(claim.mode)??0)<5||!text(claim.text)||!Array.isArray(claim.evidenceIds)||claim.evidenceIds.length<1||claim.evidenceIds.length>5||claim.evidenceIds.some(id=>ids.get(id)?.ref.mode!==claim.mode))throw new Error('画像引用了不存在或不足的答题证据。');
  if(!p.uncertainties.every(x=>text(x)))throw new Error('画像未知项无效。');
  p.plan.forEach((d,i)=>{if(d.day!==i+1||!lessons.some(l=>l.id===d.lessonId)||!MODES.includes(d.mode)||!text(d.task,300))throw new Error('学习计划引用无效。');});
  return p;
}
export function solutionText(q:Exercise):string {
  if(q.metadata?.response==='judgment')return q.accepted?.length?'题设已经给出这位对手当前的完整等待集合，目标牌不在集合内，所以当前条件下可以确定。结论不扩展到其他对手、未来摸打或实战绝对安全。':'仅凭一次旧弃牌，没有当前暗手与等待证据，不能保证永久安全。正确判断是“信息不足”。这也不是推断该牌一定危险。';
  if(q.deep)return `本题只在公布的抽牌袋中均匀、不放回摸牌，不包含对手行动。计算未来${q.deep.model.horizon}次摸打，允许每次摸牌后重新选择最优舍牌。目标为${q.deep.model.target==='seven-pairs'?'七对成牌':'普通型或七对成牌'}。答案使用整数路径数精确比较，所有并列最优均接受。已核验${q.deep.nodes}个决策状态；这是题设模型中的和牌机会，不是实战胜率。`;
  if(q.metadata?.skillIds.includes('seven-pairs.routes'))return '本题明确同时考虑普通型与七对。比较两个路线的综合最小向听，再比较综合有效进张；不是只追求七对。四张相同牌可以贡献两对。';
  if(q.scenario)return `${q.scenario.rationale} 本题${q.scenario.goal==='efficiency'?'先比较向听，再比较进张':'先排除题设中确定危险的牌，再比较向听与进张'}。这不是实战胜率评估。`;
  const r=analyze(q.context);
  return q.ref.mode==='waits'?`逐一补入每种牌，验证普通和型或七对。共${r.waits.length}种形状听口，重复拆法不重复计数。`:q.ref.mode==='ukeire'?`只有降低综合向听且仍有剩余张数的牌计入本题。当前${r.shanten}向听，有${r.improvements.length}种有效进张。`:q.ref.mode==='seven-pairs'?'四张相同牌算两对。比较舍牌后的七对向听，若相同再比较能改善七对结构的剩余牌。':'按向听优先、进张其次排序；所有达到同样最优数值的舍牌都被接受。刚舍出的牌不会重新计入未知牌。';
}
