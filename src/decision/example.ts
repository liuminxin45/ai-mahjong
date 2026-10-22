import { countsOf, sorted, type TileId } from '../engine/index.js';
import { scoreCounts, type WinScore } from './score.js';
import type { DecisionQuestion } from './questions.js';
export type FinishExample = { draws: TileId[]; discarded: TileId[]; hand: TileId[]; value: WinScore };
/** Offline teaching witness along a certified first continuation, never a replacement for the full expectation. */
export function finishExample(q: Pick<DecisionQuestion,'context'|'model'|'certificate'>): FinishExample | undefined {
  const initial=[...q.context.hand],first=q.certificate.recommended;initial.splice(initial.indexOf(first),1);
  for(const branch of q.certificate.branches){
    const hand=sorted([...initial,branch.draw]),value=scoreCounts(countsOf(hand),q.context.fixedSets);
    if(value)return {draws:[branch.draw],discarded:[first],hand,value};
    if(q.model.horizon<2)continue;
    const bag=[...q.model.bag];bag.splice(bag.indexOf(branch.draw),1);
    for(const discard of branch.next){const after=[...hand];after.splice(after.indexOf(discard),1);for(const next of new Set(bag)){const final=sorted([...after,next]),score=scoreCounts(countsOf(final),q.context.fixedSets);if(score)return {draws:[branch.draw,next],discarded:[first,discard],hand:final,value:score};}}
  }
}
