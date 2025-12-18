import { describe, expect, it } from 'vitest';
import type { GameState, Meld } from '../src/core/model/state';
import type { Tile } from '../src/core/model/tile';
import { detectGameStyle } from '../src/agents/algo/style';

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
  return { suit, rank };
}

function baseState(): GameState {
  return {
    wall: new Array(56).fill(t('W', 1)),
    hands: { P0: [], P1: [], P2: [], P3: [] },
    discards: { P0: [], P1: [], P2: [], P3: [] },
    melds: { P0: [], P1: [], P2: [], P3: [] },
    lastDiscard: null,
    declaredHu: { P0: false, P1: false, P2: false, P3: false },
    currentPlayer: 'P0',
    phase: 'PLAYING',
    turn: 0,
  };
}

describe('style detection (stage5)', () => {
  it('AGGRESSIVE: low shanten + high ukeire', () => {
    const s = baseState();

    s.discards.P1 = [t('W', 1), t('W', 1), t('W', 1), t('W', 1)];

    s.hands.P0 = [
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

    const r = detectGameStyle(s, 'P0');
    expect(r.style).toBe('AGGRESSIVE');
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('DEFENSIVE: late game or opponent hu', () => {
    const s = baseState();
    s.wall = new Array(10).fill(t('W', 1));
    s.declaredHu.P1 = true;
    s.hands.P0 = [
      t('W', 1),
      t('W', 4),
      t('W', 7),
      t('B', 1),
      t('B', 4),
      t('B', 7),
      t('T', 1),
      t('T', 4),
      t('T', 7),
      t('W', 2),
      t('B', 2),
      t('T', 2),
      t('W', 9),
    ];

    const r = detectGameStyle(s, 'P0');
    expect(r.style).toBe('DEFENSIVE');
  });

  it('STALLING: high shanten + threats + many safe tiles', () => {
    const s = baseState();

    s.wall = new Array(26).fill(t('W', 1));

    const meld: Meld = { type: 'PENG', tile: t('W', 1), from: 'P0' };
    s.melds.P1 = [meld];
    s.melds.P2 = [meld];

    s.discards.P1 = [
      t('B', 9),
      t('B', 9),
      t('B', 9),
      t('B', 9),
      t('B', 8),
      t('B', 8),
      t('B', 7),
      t('W', 1),
      t('W', 1),
      t('W', 1),
      t('W', 1),
      t('T', 1),
      t('T', 1),
      t('T', 1),
      t('T', 1),
    ];

    s.hands.P0 = [
      t('B', 9),
      t('B', 9),
      t('B', 9),
      t('W', 1),
      t('W', 4),
      t('W', 7),
      t('B', 2),
      t('B', 5),
      t('T', 1),
      t('T', 4),
      t('T', 7),
      t('W', 2),
      t('W', 9),
    ];

    const r = detectGameStyle(s, 'P0');
    expect(r.style).toBe('STALLING');
  });
});
