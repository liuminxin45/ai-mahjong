import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {analyze,type TileId} from '../src/engine/index.js';
import {createRound,configurations,playerDiscard,automaticStep,publicContext,random,type RoundState} from '../src/journey/round.js';
import {targetOracle} from './target-oracle.js';
function physicalOracle(s:RoundState){const deck=[...s.hands.flat(),...s.rivers.flat(),...s.wall.slice(s.cursor)],copies=new Map<string,Set<string>>();assert.equal(deck.length,72);for(const t of deck){assert.match(t.id,/^[1-9][ps]:[0-3]$/);const set=copies.get(t.tile)??new Set();assert.ok(!set.has(t.id));set.add(t.id);copies.set(t.tile,set);}assert.equal(copies.size,18);for(const set of copies.values())assert.equal(set.size,4);}
const endings=new Map<string,unknown>(),next=random(6230424);let paths=0,events=0;
for(const config of configurations)for(let first=0;first<14;first++){
 let s=createRound(config.id,first*17+13),turn=0;physicalOracle(s);
 while(s.phase!=='over'){
  if(s.phase==='player'){const chosen=turn++===0?first:Math.floor(next()*14);s=playerDiscard(s,{id:s.id+':'+s.seq,seq:s.seq,tileId:s.hands[0][chosen].id,elapsedMs:1000,assisted:false});}
  else s=automaticStep(s);
  physicalOracle(s);events++;
 }
 if(s.end!.kind!=='exhausted'){const hand=s.hands[s.end!.winner!].map(t=>t.tile);if(s.end!.kind==='discard-win')hand.push(s.end!.tile!.tile);const c=Array(18).fill(0);for(const t of hand)c[(t[1]==='p'?0:9)+Number(t[0])-1]++;assert.ok(targetOracle(c,0,Array(18).fill(0))===-1||c.reduce((n,x)=>n+Math.floor(x/2),0)===7);}
 else assert.equal(s.cursor,s.wall.length);
 const key=s.end!.kind+':'+(s.end!.winner??'none');if(!endings.has(key))endings.set(key,{config:config.id,seed:s.seed,commands:s.commands});paths++;
}
assert.ok([...endings.keys()].some(k=>k.startsWith('self-draw:0')));assert.ok(endings.has('exhausted:none'));
mkdirSync('artifacts/journey',{recursive:true});writeFileSync('artifacts/journey/physical-oracle.json',JSON.stringify({paths,events,endings:Object.fromEntries(endings)},null,2));console.log(JSON.stringify({paths,events,endingKinds:[...endings.keys()],independentPhysicalOracle:true,independentWinningTargetOracle:true}));
