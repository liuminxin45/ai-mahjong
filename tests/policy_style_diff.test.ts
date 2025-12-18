import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/core/model/state';
import type { Tile } from '../src/core/model/tile';
import type { AgentDecisionContext } from '../src/agents/PlayerAgent';
import { getStyleWeights } from '../src/agents/algo/style';
import { decideHigh } from '../src/agents/algo/policy_high';

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
  return { suit, rank };
}

function ctx(style: 'AGGRESSIVE' | 'DEFENSIVE'): AgentDecisionContext {
  return {
    style: {
      style,
      styleReasons: [],
      styleWeights: getStyleWeights(style),
    },
  };
}

function makeState(hand14: Tile[], discardsP1: Tile[]): GameState {
  return {
    wall: new Array(40).fill(t('W', 1)),
    hands: { P0: hand14, P1: [], P2: [], P3: [] },
    discards: { P0: [], P1: discardsP1, P2: [], P3: [] },
    melds: { P0: [], P1: [], P2: [], P3: [] },
    lastDiscard: null,
    declaredHu: { P0: false, P1: false, P2: false, P3: false },
    currentPlayer: 'P0',
    phase: 'PLAYING',
    turn: 5,
  };
}

describe('style-driven policy difference (stage5)', () => {
  it('same hand: AGGRESSIVE picks efficiency, DEFENSIVE picks safety', () => {
    const hand14: Tile[] = [
      t('B', 1),
      t('B', 2),
      t('B', 3),
      t('B', 4),
      t('B', 5),
      t('B', 6),
      t('T', 1),
      t('T', 2),
      t('T', 3),
      t('W', 7),
      t('W', 8),
      t('B', 9),
      t('B', 9),
      t('W', 5),
    ];

    const discardsP1: Tile[] = [t('B', 2), t('B', 2), t('B', 2), t('B', 2), t('B', 1), t('B', 1), t('B', 3), t('B', 3)];

    const state = makeState(hand14, discardsP1);

    const legal = [
      { type: 'DISCARD' as const, tile: t('W', 5) },
      { type: 'DISCARD' as const, tile: t('B', 2) },
    ];

    const a1 = decideHigh(state, 'P0', legal, ctx('AGGRESSIVE'));
    const a2 = decideHigh(state, 'P0', legal, ctx('DEFENSIVE'));

    expect(a1.type).toBe('DISCARD');
    expect(a2.type).toBe('DISCARD');

    expect(a1.type === 'DISCARD' ? a1.tile : null).toEqual(t('W', 5));
    expect(a2.type === 'DISCARD' ? a2.tile : null).toEqual(t('B', 2));
  });
});
