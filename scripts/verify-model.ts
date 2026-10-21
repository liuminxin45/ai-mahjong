import { decompose, type HandContext, type TileId } from '../src/engine/index.js';
import type { DrawModel, ExactOption } from '../src/engine/deep.js';

// Independent representation: explicit physical tiles and a path-count expectimax.
// Does not import the production solver, its win checker, or its memo table.
export function verifyModel(ctx:HandContext,model:DrawModel,maxNodes=3000000):ExactOption[]{
 const memo=new Map<string,bigint>();let nodes=0;
 const permutations=(n:number,k:number)=>{let v=1n;for(let i=0;i<k;i++)v*=BigInt(n-i);return v;};
 const complete=(hand:TileId[])=>model.target==='seven-pairs'?hand.every(t=>hand.filter(x=>x===t).length%2===0):decompose(hand,ctx.fixedSets?.length??0)!==null;
 function future(hand:TileId[],bag:TileId[],left:number):bigint{
  if(!left)return 0n;const key=[hand.join(','),bag.join(','),left].join('|');const cached=memo.get(key);if(cached!==undefined)return cached;
  if(++nodes>maxNodes)throw new Error('独立校验超过节点预算。');
  let paths=0n;
  for(let p=0;p<bag.length;p++){
   const next=[...hand,bag[p]].sort() as TileId[],rest=bag.filter((_,i)=>i!==p);let best=0n;
   if(complete(next))best=permutations(rest.length,left-1);
   else if(left>1){for(const discard of new Set(next)){const after=[...next];after.splice(after.indexOf(discard),1);const value=future(after,rest,left-1);if(value>best)best=value;}}
   paths+=best;
  }
  memo.set(key,paths);return paths;
 }
 if(model.kind==='discard')return [...new Set(ctx.hand)].filter(t=>!model.safeDiscards||model.safeDiscards.includes(t)).sort().map(tile=>{const hand=[...ctx.hand].sort();hand.splice(hand.indexOf(tile),1);return {tile,numerator:String(future(hand,[...model.bag].sort(),model.horizon)),denominator:String(permutations(model.bag.length,model.horizon))};});
 return [...new Set(model.bag)].sort().map(tile=>{const hand=[...ctx.hand,tile].sort(),bag=[...model.bag].sort();bag.splice(bag.indexOf(tile),1);let best=complete(hand)?permutations(bag.length,model.horizon-1):0n;
  if(!best&&model.horizon>1)for(const t of new Set(hand)){const rest=[...hand];rest.splice(rest.indexOf(t),1);const value=future(rest,bag,model.horizon-1);if(value>best)best=value;}
  return {tile,numerator:String(best),denominator:String(permutations(bag.length,model.horizon-1))};});
}
