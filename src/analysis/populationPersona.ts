import type { HumanPersona } from './humanPersona';

export type PopulationPersona = {
  sampleSize: number;
  avgRiskTolerance: number;
  avgEfficiencyBias: number;
  avgDefenseAwareness: number;
  styleDistribution: Record<string, number>;
  learningStageDistribution: Record<string, number>;
  isStableSample: boolean;
};

const MIN_STABLE_SAMPLE_SIZE = 5;

export function buildPopulationPersona(personas: HumanPersona[]): PopulationPersona {
  if (personas.length === 0) {
    return {
      sampleSize: 0,
      avgRiskTolerance: 0,
      avgEfficiencyBias: 0,
      avgDefenseAwareness: 0,
      styleDistribution: {},
      learningStageDistribution: {},
      isStableSample: false,
    };
  }

  let totalRisk = 0;
  let totalEfficiency = 0;
  let totalDefense = 0;
  const styleCount: Record<string, number> = {};
  const stageCount: Record<string, number> = {};

  for (const p of personas) {
    totalRisk += p.riskTolerance;
    totalEfficiency += p.efficiencyBias;
    totalDefense += p.defenseAwareness;

    styleCount[p.playStyle] = (styleCount[p.playStyle] || 0) + 1;
    stageCount[p.learningStage] = (stageCount[p.learningStage] || 0) + 1;
  }

  const sampleSize = personas.length;
  const avgRiskTolerance = totalRisk / sampleSize;
  const avgEfficiencyBias = totalEfficiency / sampleSize;
  const avgDefenseAwareness = totalDefense / sampleSize;

  const styleDistribution: Record<string, number> = {};
  for (const [style, count] of Object.entries(styleCount)) {
    styleDistribution[style] = count / sampleSize;
  }

  const learningStageDistribution: Record<string, number> = {};
  for (const [stage, count] of Object.entries(stageCount)) {
    learningStageDistribution[stage] = count / sampleSize;
  }

  const isStableSample = sampleSize >= MIN_STABLE_SAMPLE_SIZE;

  return {
    sampleSize,
    avgRiskTolerance,
    avgEfficiencyBias,
    avgDefenseAwareness,
    styleDistribution,
    learningStageDistribution,
    isStableSample,
  };
}
