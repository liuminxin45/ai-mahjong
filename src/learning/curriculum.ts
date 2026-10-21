import type { Mode, Attempt } from './index.js';

export const BANK_VERSION='2.0.0' as const;
export type Difficulty=1|2|3|4|5|6;
export const DIFFICULTIES:Difficulty[]=[1,2,3,4,5,6];
export const DIFFICULTY_NAMES=['历史未分级','入门','基础','进阶','困难','大师','地狱'];
export const SOURCES={
 mil:{id:'mil-sbr',title:'MIL 四川麻将规则纲要',url:'https://mahjong-mil.org/wp-content/uploads/2024/08/Brief_Introduction_to_Bloody_Mahjong-1.pdf',version:'官网公开纲要（2024归档）',clauses:'第2节碰杠、第3节和牌、第5节缺门'},
 ies:{id:'ies-learning',title:'IES 学习与教学实践指南',url:'https://ies.ed.gov/ncee/wwc/PracticeGuide/1',version:'2007',clauses:'建议1间隔学习、建议2例题与练习交替、建议5提取练习'},
 nist:{id:'nist-wilson',title:'NIST 二项比例置信区间',url:'https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm',version:'7.2.4.1',clauses:'Wilson 区间'},
 tool:{id:'tool-two-suits',title:'麻将研习专项约定',version:BANK_VERSION,clauses:'条筒72张；四张同牌可算两对；有限抽牌袋仅适用于题设模型'},
};
export type Skill={id:string;mode:Mode;name:string;lessonId:string;prerequisites:string[]};
const groups:Record<Mode,[string,string,number][]>= {
 discard:[['distance','向听优先',7],['comparison','进张比较',10],['shapes','搭子取舍',11],['ties','并列最优',12],['routes','路线竞争',15],['planning','多步选择',23]],
 ukeire:[['reduction','降向听判定',8],['counting','牌种与张数',9],['overlap','重叠去重',6],['visible','可见牌扣减',9],['future','后续变化',23]],
 waits:[['basic','常见听形',2],['compound','复合拆解',13],['one-suit','清一色',14],['routes','双路线听口',15],['dead','见尽听口',9]],
 'seven-pairs':[['counting','对子计数',3],['quad','四张算两对',3],['discard','拆对取舍',5],['routes','路线转换',15],['planning','多步成对',23]],
 defense:[['goal','判断目标',19],['information','公开信息',17],['certainty','确定与推测',16],['boundary','安全边界',18],['opponents','多对手约束',20],['tradeoff','攻守取舍',21]],
};
export const SKILLS:Skill[]=Object.entries(groups).flatMap(([mode,rows])=>rows.map(([id,name,lesson],i)=>({id:`${mode}.${id}`,mode:mode as Mode,name,lessonId:`lesson-${String(lesson).padStart(2,'0')}`,prerequisites:i?[`${mode}.${rows[i-1][0]}`]:[]})));
export const skillById=(id:string)=>SKILLS.find(s=>s.id===id);
export function recommendation(mode:Mode,attempts:Attempt[]):{level:Difficulty;count:number;correct:number;reason:string}{
 let level:Difficulty=1,window:Attempt[]=[],correct=0;
 const seen=new Set<string>();
 for(const a of [...attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){
  if(a.ref.mode!==mode||a.ref.version!==BANK_VERSION||!a.difficulty||a.assisted||a.review||seen.has(a.familyId??a.exerciseId))continue;
  seen.add(a.familyId??a.exerciseId);
  if(a.difficulty!==level)continue;
  window.push(a);
  if(window.length===20){correct=window.filter(x=>x.correct).length;const next=correct>=17?Math.min(5,level+1):correct<10?Math.max(1,level-1):level;level=next as Difficulty;window=[];}
 }
 return {level,count:window.length,correct:window.filter(a=>a.correct).length,reason:`同档累计20道首次独立作答后检查：答对至少17道推荐升一级，少于10道推荐降一级。地狱级由你主动选择。`};
}
