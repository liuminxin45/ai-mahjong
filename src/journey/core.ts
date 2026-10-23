import {automaticStep,configurations,createRound,playerDiscard,replayRound,type PlayerCommand,type RoundState} from './round.js';
import {entries,exits,opening,type StoryBeat} from './narrative.js';
export const JOURNEY_VERSION='sit-with-me-1';
export type TableJourney={id:string;version:typeof JOURNEY_VERSION;variant:number;seed:number;chapter:number;phase:'opening'|'entry'|'playing'|'exit'|'done';page:number;line:number;rounds:RoundState[];read:string[];middle?:StoryBeat;selected?:string;presented:boolean;at:string};
export type TableHistory={version:1;journeys:TableJourney[];reports:SavedTableProfile[]};
export type SavedTableProfile={reportId:string;at:string;profile:TableProfile};
export type TableProfile={version:6;observationId:string;questionId:string;evidenceIds:string[]};
export const emptyTables=():TableHistory=>({version:1,journeys:[],reports:[]});
export function beginTable(state:TableHistory,id:string=crypto.randomUUID(),seed=Math.floor(Math.random()*0xffffffff)):TableHistory{
 const j:TableJourney={id,version:JOURNEY_VERSION,variant:state.journeys.length%3+1,seed,chapter:1,phase:'opening',page:0,line:0,rounds:[],read:[],presented:false,at:new Date().toISOString()};
 return {...state,journeys:[...state.journeys,j]};
}
export function changeTable(h:TableHistory,id:string,fn:(j:TableJourney)=>TableJourney):TableHistory{return {...h,journeys:h.journeys.map(j=>j.id===id?fn(j):j)};}
export function activeRound(j:TableJourney){return j.rounds[j.chapter-1];}
export function pageFor(j:TableJourney):StoryBeat|undefined{return j.middle??(j.phase==='opening'?opening:j.phase==='entry'?entries[j.chapter-1]:j.phase==='exit'?exits[j.chapter-1]:[])[j.page];}
export function turnPage(j:TableJourney):TableJourney{
 if(j.middle)return {...j,middle:undefined,line:0};
 const pages=j.phase==='opening'?opening:j.phase==='entry'?entries[j.chapter-1]:j.phase==='exit'?exits[j.chapter-1]:[];
 if(!pages.length)return j;
 if(j.page<pages.length-1)return {...j,page:j.page+1,line:0};
 if(j.phase==='opening')return {...j,phase:'entry',page:0,line:0};
 if(j.phase==='exit')return j.chapter===5?{...j,phase:'done',page:0,line:0}:{...j,chapter:j.chapter+1,phase:'entry',page:0,line:0,presented:false,selected:undefined};
 const round=createRound(`table-${j.chapter}-${j.variant}`,(j.seed+j.chapter*997)>>>0,j.id+':'+j.chapter);
 return {...j,phase:'playing',page:0,line:0,rounds:[...j.rounds,round],selected:undefined,presented:false};
}
export function completeRound(j:TableJourney):TableJourney{if(activeRound(j)?.phase!=='over')return j;return {...j,phase:'exit',page:0,line:0,middle:undefined,selected:undefined};}
export function restoreTables(raw:TableHistory|undefined):TableHistory{
 if(!raw)return emptyTables();if(raw.version!==1||!Array.isArray(raw.journeys)||raw.journeys.length>5000||!Array.isArray(raw.reports))throw Error('这本牌谱暂时无法翻开。');
 for(const j of raw.journeys){if(j.version!==JOURNEY_VERSION||!/^[-a-zA-Z0-9]{1,80}$/.test(j.id)||!Number.isInteger(j.chapter)||j.chapter<1||j.chapter>5||![1,2,3].includes(j.variant)||!['opening','entry','playing','exit','done'].includes(j.phase)||!Number.isInteger(j.page)||j.page<0||!Number.isInteger(j.line)||j.line<0||!Array.isArray(j.rounds)||j.rounds.length>5)throw Error('这本牌谱的页码没能读出。');
  // Restore from commands, not saved correctness or hidden-state edits. An interrupted automatic turn resumes once.
  j.rounds=j.rounds.map(r=>replayRound(r.configId,r.seed,r.commands,r.id));
  const p=pageFor(j);if(p&&j.line>p.lines.length-1)j.line=p.lines.length-1;
 }
 return raw;
}
export type TableSnapshot={version:8;contentVersion:typeof JOURNEY_VERSION;journeys:{id:string;variant:number;seed:number;rounds:{configId:string;seed:number;commands:PlayerCommand[]}[]}[];legacy?:unknown};
export function tableSnapshot(h:TableHistory,legacy?:unknown):TableSnapshot{return {version:8,contentVersion:JOURNEY_VERSION,journeys:h.journeys.map(j=>({id:j.id,variant:j.variant,seed:j.seed,rounds:j.rounds.map(r=>({configId:r.configId,seed:r.seed,commands:r.commands}))})),...(legacy?{legacy}:{})};}
export function validateTableSnapshot(raw:unknown):TableSnapshot{
 const s=raw as TableSnapshot;if(!s||s.version!==8||s.contentVersion!==JOURNEY_VERSION||!Array.isArray(s.journeys)||s.journeys.length>5000)throw Error('不是这一版牌谱的记录。');
 const total=s.journeys.reduce((sum,j)=>sum+(j?.rounds??[]).reduce((n,r)=>n+(r?.commands?.length??0),0),0);
 if(total>50000)throw Error('记录太长，请稍后再试。');
 const ids=new Set<string>();
 for(const j of s.journeys){if(!j||typeof j.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(j.id)||ids.has(j.id)||!Number.isSafeInteger(j.seed)||j.seed<0||j.seed>0xffffffff||![1,2,3].includes(j.variant)||!Array.isArray(j.rounds)||j.rounds.length>5)throw Error('旅程记录不完整。');ids.add(j.id);
  for(let i=0;i<j.rounds.length;i++){const r=j.rounds[i];if(r.configId!==`table-${i+1}-${j.variant}`||r.seed!==((j.seed+(i+1)*997)>>>0))throw Error('这几页不属于同一次旅程。');
   const rebuilt=replayRound(r.configId,r.seed,r.commands,j.id+':'+(i+1));if(i<j.rounds.length-1&&rebuilt.phase!=='over')throw Error('前一局还没收完。');
  }
 }
 return {version:8,contentVersion:JOURNEY_VERSION,journeys:s.journeys.map(j=>({...j,rounds:j.rounds.map(r=>({...r,commands:r.commands.map(c=>({id:c.id,seq:c.seq,tileId:c.tileId,elapsedMs:c.elapsedMs,assisted:c.assisted}))}))})),...(s.legacy?{legacy:s.legacy}:{})};
}
export function allCheckpoints(s:TableSnapshot){return s.journeys.flatMap(j=>j.rounds.flatMap((r,i)=>{let state=createRound(r.configId,r.seed,j.id+':'+(i+1));return r.commands.map((c,n)=>{const before=state;state=playerDiscard(state,c);for(let k=0;k<12&&state.phase!=='player'&&state.phase!=='over';k++)state=automaticStep(state);return {id:j.id+':'+(i+1)+':'+n,roundId:j.id+':'+(i+1),family:configurations.find(d=>d.id===r.configId)!.family,chapter:i+1,before,command:c};});}));}
