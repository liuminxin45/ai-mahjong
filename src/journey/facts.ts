import {analyze,tileName,type TileId} from '../engine/index.js';
import {allCheckpoints,type TableSnapshot,type TableProfile} from './core.js';
import {publicContext} from './round.js';
export const questions=[
 {id:'whole',text:'这张牌，放回整手里还值得留下吗？'},
 {id:'wait',text:'这一点等待，换来的是什么？'},
 {id:'change',text:'桌上的牌变了，你的答案会变吗？'},
 {id:'result',text:'如果没有摸到那张牌，你还会这样选吗？'}
] as const;
export type DecisionFact={id:string;roundId:string;family:string;chapter:number;level:number;hand:TileId[];visible:Partial<Record<TileId,number>>;answer:TileId;best:TileId[];distance:number;bestDistance:number;opportunities:number;bestOpportunities:number;elapsedMs:number;assisted:boolean;issue:'distance'|'opportunities'|'equal';paired:boolean};
export type Observation={id:string;text:string;questionIds:string[];evidenceIds:string[]};
export function tableFacts(s:TableSnapshot){
 const facts:DecisionFact[]=allCheckpoints(s).map(p=>{const context=publicContext(p.before),a=analyze(context),answer=p.before.hands[0].find(t=>t.id===p.command.tileId)!.tile,chosen=a.discards.find(d=>d.tile===answer)!,best=a.discards[0];return {id:p.id,roundId:p.roundId,family:p.chapter===5?`chapter-1-shape-${p.family.split('-').at(-1)}`:p.family,chapter:p.chapter,level:[1,2,3,3,4][p.chapter-1],hand:context.hand,visible:context.visible!,answer,best:a.discards.filter(d=>d.best).map(d=>d.tile),distance:chosen.shanten,bestDistance:best.shanten,opportunities:chosen.ukeire,bestOpportunities:best.ukeire,elapsedMs:p.command.elapsedMs,assisted:p.command.assisted,issue:chosen.shanten>best.shanten?'distance':chosen.ukeire<best.ukeire?'opportunities':'equal',paired:p.chapter===5};});
 return summarizeTableFacts(facts);
}
export function summarizeTableFacts(facts:DecisionFact[]){
 const seen=new Set<string>(),independent=facts.filter(f=>{if(f.assisted||f.paired||seen.has(f.family))return false;seen.add(f.family);return true;});
 const observations:Observation[]=facts.map(f=>({id:'single:'+f.id,text:f.issue==='distance'?`这一手打出${tileName(f.answer)}，比离听牌最近的方案多了${f.distance-f.bestDistance}步。`:f.issue==='opportunities'?`这一手打出${tileName(f.answer)}，能让牌形再近一步的牌，比另一方案少了${f.bestOpportunities-f.opportunities}张。`:`这一手打出${tileName(f.answer)}，离听牌最近，也给下一步留了最多机会。`,questionIds:f.issue==='distance'?['whole','wait']:f.issue==='opportunities'?['whole','change']:['result','change'],evidenceIds:[f.id]}));
 for(const level of [1,2,3,4])for(const issue of ['distance','opportunities'] as const){const cohort=independent.filter(f=>f.level===level),matching=cohort.filter(f=>f.issue===issue);if(cohort.length>=5&&matching.length>=3)observations.push({id:'repeated:'+level+':'+issue,text:issue==='distance'?`同档的${cohort.length}个开局中，有${matching.length}次没留下更接近听牌的路线。`:`同档的${cohort.length}个开局中，有${matching.length}次同样接近听牌，却留下了更少机会。`,questionIds:['whole','wait'],evidenceIds:matching.map(f=>f.id)});}
 const pair=facts.filter(f=>f.paired&&f.id.endsWith(':0')).find(last=>facts.some(first=>first.chapter===1&&first.family===last.family&&first.id.endsWith(':0')));
 if(pair)observations.push({id:'paired:'+pair.id,text:'相同的手牌，桌上的已知牌不同，可取的舍牌也随之改变。',questionIds:['change'],evidenceIds:[facts.find(f=>f.chapter===1&&f.family===pair.family&&f.id.endsWith(':0'))!.id,pair.id]});
 const fallback=[...observations].reverse().find(o=>o.id.startsWith('repeated:'))??observations.at(-1);
 const cohorts=[1,2,3,4].map(level=>{const samples=independent.filter(f=>f.level===level),n=samples.length,correct=samples.filter(f=>f.issue==='equal').length,p=n?correct/n:0,z=1.959963984540054,den=1+z*z/(n||1),center=(p+z*z/(2*(n||1)))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*(n||1)))/(n||1))/den;return {level,count:n,correct,interval:n?[Math.max(0,center-half),Math.min(1,center+half)]:null};});
 return {facts,independent,observations,questions,cohorts,summary:{rounds:new Set(facts.map(f=>f.roundId)).size,choices:facts.length,startingShapes:independent.length,assisted:facts.filter(f=>f.assisted).length,paired:facts.filter(f=>f.paired).length},fallback};
}
export function validateTableProfile(raw:unknown,s:TableSnapshot):TableProfile{
 const p=raw as TableProfile,f=tableFacts(s),o=f.observations.find(x=>x.id===p?.observationId);
 if(!p||p.version!==6||!o||!o.questionIds.includes(p.questionId)||!Array.isArray(p.evidenceIds)||p.evidenceIds.length!==o.evidenceIds.length||p.evidenceIds.some((id,i)=>id!==o.evidenceIds[i]))throw Error('这段回望没有对应的落牌。');
 return {version:6,observationId:o.id,questionId:p.questionId,evidenceIds:[...o.evidenceIds]};
}
