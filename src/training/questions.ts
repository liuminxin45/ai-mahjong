import raw from './questions.json' with {type:'json'};
import { analyze, countsOf, sorted, TILES, type HandContext, type TileId } from '../engine/index.js';
import { TRAINING_VERSION, type TopicId } from './topics.js';
export type TrainingQuestion={id:string;topic:TopicId;context:HandContext;family:string;accepted:TileId[];note:string;exampleGroups:TileId[][]};
export const trainingQuestions=raw as TrainingQuestion[];
const byId=new Map(trainingQuestions.map(q=>[q.id,q]));
export function question(id:string):TrainingQuestion {const q=byId.get(id);if(!q)throw new Error('这道题的版本或编号不存在。');return q;}
export function structure(ctx:HandContext):string{
 const forms:string[]=[];
 for(const swap of [false,true])for(const reverseP of [false,true])for(const reverseS of [false,true]){
  const tile=(t:TileId):TileId=>`${(t[1]==='p'?reverseP:reverseS)?10-Number(t[0]):t[0]}${swap?(t[1]==='p'?'s':'p'):t[1]}` as TileId;
  forms.push(JSON.stringify([sorted(ctx.hand.map(tile)),(ctx.fixedSets??[]).map(s=>[s.kind,tile(s.tile)]).sort(),Object.entries(ctx.visible??{}).filter(([,n])=>n).map(([t,n])=>[tile(t as TileId),n]).sort()]));
 }
 return forms.sort()[0];
}
export function checkAnswer(q:TrainingQuestion,answer:TileId){return q.accepted.includes(answer);}
export function feedback(q:TrainingQuestion,answer:TileId){
 const r=analyze(q.context),best=r.discards.find(d=>d.best)!,chosen=r.discards.find(d=>d.tile===answer);
 if(!chosen)throw new Error('请选择手牌中的一张。');
 if(chosen.best)return q.accepted.length>1?'这个选择和其他最优舍牌一样，保留了相同的距离和改善机会。':'这个选择保持了更近的距离，并在同样接近的方案中保留了最多改善机会。';
 if(chosen.shanten>best.shanten)return `这样打会多${chosen.shanten-best.shanten}步才能${best.shanten===-1?'成牌':'听牌'}。先保留距离更近的选择。`;
 return `同样接近听牌，推荐方案多保留了${best.ukeire-chosen.ukeire}张改善机会。`;
}
export function available(ctx:HandContext){const c=countsOf(ctx.hand);return TILES.filter((_,i)=>c[i]>0);}
export function explainChoice(q:TrainingQuestion){const r=analyze(q.context),best=r.discards.find(d=>d.best)!;const names=best.improvements.map(d=>`${d.tile[0]}${d.tile[1]==='p'?'筒':'条'}`).join('、');return best.shanten===0?`打掉${best.tile[0]}${best.tile[1]==='p'?'筒':'条'}后已经听牌。${names?`再来${names}中的一种就能和，尚未见到的余量共${best.ukeire}张。`:'但和牌所需的牌已经见尽。'}`:`打掉${best.tile[0]}${best.tile[1]==='p'?'筒':'条'}后，还需改善${best.shanten}次才能听牌。${names?`再来${names}，能让距离缩短一步，余量共${best.ukeire}张。`:'当前没有仍有余量的直接改善牌。'}`;}
export {TRAINING_VERSION};
