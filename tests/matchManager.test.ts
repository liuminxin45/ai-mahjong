import { describe, expect, it } from 'vitest';
import { createMatchManager } from '../src/meta/matchManager';
import type { MatchStat } from '../src/analysis/statistics';

function makeStat(result: 'HU' | 'LOSE' | 'DRAW'): MatchStat {
  return {
    decisions: [
      {
        turn: 1,
        style: 'BALANCED',
        discard: 'W1',
        shantenBefore: 2,
        shantenAfter: 1,
        dangerLevel: 'LOW',
      },
    ],
    result,
  };
}

describe('match manager (stage7)', () => {
  it('tracks multiple rounds and finishes when totalRounds reached', () => {
    const manager = createMatchManager({ totalRounds: 3 });
    manager.start();

    expect(manager.isFinished()).toBe(false);

    manager.onRoundEnd(makeStat('HU'));
    expect(manager.isFinished()).toBe(false);

    manager.onRoundEnd(makeStat('LOSE'));
    expect(manager.isFinished()).toBe(false);

    manager.onRoundEnd(makeStat('DRAW'));
    expect(manager.isFinished()).toBe(true);
  });

  it('computes correct win/lose/draw rates', () => {
    const manager = createMatchManager({ totalRounds: 5 });
    manager.start();

    manager.onRoundEnd(makeStat('HU'));
    manager.onRoundEnd(makeStat('HU'));
    manager.onRoundEnd(makeStat('LOSE'));
    manager.onRoundEnd(makeStat('DRAW'));
    manager.onRoundEnd(makeStat('DRAW'));

    const result = manager.getResult();
    expect(result.summary.winRate).toBeCloseTo(0.4);
    expect(result.summary.loseRate).toBeCloseTo(0.2);
    expect(result.summary.drawRate).toBeCloseTo(0.4);
  });

  it('computes style distribution correctly', () => {
    const manager = createMatchManager({ totalRounds: 2 });
    manager.start();

    const stat1: MatchStat = {
      decisions: [
        { turn: 1, style: 'AGGRESSIVE', discard: 'W1', shantenBefore: 2, shantenAfter: 1, dangerLevel: 'HIGH' },
        { turn: 2, style: 'AGGRESSIVE', discard: 'W2', shantenBefore: 1, shantenAfter: 0, dangerLevel: 'HIGH' },
      ],
      result: 'HU',
    };

    const stat2: MatchStat = {
      decisions: [
        { turn: 1, style: 'DEFENSIVE', discard: 'W3', shantenBefore: 2, shantenAfter: 2, dangerLevel: 'LOW' },
      ],
      result: 'DRAW',
    };

    manager.onRoundEnd(stat1);
    manager.onRoundEnd(stat2);

    const result = manager.getResult();
    expect(result.summary.styleDistribution.AGGRESSIVE).toBe(2);
    expect(result.summary.styleDistribution.DEFENSIVE).toBe(1);
  });

  it('identifies biggest threat opponent', () => {
    const manager = createMatchManager({ totalRounds: 2 });
    manager.start();

    const stat1: MatchStat = {
      decisions: [
        {
          turn: 1,
          style: 'BALANCED',
          discard: 'W1',
          shantenBefore: 2,
          shantenAfter: 1,
          dangerLevel: 'MEDIUM',
          topThreat: { playerId: 'P1', threatLevel: 'HIGH' },
        },
        {
          turn: 2,
          style: 'BALANCED',
          discard: 'W2',
          shantenBefore: 1,
          shantenAfter: 0,
          dangerLevel: 'LOW',
          topThreat: { playerId: 'P1', threatLevel: 'HIGH' },
        },
      ],
      result: 'HU',
    };

    const stat2: MatchStat = {
      decisions: [
        {
          turn: 1,
          style: 'DEFENSIVE',
          discard: 'W3',
          shantenBefore: 2,
          shantenAfter: 2,
          dangerLevel: 'LOW',
          topThreat: { playerId: 'P2', threatLevel: 'MEDIUM' },
        },
      ],
      result: 'DRAW',
    };

    manager.onRoundEnd(stat1);
    manager.onRoundEnd(stat2);

    const result = manager.getResult();
    expect(result.summary.biggestThreatOpponent).toBe('P1');
    expect(result.summary.threatOpponentCount.P1).toBe(2);
    expect(result.summary.threatOpponentCount.P2).toBe(1);
  });
});
