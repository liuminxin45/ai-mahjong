import { TILES } from '../engine/index.js';
import { answers, exercise, MODES, uniqueAttempts, type Attempt, type Evidence, type LearningSnapshot, type Mode } from './index.js';

// Lossless transport: IDs and answers remain available for server regrading and audit.
type PackedSnapshot=Omit<LearningSnapshot,'attempts'> & {encoding:'mahjong-history-v1';baseAt:number;attempts:[string,number,number,number,number,number,number][]};
export function packSnapshot(s:LearningSnapshot):PackedSnapshot {
  const baseAt=s.attempts.length?Date.parse(s.attempts[0].at):0;
  return {...s,encoding:'mahjong-history-v1',baseAt,attempts:s.attempts.map(a=>[a.id,MODES.indexOf(a.ref.mode),a.ref.seed,a.answer.reduce((mask,t)=>mask|1<<TILES.indexOf(t),0),(a.assisted?1:0)|(a.review?2:0),a.durationMs,Date.parse(a.at)-baseAt])};
}
export function unpackSnapshot(raw:unknown):LearningSnapshot {
  const s=raw as PackedSnapshot;
  if(!s||!('encoding' in s))return raw as LearningSnapshot;
  if(s.encoding!=='mahjong-history-v1'||!Number.isSafeInteger(s.baseAt)||!Array.isArray(s.attempts)||s.attempts.length>50000)throw new Error('压缩记录格式无效。');
  const attempts:Evidence[]=s.attempts.map(row=>{
    if(!Array.isArray(row)||row.length!==7)throw new Error('压缩记录格式无效。');
    const [id,mode,seed,mask,flags,durationMs,delta]=row;
    if(!Number.isInteger(mode)||mode<0||mode>=MODES.length||!Number.isInteger(mask)||mask<0||mask>262143||!Number.isInteger(flags)||flags<0||flags>3||!Number.isSafeInteger(delta)||!Number.isSafeInteger(s.baseAt+delta)||!Number.isFinite(new Date(s.baseAt+delta).getTime()))throw new Error('压缩记录数据无效。');
    return {id,ref:{mode:MODES[mode],seed},answer:TILES.filter((_,i)=>(mask&(1<<i))!==0),assisted:!!(flags&1),review:!!(flags&2),durationMs,at:new Date(s.baseAt+delta).toISOString()};
  });
  return {schemaVersion:s.schemaVersion,rulesVersion:s.rulesVersion,engineVersion:s.engineVersion,contentVersion:s.contentVersion,attempts};
}

const median=(xs:number[])=>xs.length?[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]:null;
function statistics(xs:Attempt[]) {
  const independent=uniqueAttempts(xs);
  return {attempts:xs.length,correct:xs.filter(a=>a.correct).length,independent:independent.length,independentCorrect:independent.filter(a=>a.correct).length,assisted:xs.filter(a=>a.assisted).length,reviews:xs.filter(a=>a.review).length,medianMs:median(independent.map(a=>a.durationMs)),activeMs:xs.reduce((n,a)=>n+a.durationMs,0)};
}
function representatives(attempts:Attempt[]) {
  const selected=new Map<string,Attempt>(),independent=uniqueAttempts(attempts);
  for(const mode of MODES){
    const xs=independent.filter(a=>a.ref.mode===mode),wrong=xs.filter(a=>!a.correct),right=xs.filter(a=>a.correct),all=attempts.filter(a=>a.ref.mode===mode);
    // Include early mistakes as well as recent ones, successes, hints and review outcomes.
    const picks=[...wrong.slice(0,2),...wrong.slice(-2),...right.slice(0,1),...right.slice(-1),...all.filter(a=>a.assisted).slice(-1),...all.filter(a=>a.review).slice(-1)];
    picks.forEach(a=>selected.set(a.id,a));
  }
  return [...selected.values()]; // At most 8 per mode / 40 total.
}
export function compressLearningEvidence(attempts:Attempt[]) {
  const all=[...attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)),first=uniqueAttempts(all);
  const byMode=MODES.map(mode=>{
    const xs=all.filter(a=>a.ref.mode===mode),independent=first.filter(a=>a.ref.mode===mode),half=Math.floor(independent.length/2);
    return {mode,...statistics(xs),evidenceSufficient:independent.length>=5,earlier:statistics(independent.slice(0,half)),later:statistics(independent.slice(half))};
  });
  const periods=Array.from({length:Math.min(8,all.length)},(_,i)=>{
    const n=Math.min(8,all.length),xs=all.slice(Math.floor(i*all.length/n),Math.floor((i+1)*all.length/n));
    return {from:xs[0].at,to:xs.at(-1)!.at,...statistics(xs)};
  });
  const questionGroups=new Map<string,Attempt[]>();
  all.forEach(a=>{const xs=questionGroups.get(a.exerciseId)??[];xs.push(a);questionGroups.set(a.exerciseId,xs);});
  const repeatedErrors=[...questionGroups.values()].filter(xs=>xs.filter(a=>!a.correct).length>1).sort((a,b)=>b.filter(x=>!x.correct).length-a.filter(x=>!x.correct).length).slice(0,10).map(xs=>({mode:xs[0].ref.mode,ref:xs[0].ref,wrong:xs.filter(a=>!a.correct).length,attempts:xs.length,latestCorrect:xs.at(-1)!.correct}));
  const evidence=representatives(all).map(a=>{
    const q=exercise(a.ref);
    return {id:a.id,mode:a.ref.mode,ref:a.ref,hand:q.context.hand,...(q.scenario?{goal:q.scenario.goal,facts:q.scenario.facts,knownWaits:q.scenario.waits}:{}),answer:a.answer,correctAnswer:answers(q),correct:a.correct,assisted:a.assisted,review:a.review,durationMs:a.durationMs,at:a.at};
  });
  return {scope:'all-history',compressionVersion:1,totals:{...statistics(all),distinctQuestions:questionGroups.size,from:all[0]?.at??null,to:all.at(-1)?.at??null},byMode,periods,repeatedErrors,evidence};
}
