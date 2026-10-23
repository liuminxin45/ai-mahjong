import {analyze,countsOf,decompose,shanten,TILES,type TileId,type HandContext} from '../engine/index.js';
import deals from './deals.json' with {type:'json'};

export const ROUND_VERSION='family-table-1';
export type Seat=0|1|2|3;
export type PhysicalTile={id:string;tile:TileId};
export type RoundConfig={id:string;chapter:number;family:string;hands:TileId[][];rivers:TileId[][];wall:TileId[]};
export const configurations=deals as RoundConfig[];
export type RoundEvent={seq:number;kind:'draw'|'discard'|'win'|'exhausted';seat:Seat;tile?:PhysicalTile;from?:Seat};
export type RoundEnd={kind:'self-draw'|'discard-win'|'exhausted';winner?:Seat;from?:Seat;tile?:PhysicalTile};
export type PlayerCommand={id:string;seq:number;tileId:string;elapsedMs:number;assisted:boolean};
export type RoundState={version:typeof ROUND_VERSION;id:string;configId:string;seed:number;hands:PhysicalTile[][];rivers:PhysicalTile[][];wall:PhysicalTile[];cursor:number;seat:Seat;phase:'player'|'draw'|'discard'|'over';seq:number;lastDraw?:string;events:RoundEvent[];commands:PlayerCommand[];end?:RoundEnd};
export function random(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function shuffled<T>(source:T[],seed:number):T[]{const out=[...source],next=random(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function createRound(configId:string,seed:number,id=configId+':'+seed):RoundState{
  const config=configurations.find(c=>c.id===configId);if(!config||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||!id)throw Error('这页牌谱没有记全。');
  const copies=Array(18).fill(0),physical=(tile:TileId):PhysicalTile=>({id:tile+':'+copies[TILES.indexOf(tile)]++,tile});
  const hands=config.hands.map(h=>h.map(physical)),rivers=config.rivers.map(h=>h.map(physical)),wall=shuffled(config.wall.map(physical),seed);
  const state:RoundState={version:ROUND_VERSION,id,configId,seed,hands,rivers,wall,cursor:0,seat:0,phase:'player',seq:0,events:[],commands:[]};
  validateRound(state);if(decompose(hands[0].map(t=>t.tile)))throw Error('开局已经成牌。');return state;
}
export function validateRound(s:RoundState):void{
  if(s.version!==ROUND_VERSION||s.hands.length!==4||s.rivers.length!==4||s.cursor<0||s.cursor>s.wall.length)throw Error('牌局记录不完整。');
  const all=[...s.hands.flat(),...s.rivers.flat(),...s.wall.slice(s.cursor)];
  if(all.length!==72||new Set(all.map(t=>t.id)).size!==72||countsOf(all.map(t=>t.tile)).some(n=>n!==4))throw Error('牌数不守恒。');
  if(s.hands.some((h,i)=>h.length!==(i===s.seat&&['player','discard'].includes(s.phase)?14:13)&&!(s.phase==='over'&&h.length===14)))throw Error('手牌张数不合法。');
}
const clone=(s:RoundState):RoundState=>({...s,hands:s.hands.map(h=>[...h]),rivers:s.rivers.map(h=>[...h]),events:[...s.events],commands:[...s.commands]});
function emit(s:RoundState,e:Omit<RoundEvent,'seq'>){s.events.push({...e,seq:++s.seq});}
function win(s:RoundState,winner:Seat,tile:PhysicalTile,from?:Seat){s.end={kind:from===undefined?'self-draw':'discard-win',winner,...(from===undefined?{}:{from}),tile};s.phase='over';emit(s,{kind:'win',seat:winner,tile,...(from===undefined?{}:{from})});}
function discard(s:RoundState,id:string){
  const seat=s.seat,index=s.hands[seat].findIndex(t=>t.id===id);if(index<0)throw Error('这张牌不在手中。');
  const [tile]=s.hands[seat].splice(index,1);s.rivers[seat].push(tile);emit(s,{kind:'discard',seat,tile});s.lastDraw=undefined;
  for(let offset=1;offset<4;offset++){const other=(seat+offset)%4 as Seat;if(decompose([...s.hands[other].map(t=>t.tile),tile.tile])){win(s,other,tile,seat);return;}}
  s.seat=(seat+1)%4 as Seat;s.phase='draw';
}
export function publicContext(s:RoundState,seat:Seat=0):HandContext{
  const visible:Partial<Record<TileId,number>>={};for(const t of s.rivers.flat())visible[t.tile]=(visible[t.tile]??0)+1;
  return {hand:s.hands[seat].map(t=>t.tile),visible};
}
/** NPC policy reads its own tiles and ordered public rivers, never the wall or other hands. */
export function npcDiscard(context:HandContext):TileId{return analyze(context).discards[0].tile;}
export function playerDiscard(state:RoundState,command:PlayerCommand):RoundState{
  const old=state.commands.find(c=>c.id===command.id);if(old){if(JSON.stringify(old)!==JSON.stringify(command))throw Error('这一手已经落定。');return state;}
  if(state.phase!=='player'||state.seat!==0||command.seq!==state.seq)throw Error('还没轮到这一手。');
  if(!/^[a-zA-Z0-9:_-]{1,100}$/.test(command.id)||!Number.isFinite(command.elapsedMs)||command.elapsedMs<0||command.elapsedMs>1800000||typeof command.assisted!=='boolean')throw Error('落牌记录不完整。');
  const next=clone(state);next.commands.push({...command});discard(next,command.tileId);return next;
}
export function automaticStep(state:RoundState):RoundState{
  if(state.phase==='over'||state.phase==='player')return state;
  const s=clone(state);
  if(s.phase==='draw'){
    if(s.cursor===s.wall.length){s.phase='over';s.end={kind:'exhausted'};emit(s,{kind:'exhausted',seat:s.seat});return s;}
    const tile=s.wall[s.cursor++];s.hands[s.seat].push(tile);s.lastDraw=s.seat===0?tile.id:undefined;emit(s,{kind:'draw',seat:s.seat,tile});
    if(decompose(s.hands[s.seat].map(t=>t.tile)))win(s,s.seat,tile);else s.phase=s.seat===0?'player':'discard';
  }else{const tile=npcDiscard(publicContext(s,s.seat));discard(s,s.hands[s.seat].find(t=>t.tile===tile)!.id);}
  return s;
}
export function advanceToPlayer(s:RoundState):RoundState{for(let n=0;n<12&&s.phase!=='player'&&s.phase!=='over';n++)s=automaticStep(s);return s;}
export function replayRound(configId:string,seed:number,commands:PlayerCommand[],id?:string):RoundState{
  if(!Array.isArray(commands)||commands.length>20||new Set(commands.map(c=>c.id)).size!==commands.length)throw Error('落牌记录过长或重复。');let s=createRound(configId,seed,id);
  for(const command of commands){s=playerDiscard(s,command);s=advanceToPlayer(s);}return s;
}
export function publicView(s:RoundState){return {id:s.id,seq:s.seq,hand:s.hands[0],rivers:s.rivers,remaining:s.wall.length-s.cursor,seat:s.seat,phase:s.phase,lastDraw:s.lastDraw,end:s.end};}
export function distance(hand:TileId[]){return shanten(countsOf(hand));}
