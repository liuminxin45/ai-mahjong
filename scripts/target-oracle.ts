// Independent complete-target enumerator. The production engine decomposes the
// input hand; this oracle constructs legal targets, then maximizes tile overlap.
const tables=new Map<string,number[][]>();
const overlaps=new Map<string,number>();
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
 // Hypothetical draws often leave the other suit unchanged. Memoize that
 // subproblem without changing the independent legal-target enumeration.
 const key=`${hand.join('')}:${capacity.join('')}:${groups}:${pair}`;
 const cached=overlaps.get(key);if(cached!==undefined)return cached;
 let best=-999;
 for(const target of targets(groups,pair)){let sum=0,valid=true;for(let i=0;i<9;i++){if(target[i]>capacity[i]){valid=false;break;}sum+=Math.min(hand[i],target[i]);}if(valid&&sum>best)best=sum;}
 if(overlaps.size>100000)overlaps.clear();overlaps.set(key,best);return best;
}
export function targetOracle(c:number[],fixed:number,fixedCounts:number[]):number{
 let best=-999;
 for(let a=0;a<=4-fixed;a++)for(const pairA of [false,true])best=Math.max(best,overlap(c.slice(0,9),fixedCounts.slice(0,9).map(n=>4-n),a,pairA)+overlap(c.slice(9),fixedCounts.slice(9).map(n=>4-n),4-fixed-a,!pairA));
 return 13-fixed*3-best;
}
