import { parseHand } from './engine/index.js';
import type { Exercise } from './learning/index.js';

// Teaching examples are separate from the versioned practice and competition papers.
export const GUIDE_HANDS={
  discard:['123p','456p','789p','12s','45s','9s'],
  waiting:['123p','456p','789p','22p','56s'],
  sevenPairs:['1111p','22p','33p','44p','55p','67s'],
};
export const guideHand=(groups:string[])=>groups.flatMap(parseHand);

export function practicePrompt(q:Pick<Exercise,'ref'|'prompt'>){
  if(q.ref.mode==='ukeire'&&['选出全部仍有余量、能降低综合向听的牌种。','选出所有仍有剩余张数、能降低综合向听的进张。'].includes(q.prompt))return '多选：找出摸到后能让手牌更接近胡牌（向听变小）、而且还没四张全见的全部牌种。';
  if(q.ref.mode==='waits'&&q.prompt==='选出全部形状听口，包括已经见尽但结构可和的牌种。')return '多选：找出添上一张就能胡牌的全部牌种；已经四张全见、但牌形能胡的也要选。';
  return q.prompt;
}
