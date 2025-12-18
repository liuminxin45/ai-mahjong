import type { MatchResult } from '../meta/matchManager';
import type { MetaAdjustment } from '../meta/metaStrategy';

export type MatchReport = {
  summaryText: string;
  highlights: string[];
  adjustments: string[];
  statistics: {
    totalRounds: number;
    winRate: number;
    loseRate: number;
    drawRate: number;
    avgRiskTaken: number;
    dominantStyle: string;
  };
};

export function generateMatchReport(
  result: MatchResult,
  adjustmentHistory: MetaAdjustment[],
): MatchReport {
  const { rounds, summary } = result;
  const highlights: string[] = [];
  const adjustments: string[] = [];

  let dominantStyle = 'BALANCED';
  let maxStyleCount = 0;
  for (const [style, count] of Object.entries(summary.styleDistribution)) {
    if (count > maxStyleCount) {
      maxStyleCount = count;
      dominantStyle = style;
    }
  }

  const summaryText = buildSummaryText(summary, dominantStyle);

  if (summary.winRate > 0.6) {
    highlights.push(`胜率优秀 (${(summary.winRate * 100).toFixed(1)}%)，整体表现出色`);
  } else if (summary.winRate < 0.3) {
    highlights.push(`胜率偏低 (${(summary.winRate * 100).toFixed(1)}%)，需要调整策略`);
  }

  if (summary.avgRiskTaken > 0.5) {
    highlights.push(`平均风险较高 (${summary.avgRiskTaken.toFixed(2)})，进攻倾向明显`);
  } else if (summary.avgRiskTaken < 0.2) {
    highlights.push(`平均风险较低 (${summary.avgRiskTaken.toFixed(2)})，防守倾向明显`);
  }

  if (summary.drawRate > 0.5) {
    highlights.push(`流局率过高 (${(summary.drawRate * 100).toFixed(1)}%)，可能过于保守`);
  }

  if (summary.biggestThreatOpponent) {
    const count = summary.threatOpponentCount[summary.biggestThreatOpponent];
    highlights.push(`对手 ${summary.biggestThreatOpponent} 频繁成为威胁 (${count} 次)，需重点关注`);
  }

  for (const adj of adjustmentHistory) {
    const sign = adj.delta > 0 ? '+' : '';
    adjustments.push(
      `${adj.param}: ${sign}${adj.delta.toFixed(2)} - ${adj.reason}`,
    );
  }

  return {
    summaryText,
    highlights,
    adjustments,
    statistics: {
      totalRounds: rounds.length,
      winRate: summary.winRate,
      loseRate: summary.loseRate,
      drawRate: summary.drawRate,
      avgRiskTaken: summary.avgRiskTaken,
      dominantStyle,
    },
  };
}

function buildSummaryText(summary: any, dominantStyle: string): string {
  const parts: string[] = [];

  const totalDecisions = summary.styleDistribution 
    ? (Object.values(summary.styleDistribution) as number[]).reduce((a, b) => a + b, 0) 
    : 0;
  parts.push(`本场共 ${totalDecisions} 次决策`);

  parts.push(`主要风格为 ${dominantStyle}`);

  if (summary.winRate > 0.5) {
    parts.push('整体表现良好');
  } else if (summary.loseRate > 0.5) {
    parts.push('失败较多，需要调整');
  } else {
    parts.push('表现平稳');
  }

  if (summary.avgRiskTaken > 0.5) {
    parts.push('倾向进攻');
  } else if (summary.avgRiskTaken < 0.2) {
    parts.push('倾向防守');
  }

  return parts.join('，') + '。';
}
