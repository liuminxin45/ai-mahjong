import { analyze, type TileId } from '../engine/index.js';
import { answers, exercise, uniqueAttempts, type Attempt, type Mode } from './index.js';
import { DIFFICULTY_NAMES, skillById } from './curriculum.js';

export function wilson(correct:number,count:number):[number,number]|null{
 if(!Number.isInteger(count)||count<0||!Number.isInteger(correct)||correct<0||correct>count)throw new Error('样本统计无效。');
 if(!count)return null;const z=1.959963984540054,p=correct/count,d=1+z*z/count,center=(p+z*z/(2*count))/d,half=z*Math.sqrt(p*(1-p)/count+z*z/(4*count*count))/d;
 return [Math.max(0,center-half),Math.min(1,center+half)];
}
export function diagnose(a:Attempt):string[]{
 const q=exercise(a.ref),expected=answers(q);if(a.correct)return [];
 if(q.metadata?.response==='judgment')return [q.accepted?.length?'未按已确认的当前等待集合判断':'将旧弃牌当成永久安全保证'];
 if(q.ref.mode==='waits'||q.ref.mode==='ukeire'){const missed=expected.filter(t=>!a.answer.includes(t)).length,extra=a.answer.filter(t=>!expected.includes(t)).length;return [...(missed?[`漏选${missed}种`]:[]),...(extra?[`误选${extra}种`]:[])];}
 if(q.scenario?.goal!=='efficiency'&&q.scenario?.waits.some(t=>a.answer.includes(t)))return ['选入题设已确认的危险牌'];
 if(q.deep)return ['所选方案在公布抽牌袋中的成牌机会较低'];
 if(q.ref.mode==='seven-pairs'&&!q.metadata?.skillIds.includes('seven-pairs.routes'))return ['未达到题设的七对向听或进张标准'];
 const r=analyze(q.context),selected=r.discards.find(d=>d.tile===a.answer[0]),best=r.discards[0];
 return selected&&best?[selected.shanten>best.shanten?`舍牌后多${selected.shanten-best.shanten}向听`:`同向听时少${best.ukeire-selected.ukeire}张进张`]:['没有提交题设允许的舍牌'];
}
const median=(xs:number[])=>xs.length?[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]:null;
export type SkillFact={id:string;mode:Mode;skillId:string;name:string;level:number;levelName:string;count:number;correct:number;accuracy:number;interval:[number,number];status:'insufficient'|'preliminary'|'observed';medianMs:number|null;evidenceIds:string[];errors:string[];finding:'strength'|'weakness'|'uncertain';lessonId:string};
export function learningFacts(attempts:Attempt[]):SkillFact[]{
 const groups=new Map<string,{skillId:string;mode:Mode;level:number;items:Attempt[]}>();
 for(const a of uniqueAttempts(attempts)){const q=exercise(a.ref),level=q.metadata?.difficulty??0,skills=q.metadata?.skillIds??[`legacy.${a.ref.mode}`];
  for(const skillId of skills){const key=`${skillId}:${level}`,g=groups.get(key)??{skillId,mode:a.ref.mode,level,items:[]};g.items.push(a);groups.set(key,g);}
 }
 return [...groups.values()].map(g=>{const xs=g.items,n=xs.length,k=xs.filter(a=>a.correct).length,interval=wilson(k,n)!,skill=skillById(g.skillId),wrong=xs.filter(a=>!a.correct),right=xs.filter(a=>a.correct);
  return {id:`fact:${g.skillId}:${g.level}`,mode:g.mode,skillId:g.skillId,name:skill?.name??'旧版专项记录',level:g.level,levelName:DIFFICULTY_NAMES[g.level],count:n,correct:k,accuracy:k/n,interval,status:n<5?'insufficient':n<20?'preliminary':'observed',medianMs:median(right.filter(a=>a.source!=='competition'&&a.durationMs>=300&&a.durationMs<1800000).map(a=>a.durationMs)),evidenceIds:(wrong.length?wrong:right).slice(-5).map(a=>a.id),errors:[...new Set(wrong.flatMap(diagnose))].slice(0,5),finding:n>=20&&interval[0]>=.8?'strength':n>=5&&interval[1]<.8?'weakness':'uncertain',lessonId:skill?.lessonId??exercise(xs[0].ref).lessonId} as SkillFact;
 });
}
export function factualClaims(facts:SkillFact[]){return {
 strengths:facts.filter(f=>f.finding==='strength').map(f=>({mode:f.mode,text:`${f.name} · ${f.levelName}：${f.count}道首次独立作答中答对${f.correct}道；表现已较稳定。`,evidenceIds:f.evidenceIds})),
 weaknesses:facts.filter(f=>f.finding==='weakness').sort((a,b)=>a.interval[1]-b.interval[1]).map(f=>({mode:f.mode,text:`${f.name} · ${f.levelName}：${f.count}道首次独立作答中答对${f.correct}道。可核对的问题：${f.errors.join('；')}。`,evidenceIds:f.evidenceIds})),
};}
export function learningTrends(attempts:Attempt[]){
 const first=uniqueAttempts(attempts),facts=learningFacts(first);
 return facts.flatMap(f=>{const xs=first.filter(a=>{const q=exercise(a.ref);return (q.metadata?.difficulty??0)===f.level&&(q.metadata?.skillIds??[`legacy.${a.ref.mode}`]).includes(f.skillId);});
  if(xs.length<20)return [];const before=xs.slice(-20,-10),after=xs.slice(-10),a=wilson(before.filter(x=>x.correct).length,10)!,b=wilson(after.filter(x=>x.correct).length,10)!;
  const time=(rows:Attempt[])=>{const valid=rows.filter(x=>x.correct&&x.source!=='competition'&&x.durationMs>=300&&x.durationMs<1800000);return valid.length>=5?median(valid.map(x=>x.durationMs)):null;};
  return [{id:f.id,name:f.name,levelName:f.levelName,previousCorrect:before.filter(x=>x.correct).length,recentCorrect:after.filter(x=>x.correct).length,previousMs:time(before),recentMs:time(after),conclusion:b[0]>a[1]?'这一组观察到正确率提高':b[1]<a[0]?'这一组观察到正确率下降':'暂看不出稳定变化'}];
 });
}
