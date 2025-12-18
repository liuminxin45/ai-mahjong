import type { DecisionStat } from './statistics';

export type TeachingOutcome = {
  variantId: string;
  beforeRiskRate: number;
  afterRiskRate: number;
  improvement: number;
  beforeMistakeRate: number;
  afterMistakeRate: number;
};

export type TeachingSession = {
  variantId: string;
  beforeDecisions: DecisionStat[];
  afterDecisions: DecisionStat[];
};

export function evaluateTeachingVariants(
  sessions: TeachingSession[],
): TeachingOutcome[] {
  const outcomes: TeachingOutcome[] = [];

  const variantSessions = new Map<string, TeachingSession[]>();
  for (const session of sessions) {
    const existing = variantSessions.get(session.variantId) || [];
    existing.push(session);
    variantSessions.set(session.variantId, existing);
  }

  for (const [variantId, variantSessionList] of variantSessions.entries()) {
    let totalBeforeRisk = 0;
    let totalAfterRisk = 0;
    let totalBeforeMistakes = 0;
    let totalAfterMistakes = 0;
    let totalBeforeDecisions = 0;
    let totalAfterDecisions = 0;

    for (const session of variantSessionList) {
      const beforeStats = analyzeDecisions(session.beforeDecisions);
      const afterStats = analyzeDecisions(session.afterDecisions);

      totalBeforeRisk += beforeStats.highRiskCount;
      totalAfterRisk += afterStats.highRiskCount;
      totalBeforeMistakes += beforeStats.mistakeCount;
      totalAfterMistakes += afterStats.mistakeCount;
      totalBeforeDecisions += session.beforeDecisions.length;
      totalAfterDecisions += session.afterDecisions.length;
    }

    const beforeRiskRate = totalBeforeDecisions > 0 ? totalBeforeRisk / totalBeforeDecisions : 0;
    const afterRiskRate = totalAfterDecisions > 0 ? totalAfterRisk / totalAfterDecisions : 0;
    const beforeMistakeRate = totalBeforeDecisions > 0 ? totalBeforeMistakes / totalBeforeDecisions : 0;
    const afterMistakeRate = totalAfterDecisions > 0 ? totalAfterMistakes / totalAfterDecisions : 0;

    const improvement = beforeRiskRate > 0 ? (beforeRiskRate - afterRiskRate) / beforeRiskRate : 0;

    outcomes.push({
      variantId,
      beforeRiskRate,
      afterRiskRate,
      improvement,
      beforeMistakeRate,
      afterMistakeRate,
    });
  }

  outcomes.sort((a, b) => b.improvement - a.improvement);

  return outcomes;
}

function analyzeDecisions(decisions: DecisionStat[]): {
  highRiskCount: number;
  mistakeCount: number;
} {
  let highRiskCount = 0;
  let mistakeCount = 0;

  for (const d of decisions) {
    if (d.dangerLevel === 'HIGH') {
      highRiskCount++;
    }

    if (d.dangerLevel === 'HIGH' && d.shantenBefore - d.shantenAfter > 0) {
      mistakeCount++;
    }

    if (d.turn > 10 && (d.dangerLevel === 'HIGH' || d.dangerLevel === 'MEDIUM')) {
      mistakeCount++;
    }
  }

  return { highRiskCount, mistakeCount };
}
