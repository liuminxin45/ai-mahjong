import { describe, expect, it } from 'vitest';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import type { Tile } from '../src/core/model/tile';
import type { GameState } from '../src/core/model/state';
import { shantenWithMelds } from '../src/agents/algo/shanten';

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
  return { suit, rank };
}

describe('stage3 (melds + response window)', () => {
  it('PENG should add meld and remove 2 tiles from hand', () => {
    const tile = t('W', 5);

    const s: GameState = {
      wall: [],
      hands: {
        P0: new Array(13).fill(t('W', 1)),
        P1: [tile, tile].concat(new Array(11).fill(t('B', 1))),
        P2: new Array(13).fill(t('B', 2)),
        P3: new Array(13).fill(t('T', 3)),
      },
      discards: { P0: [tile], P1: [], P2: [], P3: [] },
      melds: { P0: [], P1: [], P2: [], P3: [] },
      lastDiscard: { tile, from: 'P0' },
      declaredHu: { P0: false, P1: false, P2: false, P3: false },
      currentPlayer: 'P0',
      phase: 'PLAYING',
      turn: 1,
    };

    const resolved = chengduRulePack.resolveReactions(s, [
      { playerId: 'P1', action: { type: 'PENG', tile, from: 'P0' } },
    ]);

    expect(resolved.state.melds.P1.length).toBe(1);
    expect(resolved.state.hands.P1.length).toBe(11);
    expect(resolved.state.lastDiscard).toBeNull();
    expect(resolved.state.currentPlayer).toBe('P1');
    expect(resolved.events.some((e) => e.type === 'PENG')).toBe(true);
  });

  it('shantenWithMelds should drop by 2 when meldCount increases by 1 (simple case)', () => {
    const s0 = shantenWithMelds([], 0);
    const s1 = shantenWithMelds([], 1);
    expect(s1).toBe(s0 - 2);
  });

  it('resolve priority: multi-HU wins over PENG, and all HU are recorded', () => {
    const tile = t('B', 7);

    const baseWin14: Tile[] = [
      t('W', 1),
      t('W', 2),
      t('W', 3),
      t('B', 1),
      t('B', 2),
      t('B', 3),
      t('B', 4),
      t('B', 5),
      t('B', 6),
      t('W', 4),
      t('W', 5),
      t('W', 6),
      t('B', 7),
      t('B', 7),
    ];

    const p1Hand13 = baseWin14.slice(0, 13);
    const p2Hand13 = baseWin14.slice(0, 13);

    const s: GameState = {
      wall: [t('W', 1)],
      hands: {
        P0: new Array(13).fill(t('W', 9)),
        P1: p1Hand13,
        P2: p2Hand13,
        P3: [tile, tile].concat(new Array(11).fill(t('T', 9))),
      },
      discards: { P0: [tile], P1: [], P2: [], P3: [] },
      melds: { P0: [], P1: [], P2: [], P3: [] },
      lastDiscard: { tile, from: 'P0' },
      declaredHu: { P0: false, P1: false, P2: false, P3: false },
      currentPlayer: 'P0',
      phase: 'PLAYING',
      turn: 1,
    };

    const resolved = chengduRulePack.resolveReactions(s, [
      { playerId: 'P1', action: { type: 'HU', tile, from: 'P0' } },
      { playerId: 'P2', action: { type: 'HU', tile, from: 'P0' } },
      { playerId: 'P3', action: { type: 'PENG', tile, from: 'P0' } },
    ]);

    expect(resolved.state.declaredHu.P1).toBe(true);
    expect(resolved.state.declaredHu.P2).toBe(true);
    expect(resolved.state.melds.P3.length).toBe(0);
    expect(resolved.state.currentPlayer).toBe('P3');

    const huEvents = resolved.events.filter((e) => e.type === 'HU');
    expect(huEvents.length).toBe(2);
    expect(resolved.events.some((e) => e.type === 'PENG')).toBe(false);
  });

  it('resolve priority: HU beats PENG when both exist', () => {
    const tile = t('B', 7);

    const baseWin14: Tile[] = [
      t('W', 1),
      t('W', 2),
      t('W', 3),
      t('B', 1),
      t('B', 2),
      t('B', 3),
      t('B', 4),
      t('B', 5),
      t('B', 6),
      t('W', 4),
      t('W', 5),
      t('W', 6),
      t('B', 7),
      t('B', 7),
    ];

    const s: GameState = {
      wall: [t('W', 1)],
      hands: {
        P0: new Array(13).fill(t('W', 9)),
        P1: baseWin14.slice(0, 13),
        P2: new Array(13).fill(t('T', 8)),
        P3: [tile, tile].concat(new Array(11).fill(t('T', 9))),
      },
      discards: { P0: [tile], P1: [], P2: [], P3: [] },
      melds: { P0: [], P1: [], P2: [], P3: [] },
      lastDiscard: { tile, from: 'P0' },
      declaredHu: { P0: false, P1: false, P2: false, P3: false },
      currentPlayer: 'P0',
      phase: 'PLAYING',
      turn: 1,
    };

    const resolved = chengduRulePack.resolveReactions(s, [
      { playerId: 'P1', action: { type: 'HU', tile, from: 'P0' } },
      { playerId: 'P3', action: { type: 'PENG', tile, from: 'P0' } },
    ]);

    expect(resolved.state.declaredHu.P1).toBe(true);
    expect(resolved.state.melds.P3.length).toBe(0);
    expect(resolved.state.currentPlayer).toBe('P2');
    expect(resolved.events.some((e) => e.type === 'HU')).toBe(true);
    expect(resolved.events.some((e) => e.type === 'PENG')).toBe(false);
  });
});
