import { countsOf, setTiles, TILES, tileName, type TileId } from '../src/engine/index.js';
import { scoreCounts } from '../src/decision/score.js';
import { solveScenario, type ScenarioCertificate, type ScenarioModel } from '../src/story/model.js';
import type { DecisionQuestion } from '../src/decision/questions.js';
import type { ChallengeKind, ChallengeProof } from '../src/experience/definitions.js';
import type { StoryWitness } from '../src/story/definition.js';

export function scenarioWitness(q:DecisionQuestion,model:ScenarioModel,c:ScenarioCertificate,kind:ChallengeKind,proof:ChallengeProof,position:number):StoryWitness|null {
  const best=c.options.find(o=>o.tile===c.recommended)!,bad=c.options.filter(o=>BigInt(o.score)<BigInt(best.score)),counts=countsOf(q.context.hand);
  const gross=(tile:TileId)=>c.options.find(o=>o.tile===tile)!.outcomes.reduce((sum,o)=>sum+BigInt(Math.max(0,o.points))*BigInt(model.worlds.find(w=>w.id===o.worldId)!.weight),0n);
  if(position===19){const hands=new Set(model.worlds.filter(w=>c.prior.find(p=>p.id===w.id)?.compatible).map(w=>w.opponent.join(',')));if(hands.size>=2)return {basis:'uncertain-behavior',summary:`当前仍有${hands.size}种对手手牌与行为相容，不能把一种猜测当成确定。`,alternative:bad[0].tile,tiles:[]};return null;}
  if(position===16&&model.observedDiscard){const beforeModel={...model,observedDiscard:undefined},before=solveScenario(q.context,beforeModel);if(!before.accepted.some(t=>c.accepted.includes(t)))return {basis:'posterior-change',summary:`观察到对面打${tileName(model.observedDiscard)}后，候选减少，最优舍牌也改变了。`,alternative:before.recommended,tiles:[model.observedDiscard],before:{context:q.context,model:beforeModel,certificate:before}};return null;}
  if(kind==='gap'){
    const active=model.worlds.filter(w=>c.prior.find(p=>p.id===w.id)?.compatible),types=[...new Set([...proof.tiles,...TILES])];
    for(const tile of types){const visible=q.context.visible?.[tile]??0,returnCount=visible-Number(model.observedDiscard===tile);if(returnCount<1||active.some(w=>w.wall.includes(tile)))continue;
      const amount=Math.min(2,returnCount),context={...q.context,visible:{...q.context.visible,[tile]:visible-amount}},worlds=model.worlds.map(w=>{const wall=[...w.wall];wall.splice(Math.min(3,wall.length),0,...Array<TileId>(amount).fill(tile));return {...w,wall};}),beforeModel={...model,worlds},before=solveScenario(context,beforeModel);
      if(before.accepted.some(t=>c.accepted.includes(t)))continue;
      const known=counts[TILES.indexOf(tile)]+(q.context.visible?.[tile]??0)+(q.context.fixedSets??[]).flatMap(setTiles).filter(t=>t===tile).length;
      return {basis:known===4?'seen-out':'bag-absence',summary:known===4?`${tileName(tile)}已经见尽；将其放回合法对照局面后，最优选择改变。`:`候选牌墙中没有${tileName(tile)}；恢复这一机会后，最优选择改变。`,alternative:before.recommended,tiles:[tile],before:{context,model:beforeModel,certificate:before}};
    }return null;
  }
  if(kind==='entanglement'){
    const duplicated=proof.tiles.filter((t,i,a)=>a.indexOf(t)!==i&&counts[TILES.indexOf(t)]===1),shared=[...new Set(duplicated)];
    if(!shared.length)return null;
    if(position===18&&!shared.some(t=>model.worlds.some(w=>scoreCounts(countsOf([...w.opponent,t])))))return null;
    const alternative=bad.find(o=>proof.tiles.includes(o.tile));if(!alternative)return null;
    return {basis:'shared-physical-tile',summary:position===18?`${shared.map(tileName).join('、')}参与自己的重叠连接，也可能补成对面的和牌。`:`${shared.map(tileName).join('、')}被多种连接共用，不能把局部拆解直接相加。`,alternative:alternative.tile,tiles:proof.tiles};
  }
  if(kind==='cost'){
    const alternative=position===17?bad.find(o=>BigInt(o.losses)>BigInt(best.losses)&&(BigInt(o.wins)>BigInt(best.wins)||q.shape.discards.find(x=>x.tile===o.tile)!.shanten<q.shape.discards.find(x=>x.tile===best.tile)!.shanten||gross(o.tile)>gross(best.tile))):bad.find(o=>o.wins!==best.wins||o.losses!==best.losses||gross(o.tile)!==gross(best.tile));
    if(!alternative)return null;return {basis:position===17?'attack-safety':'opportunity-cost',summary:position===17?'推荐舍牌放弃了部分进攻机会，同时减少了题设中的失分机会。':'两种舍牌保留了不同的成牌、分值或失分机会，代价已计入平均净分。',alternative:alternative.tile,tiles:[best.tile,alternative.tile]};
  }
  if(kind==='adaptability'){
    const edge=bad.find(o=>['1','9'].includes(o.tile[0])&&!['1','9'].includes(best.tile[0]));
    if(edge)return {basis:'keep-edge',summary:`这一次，留下${tileName(edge.tile)}、打${tileName(best.tile)}，比先拆边张有更高的平均净分。`,alternative:edge.tile,tiles:[edge.tile]};
    const fast=bad.find(o=>BigInt(o.wins)>BigInt(best.wins)&&gross(best.tile)*BigInt(o.wins)>gross(o.tile)*BigInt(best.wins));
    if(fast)return {basis:'bigger-worthwhile',summary:'这一次，成牌机会较少的高分路线拥有更高的平均净分。',alternative:fast.tile,tiles:[best.tile,fast.tile]};return null;
  }
  if(kind==='temptation'){
    const alternative=bad.find(o=>gross(o.tile)>gross(best.tile));if(alternative)return {basis:'gross-vs-net',summary:'有一条路线保留了更高的自身成牌收益，但计入失分后，平均净分更低。',alternative:alternative.tile,tiles:[best.tile,alternative.tile]};
    const local=(discard:TileId)=>{const c=[...counts];c[TILES.indexOf(discard)]--;let value=0;for(let i=0;i<18;i++)for(const d of [1,2])if(i%9+d<9)value+=Math.min(c[i],c[i+d]);return value;};
    const pretty=bad.find(o=>local(o.tile)>local(best.tile));if(pretty)return {basis:'local-vs-whole',summary:'留下更多局部连接的方案，放回整手牌后有更低的平均净分。',alternative:pretty.tile,tiles:[best.tile,pretty.tile]};return null;
  }
  return null;
}
