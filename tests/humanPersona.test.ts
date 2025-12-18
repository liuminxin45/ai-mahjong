import { describe, expect, it } from 'vitest';
import { createHumanPersona } from '../src/analysis/humanPersona';
import type { DecisionStat } from '../src/analysis/statistics';

function makeStat(dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH', style: string, shantenBefore: number, shantenAfter: number): DecisionStat {
  return {
    turn: 1,
    style: style as any,
    discard: 'W1',
    shantenBefore,
    shantenAfter,
    dangerLevel,
  };
}

describe('human persona (stage8)', () => {
  it('increases riskTolerance with high-risk decisions', () => {
    const persona = createHumanPersona();
    const initial = persona.getSnapshot();

    for (let i = 0; i < 10; i++) {
      persona.onDecision(makeStat('HIGH', 'AGGRESSIVE', 2, 1));
    }

    const updated = persona.getSnapshot();
    expect(updated.riskTolerance).toBeGreaterThan(initial.riskTolerance);
  });

  it('increases defenseAwareness with defensive low-risk choices', () => {
    const persona = createHumanPersona();
    const initial = persona.getSnapshot();

    for (let i = 0; i < 10; i++) {
      persona.onDecision(makeStat('LOW', 'DEFENSIVE', 2, 2));
    }

    const updated = persona.getSnapshot();
    expect(updated.defenseAwareness).toBeGreaterThan(initial.defenseAwareness);
  });

  it('identifies AGGRESSIVE play style', () => {
    const persona = createHumanPersona();

    for (let i = 0; i < 15; i++) {
      persona.onDecision(makeStat('HIGH', 'AGGRESSIVE', 2, 1));
    }

    const snapshot = persona.getSnapshot();
    expect(snapshot.playStyle).toBe('AGGRESSIVE');
  });

  it('identifies DEFENSIVE play style', () => {
    const persona = createHumanPersona();

    for (let i = 0; i < 15; i++) {
      persona.onDecision(makeStat('LOW', 'DEFENSIVE', 2, 2));
    }

    const snapshot = persona.getSnapshot();
    expect(snapshot.playStyle).toBe('DEFENSIVE');
  });

  it('identifies learning stage based on risk and defense patterns', () => {
    const persona = createHumanPersona();

    for (let i = 0; i < 30; i++) {
      persona.onDecision(makeStat('HIGH', 'AGGRESSIVE', 2, 1));
    }

    const snapshot = persona.getSnapshot();
    expect(snapshot.riskTolerance).toBeGreaterThan(0.7);
    expect(['BEGINNER', 'INTERMEDIATE']).toContain(snapshot.learningStage);
  });

  it('identifies ADVANCED learning stage with balanced decisions', () => {
    const persona = createHumanPersona();

    for (let i = 0; i < 10; i++) {
      persona.onDecision(makeStat('LOW', 'DEFENSIVE', 2, 2));
    }
    for (let i = 0; i < 10; i++) {
      persona.onDecision(makeStat('MEDIUM', 'BALANCED', 2, 1));
    }

    const snapshot = persona.getSnapshot();
    expect(snapshot.learningStage).toBe('ADVANCED');
  });
});
