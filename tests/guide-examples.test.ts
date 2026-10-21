import { describe, expect, it } from 'vitest';
import { analyze, countsOf, parseHand, sevenPairsShanten, validateContext } from '../src/engine/index.js';
import { answers, exercise } from '../src/learning/index.js';
import { GUIDE_HANDS, guideHand, practicePrompt } from '../src/guide-examples.js';

describe('beginner guide examples use the actual two-suit rules',()=>{
  it('uses physically valid full hands for every tile example',()=>{
    for(const groups of Object.values(GUIDE_HANDS))expect(()=>validateContext({hand:guideHand(groups)})).not.toThrow();
  });
  it('distinguishes drawable improvements from shape waits after four tiles are visible',()=>{
    const hand=guideHand(GUIDE_HANDS.waiting),base=analyze({hand});
    expect(base.shanten).toBe(0);expect(base.improvements).toEqual([{tile:'4s',remaining:4},{tile:'7s',remaining:4}]);
    expect(analyze({hand,visible:{'4s':3}}).improvements.reduce((n,t)=>n+t.remaining,0)).toBe(5);
    const exhausted=analyze({hand,visible:{'4s':4}});
    expect(exhausted.improvements).toEqual([{tile:'7s',remaining:4}]);
    expect(exhausted.waits).toEqual([{tile:'4s',remaining:0},{tile:'7s',remaining:4}]);
    for(const tile of ['4s','7s'] as const)expect(analyze({hand:[...hand,tile]}).shanten).toBe(-1);
  });
  it('prefers the isolated nine and preserves complete sequences',()=>{
    const result=analyze({hand:guideHand(GUIDE_HANDS.discard)});
    expect(result.discards.filter(d=>d.best).map(d=>d.tile)).toEqual(['9s']);
    expect(result.discards.find(d=>d.tile==='9s')?.shanten).toBe(1);
    expect(result.discards.filter(d=>d.tile.endsWith('p')).every(d=>d.shanten===2)).toBe(true);
  });
  it('counts four equal tiles as two pairs and accepts both tied singletons',()=>{
    const hand=guideHand(GUIDE_HANDS.sevenPairs),q={...exercise({mode:'seven-pairs',seed:0}),context:{hand}};
    expect(countsOf(hand).reduce((n,c)=>n+Math.floor(c/2),0)).toBe(6);
    expect(answers(q)).toEqual(['6s','7s']);
    const after=hand.filter(t=>t!=='6s');expect(sevenPairsShanten(countsOf(after))).toBe(0);
    expect(sevenPairsShanten(countsOf([...after,...parseHand('7s')]))).toBe(-1);
  });
  it('simplifies basic prompts while preserving special objectives and archived source data',()=>{
    const basic={ref:{mode:'ukeire' as const,seed:0},prompt:'选出全部仍有余量、能降低综合向听的牌种。'};
    expect(practicePrompt(basic)).toContain('摸到后');expect(basic.prompt).toContain('综合向听');
    const deep={...basic,prompt:'选出首摸后、允许后续最优摸打时，窗口内成牌机会最高的全部牌种。'};
    expect(practicePrompt(deep)).toBe(deep.prompt);
    expect(practicePrompt({ref:{mode:'waits',seed:0},prompt:'选出全部形状听口，包括已经见尽但结构可和的牌种。'})).toContain('已经四张全见');
    expect(practicePrompt(exercise({mode:'defense',seed:0}))).toBe(exercise({mode:'defense',seed:0}).prompt);
  });
});
