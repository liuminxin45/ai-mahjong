import { sorted, TILES, type TileId } from './engine/index.js';
import type { CompetitionClient, CompetitionRun } from './learning/competition.js';

export type PendingCompetition={paperId:string;requestId:string;abandonId?:string};
export type CompetitionChoice={runId:string;index:number;selected:TileId[];selectedIndex?:number;judgmentSelected:boolean};
export function restoreCompetitionChoice(run:CompetitionRun,value:unknown):CompetitionChoice|null{
  const choice=value as CompetitionChoice|undefined,q=run.question;
  if(run.status!=='active'||!q||!choice||choice.runId!==run.runId||choice.index!==run.index||!Array.isArray(choice.selected)||choice.selected.length>18||choice.selected.some(t=>!TILES.includes(t))||new Set(choice.selected).size!==choice.selected.length)return null;
  const multi=['waits','ukeire'].includes(q.ref.mode),judgment=q.metadata?.response==='judgment';
  if(judgment){if(choice.selected.length>1||choice.selected[0]&&choice.selected[0]!==q.metadata?.judgmentTile)return null;return {...choice,judgmentSelected:choice.judgmentSelected===true,selectedIndex:undefined};}
  if(!multi&&(choice.selected.length>1||choice.selected[0]&&!q.context.hand.includes(choice.selected[0])))return null;
  const hand=sorted(q.context.hand),index=choice.selectedIndex;
  return {...choice,judgmentSelected:false,selectedIndex:multi?undefined:index!==undefined&&hand[index]===choice.selected[0]?index:hand.indexOf(choice.selected[0])};
}
export function pendingCompetition(value:unknown):PendingCompetition|null{
  const p=value as PendingCompetition|undefined;
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  return p&&typeof p.paperId==='string'&&/^[a-zA-Z0-9.-]{1,128}$/.test(p.paperId)&&typeof p.requestId==='string'&&uuid.test(p.requestId)&&(!p.abandonId||uuid.test(p.abandonId))?p:null;
}
export function sameCompetitionQuestion(a:CompetitionRun|null,b:CompetitionRun){
  return a?.status==='active'&&b.status==='active'&&a.runId===b.runId&&a.index===b.index;
}
export class CompetitionSession{
  current:CompetitionRun|null=null;
  private generation=0;
  private changing=false;
  private recovery?:{id:string;promise:Promise<CompetitionRun|null>};
  constructor(private client:CompetitionClient){}
  get busy(){return this.changing;}
  private accept(run:CompetitionRun){this.current=run;return run;}
  restore(id:string):Promise<CompetitionRun|null>{
    if(this.changing)return Promise.resolve(null);
    if(this.recovery?.id===id)return this.recovery.promise;
    const generation=++this.generation;
    const promise=this.client.resume(id).then(run=>generation===this.generation?this.accept(run):null).finally(()=>{if(this.recovery?.promise===promise)this.recovery=undefined;});
    this.recovery={id,promise};return promise;
  }
  async start(pending:PendingCompetition):Promise<CompetitionRun|null>{
    if(this.changing)return null;
    this.changing=true;this.generation++;
    try{
      if(pending.abandonId)await this.client.abandon(pending.abandonId);
      try{return this.accept(await this.client.start(pending.paperId,pending.requestId));}
      catch(e){const id=(e as Error&{runId?:string}).runId;if(id)return this.accept(await this.client.resume(id));throw e;}
    }finally{this.changing=false;}
  }
  async answer(index:number,answer:TileId[]):Promise<CompetitionRun|null>{
    const run=this.current;if(this.changing||run?.status!=='active'||run.index!==index)return null;
    this.changing=true;this.generation++;
    try{
      try{return this.accept(await this.client.answer(run.runId,index,answer));}
      catch(original){
        // A lost response may still have saved the answer. Read before asking for a retry.
        try{const next=await this.client.resume(run.runId);if(next.index>index||next.status!=='active')return this.accept(next);}catch{}
        throw original;
      }
    }finally{this.changing=false;}
  }
}
