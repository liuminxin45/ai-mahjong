import { describe, expect, it } from 'vitest';
import { buildTeachingPlan } from '../src/analysis/pedagogy';
import type { HumanPersona } from '../src/analysis/humanPersona';
import type { MistakePattern } from '../src/analysis/mistakePatterns';

function makePersona(
  playStyle: 'AGGRESSIVE' | 'BALANCED' | 'DEFENSIVE' | 'ERRATIC',
  learningStage: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
): HumanPersona {
  return {
    playStyle,
    riskTolerance: 0.5,
    efficiencyBias: 0.5,
    defenseAwareness: 0.5,
    learningStage,
  };
}

function makeMistake(id: string, frequency: number): MistakePattern {
  return {
    id,
    description: `Test mistake: ${id}`,
    frequency,
    exampleTurns: [1, 2, 3],
  };
}

describe('pedagogy (stage8)', () => {
  it('BEGINNER gets ENCOURAGING tone', () => {
    const persona = makePersona('BALANCED', 'BEGINNER');
    const mistakes: MistakePattern[] = [];

    const plan = buildTeachingPlan(persona, mistakes);

    expect(plan.tone).toBe('ENCOURAGING');
    expect(plan.avoidOverload).toBe(true);
  });

  it('INTERMEDIATE gets CAUTIOUS tone', () => {
    const persona = makePersona('BALANCED', 'INTERMEDIATE');
    const mistakes: MistakePattern[] = [];

    const plan = buildTeachingPlan(persona, mistakes);

    expect(plan.tone).toBe('CAUTIOUS');
    expect(plan.avoidOverload).toBe(false);
  });

  it('ADVANCED gets CHALLENGING tone', () => {
    const persona = makePersona('BALANCED', 'ADVANCED');
    const mistakes: MistakePattern[] = [];

    const plan = buildTeachingPlan(persona, mistakes);

    expect(plan.tone).toBe('CHALLENGING');
    expect(plan.avoidOverload).toBe(false);
  });

  it('BEGINNER gets limited focus points', () => {
    const persona = makePersona('BALANCED', 'BEGINNER');
    const mistakes: MistakePattern[] = [
      makeMistake('greedy-efficiency', 0.5),
      makeMistake('late-game-no-defense', 0.4),
      makeMistake('style-swing', 0.3),
    ];

    const plan = buildTeachingPlan(persona, mistakes);

    expect(plan.focusPoints.length).toBeLessThanOrEqual(2);
  });

  it('ADVANCED can get more focus points', () => {
    const persona = makePersona('BALANCED', 'ADVANCED');
    const mistakes: MistakePattern[] = [
      makeMistake('greedy-efficiency', 0.5),
      makeMistake('late-game-no-defense', 0.4),
      makeMistake('style-swing', 0.3),
      makeMistake('early-meld', 0.2),
    ];

    const plan = buildTeachingPlan(persona, mistakes);

    expect(plan.focusPoints.length).toBeGreaterThan(2);
  });

  it('prioritizes high-frequency mistakes', () => {
    const persona = makePersona('BALANCED', 'INTERMEDIATE');
    const mistakes: MistakePattern[] = [
      makeMistake('late-game-no-defense', 0.1),
      makeMistake('greedy-efficiency', 0.6),
      makeMistake('style-swing', 0.3),
    ];

    const plan = buildTeachingPlan(persona, mistakes);

    expect(plan.focusPoints.length).toBeGreaterThan(0);
    expect(plan.focusPoints[0]).toContain('风险');
  });
});
