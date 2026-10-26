import {analyze,countsOf,setTiles,sorted,TILES,tileName,type HandContext,type TileId,type DiscardResult} from '../engine/index.js';
import {trainingQuestions,structure,type TrainingQuestion} from '../training/questions.js';

export const PRACTICE_VERSION='discard-practice-1' as const;
export const levels=['看清牌形','比较取舍','加入约束'] as const;
export type Level=1|2|3;
// Published start positions are audited in practice.test; do not solve the entire bank at module load.
export const bank=trainingQuestions.filter(q=>!q.context.fixedSets?.some(s=>s.kind==='sequence'));
export function levelOf(q:TrainingQuestion):Level{return ['shape','pairs'].includes(q.topic)?1:['distance','connections','seven'].includes(q.topic)?2:3;}
export function startFamily(q:TrainingQuestion){return structure({...q.context,visible:{}});}
export function getQuestion(id:string){const q=bank.find(q=>q.id===id);if(!q)throw Error('这副起手牌暂不可用。');return q;}
export type Piece={id:string;tile:TileId};
export type Choice={id:string;tileId:string;elapsedMs:number;assisted:boolean;at:string};
export type Segment={id:string;questionId:string;seed:number;choices:Choice[];advances:number};
export type PracticeProfile={version:7;observationId:string;suggestionId:string;evidenceIds:string[]};
export type SavedPracticeProfile={reportId:string;at:string;profile:PracticeProfile;snapshot:PracticeSnapshot};
export type PracticeState={version:1;segments:Segment[];group?:{id:string;ids:string[];index:number;level:Level;topic?:string};selected?:string;hintFor?:string;manualLevel?:Level;reports:SavedPracticeProfile[];guideRead?:boolean};
export const emptyPractice=():PracticeState=>({version:1,segments:[],reports:[]});
export type StepEvidence={id:string;segmentId:string;questionId:string;family:string;level:Level;topic:string;step:number;assisted:boolean;elapsedMs:number;answer:TileId;context:HandContext;chosen:DiscardResult;best:DiscardResult;accepted:TileId[];issue:'distance'|'opportunities'|'equal';text:string};
export type Board={hand:Piece[];river:Piece[];bag:Piece[];visible:Partial<Record<TileId,number>>;drawn?:string;phase:'choose'|'feedback'|'done';end?:'win'|'limit'|'empty';facts:StepEvidence[];context:HandContext};
function shuffled<T>(a:T[],seed:number){let x=seed>>>0;for(let i=a.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)>>>0;const j=Math.floor(x/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function response(chosen:DiscardResult,best:DiscardResult){
 if(chosen.best)return chosen.shanten===0?`打出${tileName(chosen.tile)}后听牌，留下${chosen.ukeire}张可和的余量。`:`打出${tileName(chosen.tile)}，保持更近的距离，也留下了${chosen.ukeire}张改善机会。`;
 if(chosen.shanten>best.shanten)return `打出${tileName(chosen.tile)}，比打${tileName(best.tile)}多${chosen.shanten-best.shanten}步才能听牌。`;
 return `同样${chosen.shanten===0?'已经听牌':'接近听牌'}，打${tileName(best.tile)}比打${tileName(chosen.tile)}多留下${best.ukeire-chosen.ukeire}张机会。`;
}
/** Reconstruct every state and judgment from the published starting hand and player actions. */
export function replay(segment:Segment):Board{
 const q=getQuestion(segment.questionId),used=Array(18).fill(0),take=(tile:TileId):Piece=>({id:tile+':'+used[TILES.indexOf(tile)]++,tile});
 let hand=sorted(q.context.hand).map(take);for(const s of q.context.fixedSets??[])setTiles(s).forEach(take);
 const visible={...q.context.visible};for(const t of TILES)for(let n=0;n<(visible[t]??0);n++)take(t);
 const bag=shuffled(TILES.flatMap((tile,i)=>Array.from({length:4-used[i]},()=>take(tile))),segment.seed),river:Piece[]=[],facts:StepEvidence[]=[];
 let cursor=0,drawn:string|undefined,phase:Board['phase']='choose',end:Board['end'];
 const context=():HandContext=>({hand:hand.map(t=>t.tile),fixedSets:q.context.fixedSets,visible});
 for(let i=0;i<segment.choices.length;i++){
  if(phase!=='choose')throw Error('出牌顺序不完整。');const c=segment.choices[i],piece=hand.find(t=>t.id===c.tileId);if(!piece)throw Error('这张牌不在当前手牌里。');
  const ctx=context(),analysis=analyze(ctx),chosen=analysis.discards.find(d=>d.tile===piece.tile)!,best=analysis.discards.find(d=>d.best)!;
  facts.push({id:segment.id+':'+i,segmentId:segment.id,questionId:q.id,family:startFamily(q),level:levelOf(q),topic:q.topic,step:i,assisted:c.assisted,elapsedMs:c.elapsedMs,answer:piece.tile,context:ctx,chosen,best,accepted:analysis.discards.filter(d=>d.best).map(d=>d.tile),issue:chosen.shanten>best.shanten?'distance':chosen.best?'equal':'opportunities',text:response(chosen,best)});
  // The feedback retains the entire decision hand; the next draw is only revealed on Continue.
  phase='feedback';if(segment.advances<=i)continue;
  hand=hand.filter(t=>t.id!==piece.id);river.push(piece);visible[piece.tile]=(visible[piece.tile]??0)+1;
  if(i===2){phase='done';end='limit';continue;}
  const next=bag[cursor++];if(!next){phase='done';end='empty';continue;}hand=[...hand,next];drawn=next.id;
  if(analyze(context()).shanten===-1){phase='done';end='win';}else phase='choose';
 }
 return {hand,river,bag:bag.slice(cursor),visible,drawn,phase,end,facts,context:context()};
}
export function submit(s:Segment,c:Choice):Segment{if(s.choices.some(x=>x.id===c.id))return s;if(replay(s).phase!=='choose')return s;const next={...s,choices:[...s.choices,c]};replay(next);return next;}
export function advance(s:Segment):Segment{return replay(s).phase==='feedback'?{...s,advances:s.advances+1}:s;}
export type PracticeSnapshot={version:9;model:typeof PRACTICE_VERSION;segments:Segment[]};
export function snapshot(p:PracticeState):PracticeSnapshot{return {version:9,model:PRACTICE_VERSION,segments:p.segments.filter(s=>s.choices.length).map(s=>structuredClone(s))};}
export function validateSnapshot(raw:unknown):PracticeSnapshot{
 const s=raw as PracticeSnapshot;if(!s||s.version!==9||s.model!==PRACTICE_VERSION||!Array.isArray(s.segments)||s.segments.length>5000)throw Error('练习记录版本不匹配。');
 const ids=new Set<string>();for(const r of s.segments){
  if(!r||typeof r.id!=='string'||!/^[\w-]{8,80}$/.test(r.id)||ids.has(r.id)||!Number.isInteger(r.seed)||r.seed<0||r.seed>4294967295||!Array.isArray(r.choices)||r.choices.length<1||r.choices.length>3||!Number.isInteger(r.advances)||r.advances<0||r.advances>r.choices.length||r.advances<r.choices.length-1)throw Error('练习段记录不完整。');ids.add(r.id);
  const commands=new Set<string>();for(const c of r.choices){if(!c||typeof c.id!=='string'||!/^[\w-]{8,100}$/.test(c.id)||commands.has(c.id)||typeof c.tileId!=='string'||!Number.isInteger(c.elapsedMs)||c.elapsedMs<0||c.elapsedMs>1800000||typeof c.assisted!=='boolean'||typeof c.at!=='string'||!Number.isFinite(Date.parse(c.at)))throw Error('出牌证据不完整。');commands.add(c.id);}replay(r);
 }
 return {version:9,model:PRACTICE_VERSION,segments:s.segments.map(r=>({id:r.id,questionId:r.questionId,seed:r.seed,advances:r.advances,choices:r.choices.map(c=>({id:c.id,tileId:c.tileId,elapsedMs:c.elapsedMs,assisted:c.assisted,at:c.at}))}))};
}
export function wilson(correct:number,total:number){if(!total)return [0,1];const z=1.96,p=correct/total,d=1+z*z/total,c=(p+z*z/(2*total))/d,h=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/d;return [c-h,c+h];}
export function facts(s:PracticeSnapshot){
 const all=s.segments.flatMap(r=>replay(r).facts),seen=new Set<string>(),independent:StepEvidence[]=[],repeat:StepEvidence[]=[];
 for(const f of all){if(f.step||f.assisted)continue;if(seen.has(f.family))repeat.push(f);else{seen.add(f.family);independent.push(f);}}
 const cohorts=levels.map((name,i)=>{const rows=independent.filter(f=>f.level===i+1),correct=rows.filter(f=>f.chosen.best).length;return {level:i+1,name,total:rows.length,correct,interval:wilson(correct,rows.length)};});
 const observations=independent.map(f=>({id:'single:'+f.id,text:f.text,evidenceIds:[f.id],topic:f.topic,suggestionId:'topic:'+f.topic}));
 for(const row of cohorts){const sample=independent.filter(f=>f.level===row.level);if(sample.length<5)continue;for(const issue of ['distance','opportunities'] as const){const matches=sample.filter(f=>f.issue===issue);if(matches.length<3)continue;observations.unshift({id:`repeat:${row.level}:${issue}`,text:issue==='distance'?`在${sample.length}副独立起手里，有${matches.length}次出牌让自己离听牌更远。`:`在${sample.length}副独立起手里，有${matches.length}次距离相同，却留下了较少的改善机会。`,evidenceIds:matches.map(f=>f.id),topic:issue==='distance'?'distance':'chances',suggestionId:issue==='distance'?'topic:distance':'topic:chances'});}}
 const suggested=observations.find(o=>o.id.startsWith('repeat:'))??[...observations].reverse().find(o=>!independent.find(f=>f.id===o.evidenceIds[0])?.chosen.best)??observations.at(-1);
 return {all,independent,repeat,cohorts,observations,suggested,assisted:all.filter(f=>f.assisted).length,continuations:all.filter(f=>f.step>0).length};
}
export function validateProfile(raw:unknown,s:PracticeSnapshot):PracticeProfile{const p=raw as PracticeProfile,f=facts(s),o=f.observations.find(o=>o.id===p?.observationId);if(p?.version!==7||!o||p.suggestionId!==o.suggestionId||!Array.isArray(p.evidenceIds)||JSON.stringify(p.evidenceIds)!==JSON.stringify(o.evidenceIds))throw Error('这次建议没有对应的出牌证据。');return {version:7,observationId:o.id,suggestionId:o.suggestionId,evidenceIds:o.evidenceIds};}
export function recommendedLevel(p:PracticeState):Level{const f=facts(snapshot(p));for(let level=3;level>=1;level--){const rows=f.independent.filter(x=>x.level===level).slice(-20);if(rows.length<20)continue;const rate=rows.filter(x=>x.chosen.best).length/20;return Math.max(1,Math.min(3,level+(rate>=.85?1:rate<.5?-1:0))) as Level;}return 1;}
export function newGroup(p:PracticeState,level:Level,topic?:string,seed=Date.now()>>>0,id:string=crypto.randomUUID()):PracticeState{
 const seen=new Set(p.segments.filter(s=>s.choices.length).map(s=>startFamily(getQuestion(s.questionId)))),pool=bank.filter(q=>topic?q.topic===topic:levelOf(q)===level),shuffledPool=shuffled([...pool],seed),families=new Set<string>();
 const chosen=[...shuffledPool.filter(q=>!seen.has(startFamily(q))),...shuffledPool.filter(q=>seen.has(startFamily(q)))].filter(q=>{const k=startFamily(q);if(families.has(k))return false;families.add(k);return true;}).slice(0,5);
 if(chosen.length!==5)throw Error('这组牌还没有准备齐。');const segments=chosen.map((q,i)=>({id:id+'-'+i,questionId:q.id,seed:(seed+i)>>>0,choices:[],advances:0}));
 return {...p,segments:[...p.segments,...segments],group:{id,ids:segments.map(s=>s.id),index:0,level:topic?levelOf(chosen[0]):level,topic},selected:undefined};
}
export function active(p:PracticeState){return p.group?p.segments.find(s=>s.id===p.group!.ids[p.group!.index]):undefined;}
