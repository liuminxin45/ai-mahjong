import type { MatchStat } from '../analysis/statistics';
import type { PlayerId } from '../core/model/types';

export type StrategyParams = {
  efficiencyWeight: number;
  dangerWeight: number;
  threatWeight: number;
};

export type MetaAdjustment = {
  param: keyof StrategyParams;
  delta: number;
  reason: string;
  timestamp: number;
};

const DEFAULT_PARAMS: StrategyParams = {
  efficiencyWeight: 1.0,
  dangerWeight: 1.0,
  threatWeight: 1.0,
};

const PARAM_MIN = 0.1;
const PARAM_MAX = 3.0;

export function createMetaStrategy() {
  const params: StrategyParams = { ...DEFAULT_PARAMS };
  const adjustmentHistory: MetaAdjustment[] = [];
  const roundHistory: MatchStat[] = [];

  function getParams(): StrategyParams {
    return { ...params };
  }

  function onRoundEnd(stat: MatchStat): MetaAdjustment[] {
    roundHistory.push(stat);
    const adjustments: MetaAdjustment[] = [];

    if (roundHistory.length < 3) {
      return adjustments;
    }

    const recentRounds = roundHistory.slice(-5);

    const adj1 = checkOverAggression(recentRounds);
    if (adj1) adjustments.push(adj1);

    const adj2 = checkOverDefensive(recentRounds);
    if (adj2) adjustments.push(adj2);

    const adj3 = checkThreatFocus(recentRounds);
    if (adj3) adjustments.push(adj3);

    for (const adj of adjustments) {
      applyAdjustment(adj);
      adjustmentHistory.push(adj);
    }

    return adjustments;
  }

  function checkOverAggression(rounds: MatchStat[]): MetaAdjustment | null {
    let highRiskCount = 0;
    let totalDecisions = 0;
    let loseCount = 0;

    for (const r of rounds) {
      if (r.result === 'LOSE') loseCount++;
      for (const d of r.decisions) {
        totalDecisions++;
        if (d.dangerLevel === 'HIGH') highRiskCount++;
      }
    }

    const highRiskRatio = totalDecisions > 0 ? highRiskCount / totalDecisions : 0;
    const loseRatio = rounds.length > 0 ? loseCount / rounds.length : 0;

    if (highRiskRatio > 0.3 && loseRatio > 0.5) {
      return {
        param: 'dangerWeight',
        delta: 0.3,
        reason: `过度进攻：高风险弃牌占比 ${(highRiskRatio * 100).toFixed(1)}%，失败率 ${(loseRatio * 100).toFixed(1)}%`,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  function checkOverDefensive(rounds: MatchStat[]): MetaAdjustment | null {
    let drawCount = 0;
    let avgShantenDelta = 0;
    let totalDecisions = 0;

    for (const r of rounds) {
      if (r.result === 'DRAW') drawCount++;
      for (const d of r.decisions) {
        totalDecisions++;
        avgShantenDelta += d.shantenBefore - d.shantenAfter;
      }
    }

    const drawRatio = rounds.length > 0 ? drawCount / rounds.length : 0;
    const avgProgress = totalDecisions > 0 ? avgShantenDelta / totalDecisions : 0;

    if (drawRatio > 0.6 && avgProgress < 0.05) {
      return {
        param: 'efficiencyWeight',
        delta: 0.25,
        reason: `过度保守：流局率 ${(drawRatio * 100).toFixed(1)}%，向听进展缓慢 ${avgProgress.toFixed(3)}`,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  function checkThreatFocus(rounds: MatchStat[]): MetaAdjustment | null {
    const threatCount: Record<PlayerId, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    let totalThreats = 0;

    for (const r of rounds) {
      for (const d of r.decisions) {
        if (d.topThreat && d.topThreat.threatLevel === 'HIGH') {
          threatCount[d.topThreat.playerId]++;
          totalThreats++;
        }
      }
    }

    let maxThreatPid: PlayerId | null = null;
    let maxCount = 0;
    for (const pid of ['P1', 'P2', 'P3'] as PlayerId[]) {
      if (threatCount[pid] > maxCount) {
        maxCount = threatCount[pid];
        maxThreatPid = pid;
      }
    }

    if (maxThreatPid && totalThreats > 0 && maxCount / totalThreats > 0.6) {
      return {
        param: 'threatWeight',
        delta: 0.2,
        reason: `对手 ${maxThreatPid} 频繁成为最大威胁 (${maxCount}/${totalThreats})`,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  function applyAdjustment(adj: MetaAdjustment): void {
    const current = params[adj.param];
    const newValue = Math.max(PARAM_MIN, Math.min(PARAM_MAX, current + adj.delta));
    params[adj.param] = newValue;
  }

  function getAdjustmentHistory(): MetaAdjustment[] {
    return [...adjustmentHistory];
  }

  function reset(): void {
    params.efficiencyWeight = DEFAULT_PARAMS.efficiencyWeight;
    params.dangerWeight = DEFAULT_PARAMS.dangerWeight;
    params.threatWeight = DEFAULT_PARAMS.threatWeight;
    adjustmentHistory.length = 0;
    roundHistory.length = 0;
  }

  return {
    getParams,
    onRoundEnd,
    getAdjustmentHistory,
    reset,
  };
}
