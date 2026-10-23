import type { HandContext, TileId } from '../src/engine/index.js';
import type { ScenarioModel } from '../src/story/model.js';
import { independentFan } from './decision-verifier.js';
const names=Array.from({length:18},(_,i)=>(i%9+1)+(i<9?'p':'s')) as TileId[];
const take=(xs:TileId[],tile:TileId)=>{const a=[...xs];a.splice(a.indexOf(tile),1);return a;};
const distanceMemo=new Map<string,number>();
function distance(hand:TileId[]):number {
  const key=[...hand].sort().join('');if(distanceMemo.has(key))return distanceMemo.get(key)!;
  const c=names.map(t=>hand.filter(x=>x===t).length);let minimum=6-c.reduce((n,v)=>n+Math.floor(v/2),0);
  function dfs(start:number,meld:number,taatsu:number,pair:number){while(start<18&&!c[start])start++;if(start===18){minimum=Math.min(minimum,8-2*meld-Math.min(taatsu,4-meld)-pair);return;}
    c[start]--;dfs(start,meld,taatsu,pair);c[start]++;
    if(c[start]>=3){c[start]-=3;dfs(start,meld+1,taatsu,pair);c[start]+=3;}
    if(start%9<7&&c[start+1]&&c[start+2]){c[start]--;c[start+1]--;c[start+2]--;dfs(start,meld+1,taatsu,pair);c[start]++;c[start+1]++;c[start+2]++;}
    if(c[start]>=2){c[start]-=2;if(!pair)dfs(start,meld,taatsu,1);dfs(start,meld,taatsu+1,pair);c[start]+=2;}
    for(const delta of [1,2])if(start%9+delta<9&&c[start+delta]){c[start]--;c[start+delta]--;dfs(start,meld,taatsu+1,pair);c[start]++;c[start+delta]++;}
  }dfs(0,0,0,0);distanceMemo.set(key,minimum);return minimum;
}
const points=(hand:TileId[],fixed:NonNullable<HandContext['fixedSets']>=[])=>{const fan=independentFan(hand,fixed);return fan===null?0:2**Math.min(3,fan);};
function policy(hand:TileId[],drawn:TileId,model:ScenarioModel){if(model.policy==='draw-discard')return drawn;return [...new Set(hand)].sort((a,b)=>distance(take(hand,a))-distance(take(hand,b))||names.indexOf(a)-names.indexOf(b))[0];}
type Hidden={index:number;at:number;hand:TileId[]};
type Sum={score:bigint;wins:bigint;losses:bigint;draws:bigint};
const zero=():Sum=>({score:0n,wins:0n,losses:0n,draws:0n});
function add(to:Sum,from:Sum){to.score+=from.score;to.wins+=from.wins;to.losses+=from.losses;to.draws+=from.draws;}
/** Independent physical path enumeration; no production search, shanten or scoring calls. */
export function verifyScenario(context:HandContext,model:ScenarioModel){
  const compatible=model.worlds.map(w=>!model.observedDiscard||!points([...w.opponent,model.observedDiscard])&&policy([...w.opponent,model.observedDiscard],w.previousDraw??model.observedDiscard,model)===model.observedDiscard);
  const initial=model.worlds.map((w,index)=>({index,at:0,hand:[...w.opponent]})).filter((_,i)=>compatible[i]);
  function evaluate(hand:TileId[],states:Hidden[],discard:TileId):Sum {
    const result=zero(),next=take(hand,discard),partitions=new Map<string,{hand:TileId[];states:Hidden[]}>();
    for(const source of states){const s={...source,hand:[...source.hand]},world=model.worlds[s.index],weight=BigInt(world.weight),ron=points([...s.hand,discard]);if(ron){result.score-=weight*BigInt(ron);result.losses+=weight;continue;}
      const observations:string[]=[];let done=false;
      for(const actor of [1,2,3,0]){if(s.at===model.draws||s.at===world.wall.length){if(s.at===world.wall.length)result.draws+=weight;done=true;break;}
        const tile=world.wall[s.at++];
        if(actor===0){const own=[...next,tile],value=points(own,context.fixedSets);if(value){result.score+=weight*BigInt(value);result.wins+=weight;}else{const key=[...observations,'own:'+tile].join('|'),bucket=partitions.get(key)??{hand:own,states:[]};bucket.states.push(s);partitions.set(key,bucket);}done=true;break;}
        if(actor===2){const drawn=[...s.hand,tile],value=points(drawn);if(value){result.score-=weight*BigInt(value);result.losses+=weight;done=true;break;}const out=policy(drawn,tile,model);s.hand=take(drawn,out);observations.push('opponent:'+out);}else observations.push(actor+':'+tile);
      }if(!done)throw Error('Reference path did not terminate');
    }
    for(const bucket of partitions.values()){let best:Sum|undefined;for(const tile of names.filter(t=>bucket.hand.includes(t))){const value=evaluate(bucket.hand,bucket.states,tile);if(!best||value.score>best.score||value.score===best.score&&value.wins>best.wins)best=value;}add(result,best!);}
    return result;
  }
  const options=names.filter(t=>context.hand.includes(t)).map(tile=>{const s=evaluate(context.hand,initial,tile);return {tile,score:String(s.score),wins:String(s.wins),losses:String(s.losses),draws:String(s.draws)};});
  const maximum=options.reduce((a,b)=>BigInt(b.score)>BigInt(a.score)?b:a).score;
  return {denominator:String(initial.reduce((n,s)=>n+model.worlds[s.index].weight,0)),options,accepted:options.filter(o=>o.score===maximum).map(o=>o.tile),compatible};
}
