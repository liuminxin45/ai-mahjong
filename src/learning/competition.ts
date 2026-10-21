import { questionBank } from './bank.js';
import { BANK_VERSION, DIFFICULTIES, DIFFICULTY_NAMES, type Difficulty } from './curriculum.js';
import type { Exercise, ExerciseRef, Mode, Attempt } from './index.js';
import type { DrawModel } from '../engine/deep.js';
import type { TileId } from '../engine/index.js';

export type PublicQuestion=Pick<Exercise,'id'|'ref'|'context'|'title'|'prompt'|'lessonId'|'scenario'|'metadata'>&{model?:DrawModel};
export type CompetitionPaper={id:string;version:string;difficulty:Difficulty;title:string;refs:ExerciseRef[];archived?:boolean};
const order:Mode[]=['discard','ukeire','waits','seven-pairs','defense'];
export const competitionPapers:CompetitionPaper[]=DIFFICULTIES.map(level=>({id:`chengdu-${BANK_VERSION}-L${level}`,version:BANK_VERSION,difficulty:level,title:`${DIFFICULTY_NAMES[level]}挑战`,refs:order.flatMap(mode=>questionBank.filter(q=>q.metadata.pool==='competition'&&q.ref.mode===mode&&q.metadata.difficulty===level).map(q=>q.ref))}));
export function publicQuestion(q:Exercise):PublicQuestion{return {id:q.id,ref:q.ref,context:q.context,title:q.title,prompt:q.prompt,lessonId:q.lessonId,...(q.metadata?{metadata:q.metadata}:{}),...(q.scenario?{scenario:{...q.scenario,rationale:''}}:{}),...(q.deep?{model:q.deep.model}:{})};}
export type CompetitionRun={runId:string;paperId:string;status:'active'|'complete'|'abandoned'|'expired';startedAt:string;expiresAt:string;serverNow:string;index:number;question?:PublicQuestion;score?:number;durationMs?:number;attempts?:Attempt[]};
export type Ranking={rank:number;publicId:string;alias:string;score:number;durationMs:number;achievedAt:string;mine:boolean};
export type CompetitionBoard={entries:Ranking[];mine:Ranking|null;total:number;archived:boolean};
export type CompetitionClient={papers():Promise<CompetitionPaper[]>;start(paperId:string,requestId:string):Promise<CompetitionRun>;resume(runId:string):Promise<CompetitionRun>;answer(runId:string,index:number,answer:TileId[]):Promise<CompetitionRun>;abandon(runId:string):Promise<void>;board(paperId:string,offset?:number):Promise<CompetitionBoard>};
