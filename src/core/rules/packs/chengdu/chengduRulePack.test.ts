import { describe, expect, it } from 'vitest';
import { chengduRulePack } from './index';

describe('chengduRulePack skeleton', () => {
  it('reuses placeholder behavior (init/draw/discard/rotate)', () => {
    const s0 = chengduRulePack.buildInitialState();
    expect(s0.phase).toBe('PLAYING');
    expect(s0.currentPlayer).toBe('P0');

    const s1 = chengduRulePack.applyAction(s0, { type: 'DRAW' });
    expect(s1.hands.P0.length).toBe(14);

    const discard = chengduRulePack.getLegalActions(s1, 'P0').find((a) => a.type === 'DISCARD');
    expect(discard).toBeTruthy();
    const s2 = chengduRulePack.applyAction(s1, discard!);
    expect(s2.turn).toBe(1);

    const resolved = chengduRulePack.resolveReactions(s2, []);
    expect(resolved.state.currentPlayer).toBe('P1');
  });
});
