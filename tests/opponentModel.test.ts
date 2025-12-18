import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/core/model/state';
import type { Tile } from '../src/core/model/tile';
import type { GameEvent } from '../src/core/model/event';
import { createOpponentModel } from '../src/agents/algo/opponentModel';

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

describe('opponent model (stage6)', () => {
  it('persona update: meld increases aggression and meldRate', () => {
    const model = createOpponentModel();
    model.init(['P0', 'P1', 'P2', 'P3']);
    const state = baseState();

    const ev1: GameEvent = { type: 'PENG', playerId: 'P1', tile: t('W', 5), turn: 1, ts: 0 };
    model.onEvent(state, ev1);

    const ev2: GameEvent = { type: 'GANG', playerId: 'P1', tile: t('B', 3), turn: 2, ts: 0 };
    model.onEvent(state, ev2);

    const snapshot = model.getSnapshot(state, 'P0');
    const p1 = snapshot.personas.P1;

    expect(p1.aggression).toBeGreaterThan(0.5);
    expect(p1.meldRate).toBeGreaterThan(0.5);
  });

  it('threat estimation: multiple melds + late game = HIGH threat', () => {
    const model = createOpponentModel();
    model.init(['P0', 'P1', 'P2', 'P3']);
    const state = baseState();
    state.wall = new Array(10).fill(t('W', 1));
    state.melds.P2 = [
      { type: 'PENG', tile: t('W', 5), from: 'P0' },
      { type: 'PENG', tile: t('B', 3), from: 'P1' },
    ];

    const snapshot = model.getSnapshot(state, 'P0');
    const threat = snapshot.threats.P2;

    expect(threat.threatLevel).toBe('HIGH');
    expect(threat.threatScore).toBeGreaterThan(0.5);
  });

  it('threat estimation: no melds + early game = LOW threat', () => {
    const model = createOpponentModel();
    model.init(['P0', 'P1', 'P2', 'P3']);
    const state = baseState();
    state.wall = new Array(56).fill(t('W', 1));

    const snapshot = model.getSnapshot(state, 'P0');
    const threat = snapshot.threats.P1;

    expect(threat.threatLevel).toBe('LOW');
  });
});
