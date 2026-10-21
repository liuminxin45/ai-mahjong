import { it, expect } from 'vitest';
import { normalShanten } from '../src/engine/index.js';

// Independent complete-target enumerator. The production engine decomposes the
// input hand; this oracle constructs legal targets, then maximizes tile overlap.
const tables=new Map<string,number[][]>();
function targets(melds:number,pair:boolean):number[][]{
 const key=`${melds}:${pair}`;if(tables.has(key))return tables.get(key)!;
 const sets:number[][]=[];for(let i=0;i<9;i++){const a=Array(9).fill(0);a[i]=3;sets.push(a);}for(let i=0;i<7;i++){const a=Array(9).fill(0);a[i]=a[i+1]=a[i+2]=1;sets.push(a);}
 const c=Array(9).fill(0),out=new Map<string,number[]>();
 const add=()=>out.set(c.join(''),[...c]);
 function visit(start:number,left:number){if(!left){if(!pair)add();else for(let p=0;p<9;p++)if(c[p]<=2){c[p]+=2;add();c[p]-=2;}return;}
  for(let s=start;s<sets.length;s++){const v=sets[s];if(c.some((n,i)=>n+v[i]>4))continue;for(let i=0;i<9;i++)c[i]+=v[i];visit(s,left-1);for(let i=0;i<9;i++)c[i]-=v[i];}}
 visit(0,melds);const result=[...out.values()];tables.set(key,result);return result;
}
function overlap(hand:number[],capacity:number[],groups:number,pair:boolean):number{
 let best=-999;
 for(const target of targets(groups,pair)){let sum=0,valid=true;for(let i=0;i<9;i++){if(target[i]>capacity[i]){valid=false;break;}sum+=Math.min(hand[i],target[i]);}if(valid&&sum>best)best=sum;}
 return best;
}
function oracle(c:number[],fixed:number,fixedCounts:number[]):number{
 let best=-999;
 for(let a=0;a<=4-fixed;a++)for(const pairA of [false,true])best=Math.max(best,overlap(c.slice(0,9),fixedCounts.slice(0,9).map(n=>4-n),a,pairA)+overlap(c.slice(9),fixedCounts.slice(9).map(n=>4-n),4-fixed-a,!pairA));
 return 13-fixed*3-best;
}
it('双花色随机手牌、碰杠容量与独立完整和型枚举结果一致',async()=>{
 let seed=20261021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const n=Number(process.env.MAHJONG_ORACLE_SAMPLES??240);
 for(let sample=0;sample<n;sample++){
  const fixed=sample%12===0?1:sample%7===0?3:sample%11===0?4:0,physical=Array(18).fill(0);
  for(let i=0;i<fixed;){const x=random()%18;if(physical[x])continue;physical[x]=random()%2?3:4;i++;}
  const c=Array(18).fill(0);for(let i=0;i<13-fixed*3+sample%2;){const x=random()%18;if(c[x]+physical[x]>=4)continue;c[x]++;i++;}
  expect(normalShanten(c,fixed,physical)).toBe(oracle(c,fixed,physical));
  if(sample%100===0)await new Promise<void>(resolve=>setImmediate(resolve));
 }
},600000);
