import { describe, expect, it } from 'vitest';
import { buildPopulationPersona } from '../src/analysis/populationPersona';
import { analyzePopulationMistakes } from '../src/analysis/populationMistakes';
import { buildLearningRoadmap } from '../src/analysis/learningRoadmap';
import type { HumanPersona } from '../src/analysis/humanPersona';
import type { MistakePattern } from '../src/analysis/mistakePatterns';

function makePersona(
  playStyle: 'AGGRESSIVE' | 'BALANCED' | 'DEFENSIVE' | 'ERRATIC',
  learningStage: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
  riskTolerance: number,
): HumanPersona {
  return {
    playStyle,
    riskTolerance,
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

describe('population analysis (stage9)', () => {
  describe('population persona', () => {
    it('computes correct averages', () => {
      const personas: HumanPersona[] = [
        makePersona('AGGRESSIVE', 'BEGINNER', 0.8),
        makePersona('DEFENSIVE', 'ADVANCED', 0.2),
        makePersona('BALANCED', 'INTERMEDIATE', 0.5),
      ];

      const population = buildPopulationPersona(personas);

      expect(population.sampleSize).toBe(3);
      expect(population.avgRiskTolerance).toBeCloseTo(0.5);
      expect(population.avgEfficiencyBias).toBeCloseTo(0.5);
      expect(population.avgDefenseAwareness).toBeCloseTo(0.5);
    });

    it('computes style distribution correctly', () => {
      const personas: HumanPersona[] = [
        makePersona('AGGRESSIVE', 'BEGINNER', 0.8),
        makePersona('AGGRESSIVE', 'INTERMEDIATE', 0.7),
        makePersona('DEFENSIVE', 'ADVANCED', 0.2),
      ];

      const population = buildPopulationPersona(personas);

      expect(population.styleDistribution.AGGRESSIVE).toBeCloseTo(2 / 3);
      expect(population.styleDistribution.DEFENSIVE).toBeCloseTo(1 / 3);
    });

    it('marks small samples as unstable', () => {
      const personas: HumanPersona[] = [
        makePersona('BALANCED', 'INTERMEDIATE', 0.5),
        makePersona('BALANCED', 'INTERMEDIATE', 0.5),
      ];

      const population = buildPopulationPersona(personas);

      expect(population.isStableSample).toBe(false);
    });

    it('marks large samples as stable', () => {
      const personas: HumanPersona[] = [];
      for (let i = 0; i < 10; i++) {
        personas.push(makePersona('BALANCED', 'INTERMEDIATE', 0.5));
      }

      const population = buildPopulationPersona(personas);

      expect(population.isStableSample).toBe(true);
    });
  });

  describe('population mistakes', () => {
    it('computes prevalence correctly', () => {
      const allMistakes: MistakePattern[][] = [
        [makeMistake('greedy-efficiency', 0.5)],
        [makeMistake('greedy-efficiency', 0.6)],
        [makeMistake('late-game-no-defense', 0.4)],
      ];

      const popMistakes = analyzePopulationMistakes(allMistakes);

      const greedyMistake = popMistakes.find((m) => m.id === 'greedy-efficiency');
      expect(greedyMistake).toBeDefined();
      expect(greedyMistake!.prevalence).toBeCloseTo(2 / 3);
    });

    it('marks high-prevalence mistakes as HIGH severity', () => {
      const allMistakes: MistakePattern[][] = [];
      for (let i = 0; i < 10; i++) {
        allMistakes.push([makeMistake('common-mistake', 0.5)]);
      }

      const popMistakes = analyzePopulationMistakes(allMistakes);

      expect(popMistakes[0].severity).toBe('HIGH');
      expect(popMistakes[0].prevalence).toBeCloseTo(1.0);
    });

    it('sorts by prevalence descending', () => {
      const allMistakes: MistakePattern[][] = [
        [makeMistake('rare', 0.1), makeMistake('common', 0.5)],
        [makeMistake('common', 0.6)],
        [makeMistake('common', 0.5), makeMistake('medium', 0.3)],
      ];

      const popMistakes = analyzePopulationMistakes(allMistakes);

      expect(popMistakes[0].id).toBe('common');
      expect(popMistakes[0].prevalence).toBeCloseTo(1.0);
      expect(popMistakes[popMistakes.length - 1].prevalence).toBeLessThan(popMistakes[0].prevalence);
    });
  });

  describe('learning roadmap', () => {
    it('prioritizes high-prevalence mistakes', () => {
      const mistakes = [
        { id: 'late-game-no-defense', description: 'Late game no defense', prevalence: 0.8, severity: 'HIGH' as const },
        { id: 'greedy-efficiency', description: 'Greedy efficiency', prevalence: 0.3, severity: 'MEDIUM' as const },
      ];

      const roadmap = buildLearningRoadmap(mistakes);

      expect(roadmap[0].topic).toContain('后巡防守');
      expect(roadmap[0].priority).toBeGreaterThan(roadmap[1].priority);
    });

    it('generates appropriate learning steps', () => {
      const mistakes = [
        { id: 'greedy-efficiency', description: 'Greedy', prevalence: 0.5, severity: 'HIGH' as const },
      ];

      const roadmap = buildLearningRoadmap(mistakes);

      expect(roadmap.length).toBeGreaterThan(0);
      expect(roadmap[0].topic).toBeTruthy();
      expect(roadmap[0].reason).toBeTruthy();
      expect(roadmap[0].priority).toBeGreaterThan(0);
    });
  });
});
