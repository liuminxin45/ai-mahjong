import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/core/model/state';
import type { Tile } from '../src/core/model/tile';
import { evaluateTileDanger } from '../src/agents/algo/danger';

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
  return { suit, rank };
}

function baseState(): GameState {
  return {
    wall: new Array(56).fill(t('W', 1)),
    hands: {
      P0: [],
      P1: [],
      P2: [],
      P3: [],
    },
    discards: {
      P0: [],
      P1: [],
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
    turn: 0,
  };
}

describe('danger model', () => {
  it('unseen tile should be more dangerous than seen tile', () => {
    const s = baseState();
    const unseen = evaluateTileDanger(s, 'P0', t('W', 5));

    const s2: GameState = {
      ...s,
      discards: { ...s.discards, P1: [t('W', 5), t('W', 5)] },
    };
    const seen = evaluateTileDanger(s2, 'P0', t('W', 5));

    expect(unseen.score).toBeGreaterThan(seen.score);
  });

  it('late game should be more dangerous than early game (same tile / same discards)', () => {
    const sEarly = baseState();
    const sLate: GameState = { ...sEarly, wall: new Array(6).fill(t('W', 1)) };

    const early = evaluateTileDanger(sEarly, 'P0', t('B', 7));
    const late = evaluateTileDanger(sLate, 'P0', t('B', 7));

    expect(late.score).toBeGreaterThan(early.score);
  });
});
