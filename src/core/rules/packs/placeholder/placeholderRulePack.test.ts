import { describe, expect, it } from 'vitest';
import { placeholderRulePack } from './index';

describe('placeholderRulePack', () => {
  it('initializes with 13 tiles per player', () => {
    const s = placeholderRulePack.buildInitialState();
    expect(s.hands.P0.length).toBe(13);
    expect(s.hands.P1.length).toBe(13);
    expect(s.hands.P2.length).toBe(13);
    expect(s.hands.P3.length).toBe(13);
    expect(s.currentPlayer).toBe('P0');
    expect(s.phase).toBe('PLAYING');
    expect(s.turn).toBe(0);
  });

  it('DRAW makes 14 tiles', () => {
    const s0 = placeholderRulePack.buildInitialState();
    const s1 = placeholderRulePack.applyAction(s0, { type: 'DRAW' });
    expect(s1.hands.P0.length).toBe(14);
    expect(s1.wall.length).toBe(s0.wall.length - 1);
  });

  it('DISCARD makes 13 tiles and rotates player', () => {
    const s0 = placeholderRulePack.buildInitialState();
    const s1 = placeholderRulePack.applyAction(s0, { type: 'DRAW' });
    const legal = placeholderRulePack.getLegalActions(s1, 'P0');
    const discard = legal.find((a) => a.type === 'DISCARD');
    expect(discard).toBeTruthy();

    const s2 = placeholderRulePack.applyAction(s1, discard!);
    expect(s2.hands.P0.length).toBe(13);
    expect(s2.discards.P0.length).toBe(1);
    expect(s2.turn).toBe(s1.turn + 1);

    const resolved = placeholderRulePack.resolveReactions(s2, []);
    expect(resolved.state.currentPlayer).toBe('P1');
  });

  it('applyAction is pure (does not mutate input)', () => {
    const s0 = placeholderRulePack.buildInitialState();
    Object.freeze(s0);
    Object.freeze(s0.wall);
    Object.freeze(s0.hands);
    Object.freeze(s0.discards);
    Object.freeze(s0.hands.P0);
    Object.freeze(s0.hands.P1);
    Object.freeze(s0.hands.P2);
    Object.freeze(s0.hands.P3);
    Object.freeze(s0.discards.P0);
    Object.freeze(s0.discards.P1);
    Object.freeze(s0.discards.P2);
    Object.freeze(s0.discards.P3);

    const s1 = placeholderRulePack.applyAction(s0, { type: 'DRAW' });
    expect(s1).not.toBe(s0);
    expect(s0.hands.P0.length).toBe(13);
  });
});
