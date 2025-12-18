import { describe, expect, it } from 'vitest';
import { detectMistakePatterns } from '../src/analysis/mistakePatterns';
import type { DecisionStat } from '../src/analysis/statistics';

function makeStat(
  turn: number,
  dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  style: string,
  shantenBefore: number,
  shantenAfter: number,
): DecisionStat {
  return {
    turn,
    style: style as any,
    discard: 'W1',
    shantenBefore,
    shantenAfter,
    dangerLevel,
  };
}

describe('mistake patterns (stage8)', () => {
  it('detects greedy-efficiency pattern', () => {
    const decisions: DecisionStat[] = [];

    for (let i = 0; i < 10; i++) {
      decisions.push(makeStat(i + 1, 'HIGH', 'AGGRESSIVE', 2, 1));
    }

    const patterns = detectMistakePatterns(decisions);
    const greedyPattern = patterns.find((p) => p.id === 'greedy-efficiency');

    expect(greedyPattern).toBeDefined();
    expect(greedyPattern!.frequency).toBeGreaterThan(0.2);
  });

  it('detects late-game-no-defense pattern', () => {
    const decisions: DecisionStat[] = [];

    for (let i = 1; i <= 15; i++) {
      const danger = i > 10 ? 'HIGH' : 'LOW';
      decisions.push(makeStat(i, danger as any, 'BALANCED', 2, 1));
    }

    const patterns = detectMistakePatterns(decisions);
    const lateGamePattern = patterns.find((p) => p.id === 'late-game-no-defense');

    expect(lateGamePattern).toBeDefined();
  });

  it('detects style-swing pattern', () => {
    const decisions: DecisionStat[] = [];

    for (let i = 0; i < 10; i++) {
      const style = i % 2 === 0 ? 'AGGRESSIVE' : 'DEFENSIVE';
      decisions.push(makeStat(i + 1, 'MEDIUM', style, 2, 1));
    }

    const patterns = detectMistakePatterns(decisions);
    const swingPattern = patterns.find((p) => p.id === 'style-swing');

    expect(swingPattern).toBeDefined();
    expect(swingPattern!.frequency).toBeGreaterThan(0.2);
  });

  it('returns empty array for good decisions', () => {
    const decisions: DecisionStat[] = [];

    for (let i = 0; i < 10; i++) {
      decisions.push(makeStat(i + 1, 'LOW', 'BALANCED', 2, 1));
    }

    const patterns = detectMistakePatterns(decisions);
    expect(patterns.length).toBe(0);
  });
});
