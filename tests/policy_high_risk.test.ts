import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/core/model/state';
import type { Tile } from '../src/core/model/tile';
import { decideHigh } from '../src/agents/algo/policy_high';

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
  return { suit, rank };
}

function makeState(params: { wallN: number; discards: Tile[]; hand: Tile[] }): GameState {
  return {
    wall: new Array(params.wallN).fill(t('W', 1)),
    hands: {
      P0: params.hand,
      P1: [],
      P2: [],
      P3: [],
    },
    discards: {
      P0: [],
      P1: params.discards,
      P2: [],
      P3: [],
    },
    melds: {
      P0: [],
      P1: [],
      P2: [],
      P3: [],
    },
    lastDiscard: null,
    declaredHu: { P0: false, P1: false, P2: false, P3: false },
    currentPlayer: 'P0',
    phase: 'PLAYING',
    turn: 10,
  };
}

describe('policy_high danger tradeoff (pseudo)', () => {
  it('High should avoid HIGH danger when efficiency gap is small', () => {
    // Construct a 14-tile hand where two discards have similar efficiency.
    // We bias danger by making W5 unseen (high danger) while B9 is very seen (low danger).
    const hand: Tile[] = [
      t('W', 1),
      t('W', 2),
      t('W', 3),
      t('W', 4),
      t('W', 5), // candidate A (danger high)
      t('W', 6),
      t('B', 1),
      t('B', 2),
      t('B', 3),
      t('B', 7),
      t('B', 8),
      t('B', 9), // candidate B (danger low)
      t('T', 1),
      t('T', 1),
    ];

    const discards: Tile[] = [t('B', 9), t('B', 9), t('B', 9), t('B', 9), t('B', 8), t('B', 8), t('B', 7)];

    const state = makeState({ wallN: 12, discards, hand });

    // Restrict legal discards to two options to make the test deterministic.
    const legal = [
      { type: 'DISCARD' as const, tile: t('W', 5) },
      { type: 'DISCARD' as const, tile: t('B', 9) },
    ];

    const act = decideHigh(state, 'P0', legal);
    expect(act.type).toBe('DISCARD');
    expect(act.type === 'DISCARD' ? act.tile : null).toEqual(t('B', 9));
  });
});
