import raw from './bank.json' with {type:'json'};
import { TILES, setTiles, type HandContext, type TileId } from '../engine/index.js';
import type { DeepCertificate } from '../engine/deep.js';
import type { Exercise, Mode } from './index.js';
import { BANK_VERSION, type Difficulty } from './curriculum.js';

export type QuestionMetadata={version:typeof BANK_VERSION;difficulty:Difficulty;skillIds:string[];familyId:string;pool:'practice'|'competition';conditions:string[];objective:string;sources:string[];calibration:'design';structureBranches:number;response?:'judgment';judgmentTile?:TileId};
export type BankExercise=Exercise&{metadata:QuestionMetadata;accepted:TileId[];deep?:DeepCertificate};
export const questionBank=raw as unknown as BankExercise[];
const index=new Map(questionBank.map(q=>[`${q.ref.mode}:${q.ref.seed}`,q]));
export function bankExercise(mode:Mode,seed:number):BankExercise{const q=index.get(`${mode}:${seed}`);if(!q)throw new Error('题目版本或编号不存在。');return q;}
export function practiceQuestions(mode:Mode,difficulty:Difficulty){return questionBank.filter(q=>q.ref.mode===mode&&q.metadata.difficulty===difficulty&&q.metadata.pool==='practice');}
export function canonicalFamily(mode:string,ctx:HandContext,goal='',waits:TileId[]=[],deep?:DeepCertificate['model'],target?:TileId):string{
 const forms:string[]=[];
 for(const swap of [false,true])for(const reverse of [false,true]){
  const tile=(t:TileId):TileId=>`${reverse?10-Number(t[0]):t[0]}${swap?(t[1]==='p'?'s':'p'):t[1]}` as TileId;
  const bag=(ts:TileId[])=>ts.map(tile).sort().join(',');
  const visible=TILES.flatMap(t=>ctx.visible?.[t]?[`${tile(t)}:${ctx.visible[t]}`]:[]).sort();
  forms.push(JSON.stringify([mode,bag(ctx.hand),(ctx.fixedSets??[]).map(s=>bag(setTiles(s))).sort(),visible,goal,bag(waits),deep?[bag(deep.bag),deep.horizon,deep.target,deep.kind,bag(deep.safeDiscards??[])]:null,target?tile(target):null]));
 }
 return forms.sort()[0];
}
