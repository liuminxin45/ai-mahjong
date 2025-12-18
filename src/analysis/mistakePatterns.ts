import type { DecisionStat } from './statistics';

export type MistakePattern = {
  id: string;
  description: string;
  frequency: number;
  exampleTurns: number[];
};

export function detectMistakePatterns(decisions: DecisionStat[]): MistakePattern[] {
  if (decisions.length === 0) return [];

  const patterns: MistakePattern[] = [];

  const greedyEfficiency = detectGreedyEfficiency(decisions);
  if (greedyEfficiency) patterns.push(greedyEfficiency);

  const lateGameNoDefense = detectLateGameNoDefense(decisions);
  if (lateGameNoDefense) patterns.push(lateGameNoDefense);

  const earlyMeld = detectEarlyMeld(decisions);
  if (earlyMeld) patterns.push(earlyMeld);

  const styleSwing = detectStyleSwing(decisions);
  if (styleSwing) patterns.push(styleSwing);

  return patterns;
}

function detectGreedyEfficiency(decisions: DecisionStat[]): MistakePattern | null {
  const greedyChoices: number[] = [];

  for (const d of decisions) {
    if (d.dangerLevel === 'HIGH' && d.shantenBefore - d.shantenAfter > 0) {
      greedyChoices.push(d.turn);
    }
  }

  const frequency = greedyChoices.length / decisions.length;

  if (frequency > 0.25) {
    return {
      id: 'greedy-efficiency',
      description: '贪效率型错误：在高风险情况下仍追求效率最优',
      frequency,
      exampleTurns: greedyChoices.slice(0, 3),
    };
  }

  return null;
}

function detectLateGameNoDefense(decisions: DecisionStat[]): MistakePattern | null {
  const lateGameRiskyChoices: number[] = [];

  for (const d of decisions) {
    if (d.turn > 10 && (d.dangerLevel === 'HIGH' || d.dangerLevel === 'MEDIUM')) {
      lateGameRiskyChoices.push(d.turn);
    }
  }

  const lateGameDecisions = decisions.filter((d) => d.turn > 10);
  if (lateGameDecisions.length === 0) return null;

  const frequency = lateGameRiskyChoices.length / lateGameDecisions.length;

  if (frequency > 0.4) {
    return {
      id: 'late-game-no-defense',
      description: '后巡不防守：后巡阶段仍频繁打危险张',
      frequency,
      exampleTurns: lateGameRiskyChoices.slice(0, 3),
    };
  }

  return null;
}

function detectEarlyMeld(decisions: DecisionStat[]): MistakePattern | null {
  const earlyMeldChoices: number[] = [];

  for (const d of decisions) {
    if (d.shantenBefore >= 3 && d.shantenAfter === d.shantenBefore) {
      earlyMeldChoices.push(d.turn);
    }
  }

  const frequency = earlyMeldChoices.length / decisions.length;

  if (frequency > 0.2) {
    return {
      id: 'early-meld',
      description: '过早副露：向听数较大时频繁副露',
      frequency,
      exampleTurns: earlyMeldChoices.slice(0, 3),
    };
  }

  return null;
}

function detectStyleSwing(decisions: DecisionStat[]): MistakePattern | null {
  let swingCount = 0;
  const swingTurns: number[] = [];
  let lastStyle: string | null = null;

  for (const d of decisions) {
    if (lastStyle && lastStyle !== d.style) {
      const isSignificantSwing =
        (lastStyle === 'AGGRESSIVE' && d.style === 'DEFENSIVE') ||
        (lastStyle === 'DEFENSIVE' && d.style === 'AGGRESSIVE');

      if (isSignificantSwing) {
        swingCount++;
        swingTurns.push(d.turn);
      }
    }
    lastStyle = d.style;
  }

  const frequency = swingCount / Math.max(1, decisions.length);

  if (frequency > 0.3) {
    return {
      id: 'style-swing',
      description: '风格摇摆：同局中进攻与防守频繁切换',
      frequency,
      exampleTurns: swingTurns.slice(0, 3),
    };
  }

  return null;
}
