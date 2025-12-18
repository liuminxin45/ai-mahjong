import type { DecisionStat } from './statistics';

export type PlayStyle = 'AGGRESSIVE' | 'BALANCED' | 'DEFENSIVE' | 'ERRATIC';
export type LearningStage = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type HumanPersona = {
  playStyle: PlayStyle;
  riskTolerance: number;
  efficiencyBias: number;
  defenseAwareness: number;
  learningStage: LearningStage;
};

const EMA_ALPHA = 0.15;

export function createHumanPersona() {
  let riskTolerance = 0.5;
  let efficiencyBias = 0.5;
  let defenseAwareness = 0.5;
  let decisionCount = 0;
  let highRiskCount = 0;
  let defensiveChoiceCount = 0;
  let styleFlipCount = 0;
  let lastStyle: string | null = null;

  function onDecision(stat: DecisionStat): void {
    decisionCount++;

    if (stat.dangerLevel === 'HIGH') {
      highRiskCount++;
      riskTolerance = riskTolerance * (1 - EMA_ALPHA) + 1.0 * EMA_ALPHA;
    } else if (stat.dangerLevel === 'LOW') {
      riskTolerance = riskTolerance * (1 - EMA_ALPHA) + 0.0 * EMA_ALPHA;
    } else {
      riskTolerance = riskTolerance * (1 - EMA_ALPHA) + 0.5 * EMA_ALPHA;
    }

    const shantenProgress = stat.shantenBefore - stat.shantenAfter;
    if (shantenProgress > 0) {
      efficiencyBias = efficiencyBias * (1 - EMA_ALPHA) + 1.0 * EMA_ALPHA;
    } else if (shantenProgress < 0) {
      efficiencyBias = efficiencyBias * (1 - EMA_ALPHA) + 0.0 * EMA_ALPHA;
    }

    if (stat.style === 'DEFENSIVE' || stat.style === 'STALLING') {
      defensiveChoiceCount++;
      if (stat.dangerLevel === 'LOW') {
        defenseAwareness = defenseAwareness * (1 - EMA_ALPHA) + 1.0 * EMA_ALPHA;
      }
    }

    if (stat.style === 'AGGRESSIVE' && stat.dangerLevel === 'HIGH') {
      efficiencyBias = efficiencyBias * (1 - EMA_ALPHA) + 0.8 * EMA_ALPHA;
    }

    if (lastStyle && lastStyle !== stat.style) {
      styleFlipCount++;
    }
    lastStyle = stat.style;
  }

  function getSnapshot(): HumanPersona {
    const playStyle = determinePlayStyle(riskTolerance, efficiencyBias, defenseAwareness, styleFlipCount, decisionCount);
    const learningStage = determineLearningStage(riskTolerance, defenseAwareness, highRiskCount, decisionCount);

    return {
      playStyle,
      riskTolerance,
      efficiencyBias,
      defenseAwareness,
      learningStage,
    };
  }

  function determinePlayStyle(
    risk: number,
    efficiency: number,
    defense: number,
    flips: number,
    total: number,
  ): PlayStyle {
    const flipRatio = total > 0 ? flips / total : 0;

    if (flipRatio > 0.4) {
      return 'ERRATIC';
    }

    if (risk > 0.65 && efficiency > 0.6) {
      return 'AGGRESSIVE';
    }

    if (risk < 0.35 && defense > 0.6) {
      return 'DEFENSIVE';
    }

    return 'BALANCED';
  }

  function determineLearningStage(
    risk: number,
    defense: number,
    highRiskCount: number,
    total: number,
  ): LearningStage {
    if (total === 0) return 'BEGINNER';

    const highRiskRatio = highRiskCount / total;

    if (highRiskRatio > 0.7 && defense < 0.4) {
      return 'BEGINNER';
    }

    if (defense > 0.6 && risk > 0.3 && risk < 0.7) {
      return 'ADVANCED';
    }

    return 'INTERMEDIATE';
  }

  return {
    onDecision,
    getSnapshot,
  };
}
