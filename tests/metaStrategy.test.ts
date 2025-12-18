import { describe, expect, it } from 'vitest';
import { createMetaStrategy } from '../src/meta/metaStrategy';
import type { MatchStat } from '../src/analysis/statistics';

function makeStat(result: 'HU' | 'LOSE' | 'DRAW', highRiskRatio: number): MatchStat {
  const decisions = [];
  const totalDecisions = 10;
  const highRiskCount = Math.floor(totalDecisions * highRiskRatio);

  for (let i = 0; i < totalDecisions; i++) {
    decisions.push({
      turn: i + 1,
      style: 'BALANCED' as const,
      discard: 'W1',
      shantenBefore: 2,
      shantenAfter: i < 5 ? 2 : 1,
      dangerLevel: (i < highRiskCount ? 'HIGH' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
    });
  }

  return { decisions, result };
}

describe('meta strategy (stage7)', () => {
  it('detects over-aggression and increases dangerWeight', () => {
    const meta = createMetaStrategy();
    const initialParams = meta.getParams();

    for (let i = 0; i < 5; i++) {
      meta.onRoundEnd(makeStat('LOSE', 0.6));
    }

    const newParams = meta.getParams();
    expect(newParams.dangerWeight).toBeGreaterThan(initialParams.dangerWeight);
  });

  it('detects over-defensive play and increases efficiencyWeight', () => {
    const meta = createMetaStrategy();
    const initialParams = meta.getParams();

    const drawStats: MatchStat[] = [];
    for (let i = 0; i < 5; i++) {
      const decisions = [];
      for (let j = 0; j < 10; j++) {
        decisions.push({
          turn: j + 1,
          style: 'DEFENSIVE' as const,
          discard: 'W1',
          shantenBefore: 2,
          shantenAfter: 2,
          dangerLevel: 'LOW' as const,
        });
      }
      drawStats.push({ decisions, result: 'DRAW' });
    }

    for (const stat of drawStats) {
      meta.onRoundEnd(stat);
    }

    const newParams = meta.getParams();
    expect(newParams.efficiencyWeight).toBeGreaterThan(initialParams.efficiencyWeight);
  });

  it('detects repeated high threat opponent and increases threatWeight', () => {
    const meta = createMetaStrategy();
    const initialParams = meta.getParams();

    const threatStats: MatchStat[] = [];
    for (let i = 0; i < 5; i++) {
      const decisions = [];
      for (let j = 0; j < 10; j++) {
        decisions.push({
          turn: j + 1,
          style: 'BALANCED' as const,
          discard: 'W1',
          shantenBefore: 2,
          shantenAfter: 1,
          dangerLevel: 'MEDIUM' as const,
          topThreat: {
            playerId: 'P1' as const,
            threatLevel: 'HIGH' as const,
          },
        });
      }
      threatStats.push({ decisions, result: 'LOSE' });
    }

    for (const stat of threatStats) {
      meta.onRoundEnd(stat);
    }

    const newParams = meta.getParams();
    expect(newParams.threatWeight).toBeGreaterThan(initialParams.threatWeight);
  });

  it('params stay within bounds (0.1 to 3.0)', () => {
    const meta = createMetaStrategy();

    for (let i = 0; i < 20; i++) {
      meta.onRoundEnd(makeStat('LOSE', 0.8));
    }

    const params = meta.getParams();
    expect(params.dangerWeight).toBeGreaterThanOrEqual(0.1);
    expect(params.dangerWeight).toBeLessThanOrEqual(3.0);
    expect(params.efficiencyWeight).toBeGreaterThanOrEqual(0.1);
    expect(params.efficiencyWeight).toBeLessThanOrEqual(3.0);
    expect(params.threatWeight).toBeGreaterThanOrEqual(0.1);
    expect(params.threatWeight).toBeLessThanOrEqual(3.0);
  });

  it('adjustment history is recorded with reasons', () => {
    const meta = createMetaStrategy();

    for (let i = 0; i < 5; i++) {
      meta.onRoundEnd(makeStat('LOSE', 0.6));
    }

    const history = meta.getAdjustmentHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].reason).toContain('过度进攻');
    expect(history[0].param).toBe('dangerWeight');
    expect(history[0].delta).toBeGreaterThan(0);
  });
});
