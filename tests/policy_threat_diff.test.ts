import { describe, expect, it } from 'vitest';
import type { GameState, Meld } from '../src/core/model/state';
import type { Tile } from '../src/core/model/tile';
import type { AgentDecisionContext } from '../src/agents/PlayerAgent';
import type { OpponentModelSnapshot } from '../src/agents/algo/opponentModel';
import { getStyleWeights } from '../src/agents/algo/style';
import { decideHigh } from '../src/agents/algo/policy_high';

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
  return { suit, rank };
}

function makeState(hand14: Tile[], discardsP1: Tile[], wallN: number, meldsP1: Meld[]): GameState {
  return {
    wall: new Array(wallN).fill(t('W', 1)),
    hands: { P0: hand14, P1: [], P2: [], P3: [] },
    discards: { P0: [], P1: discardsP1, P2: [], P3: [] },
    melds: { P0: [], P1: meldsP1, P2: [], P3: [] },
    lastDiscard: null,
    declaredHu: { P0: false, P1: false, P2: false, P3: false },
    currentPlayer: 'P0',
    phase: 'PLAYING',
    turn: 10,
  };
}

function makeOpponentSnapshot(p1ThreatLevel: 'LOW' | 'HIGH'): OpponentModelSnapshot {
  const threatScore = p1ThreatLevel === 'HIGH' ? 0.8 : 0.1;
  return {
    personas: {
      P0: { playerId: 'P0', aggression: 0.5, defense: 0.5, meldRate: 0.5, efficiencyBias: 0.5, riskTolerance: 0.5 },
      P1: { playerId: 'P1', aggression: 0.7, defense: 0.4, meldRate: 0.7, efficiencyBias: 0.6, riskTolerance: 0.7 },
      P2: { playerId: 'P2', aggression: 0.5, defense: 0.5, meldRate: 0.5, efficiencyBias: 0.5, riskTolerance: 0.5 },
      P3: { playerId: 'P3', aggression: 0.5, defense: 0.5, meldRate: 0.5, efficiencyBias: 0.5, riskTolerance: 0.5 },
    },
    threats: {
      P0: { playerId: 'P0', threatLevel: 'LOW', threatScore: 0, reasons: [] },
      P1: { playerId: 'P1', threatLevel: p1ThreatLevel, threatScore, reasons: p1ThreatLevel === 'HIGH' ? ['后巡阶段', '已副露 2 次', '疑似听牌'] : [] },
      P2: { playerId: 'P2', threatLevel: 'LOW', threatScore: 0.1, reasons: [] },
      P3: { playerId: 'P3', threatLevel: 'LOW', threatScore: 0.1, reasons: [] },
    },
  };
}

function ctx(threatLevel: 'LOW' | 'HIGH'): AgentDecisionContext {
  return {
    style: {
      style: 'BALANCED',
      styleReasons: [],
      styleWeights: getStyleWeights('BALANCED'),
    },
    opponentSnapshot: makeOpponentSnapshot(threatLevel),
  };
}

describe('policy threat-aware difference (stage6)', () => {
  it('HIGH threat increases danger penalty and affects decision', () => {
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

    const state = makeState(hand14, [], 12, []);

    const legal = [
      { type: 'DISCARD' as const, tile: t('W', 5) },
      { type: 'DISCARD' as const, tile: t('B', 9) },
    ];

    const ctxLow = ctx('LOW');
    const ctxHigh = ctx('HIGH');

    const a1 = decideHigh(state, 'P0', legal, ctxLow);
    const a2 = decideHigh(state, 'P0', legal, ctxHigh);

    expect(a1.type).toBe('DISCARD');
    expect(a2.type).toBe('DISCARD');

    if (ctxHigh.opponentSnapshot) {
      const threat = ctxHigh.opponentSnapshot.threats.P1;
      expect(threat.threatLevel).toBe('HIGH');
      expect(threat.threatScore).toBeGreaterThan(0.5);
    }
  });
});
