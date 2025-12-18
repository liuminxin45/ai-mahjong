import type { PopulationMistake } from './populationMistakes';

export type LearningStep = {
  topic: string;
  reason: string;
  priority: number;
};

export function buildLearningRoadmap(mistakes: PopulationMistake[]): LearningStep[] {
  const steps: LearningStep[] = [];

  for (const mistake of mistakes) {
    const step = mistakeToLearningStep(mistake);
    if (step) {
      steps.push(step);
    }
  }

  steps.sort((a, b) => b.priority - a.priority);

  return steps;
}

function mistakeToLearningStep(mistake: PopulationMistake): LearningStep | null {
  let topic = '';
  let reason = '';
  let priority = 0;

  switch (mistake.id) {
    case 'late-game-no-defense':
      topic = '后巡防守意识';
      reason = `${(mistake.prevalence * 100).toFixed(0)}% 的玩家在后巡阶段仍打危险张`;
      priority = calculatePriority(mistake.prevalence, 0.9);
      break;

    case 'greedy-efficiency':
      topic = '效率与风险的平衡';
      reason = `${(mistake.prevalence * 100).toFixed(0)}% 的玩家过度追求效率而忽视风险`;
      priority = calculatePriority(mistake.prevalence, 0.8);
      break;

    case 'early-meld':
      topic = '副露时机判断';
      reason = `${(mistake.prevalence * 100).toFixed(0)}% 的玩家在向听数较大时过早副露`;
      priority = calculatePriority(mistake.prevalence, 0.6);
      break;

    case 'style-swing':
      topic = '决策风格稳定性';
      reason = `${(mistake.prevalence * 100).toFixed(0)}% 的玩家决策风格不稳定`;
      priority = calculatePriority(mistake.prevalence, 0.5);
      break;

    default:
      topic = mistake.description;
      reason = `出现频率 ${(mistake.prevalence * 100).toFixed(0)}%`;
      priority = calculatePriority(mistake.prevalence, 0.5);
  }

  return { topic, reason, priority };
}

function calculatePriority(prevalence: number, severityWeight: number): number {
  return prevalence * 0.6 + severityWeight * 0.4;
}
