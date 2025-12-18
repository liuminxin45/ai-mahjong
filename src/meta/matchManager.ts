import type { MatchStat } from '../analysis/statistics';
import type { PlayerId } from '../core/model/types';

export type MatchConfig = {
  totalRounds: number;
};

export type MatchSummary = {
  winRate: number;
  loseRate: number;
  drawRate: number;
  avgRiskTaken: number;
  styleDistribution: Record<string, number>;
  biggestThreatOpponent?: PlayerId;
  threatOpponentCount: Record<PlayerId, number>;
};

export type MatchResult = {
  rounds: MatchStat[];
  summary: MatchSummary;
};

export function createMatchManager(config: MatchConfig) {
  const rounds: MatchStat[] = [];
  let finished = false;

  function start(): void {
    rounds.length = 0;
    finished = false;
  }

  function onRoundEnd(stat: MatchStat): void {
    if (finished) return;
    rounds.push(stat);
    if (rounds.length >= config.totalRounds) {
      finished = true;
    }
  }

  function isFinished(): boolean {
    return finished;
  }

  function getResult(): MatchResult {
    const summary = computeSummary(rounds);
    return { rounds, summary };
  }

  function computeSummary(stats: MatchStat[]): MatchSummary {
    if (stats.length === 0) {
      return {
        winRate: 0,
        loseRate: 0,
        drawRate: 0,
        avgRiskTaken: 0,
        styleDistribution: {},
        threatOpponentCount: {} as Record<PlayerId, number>,
      };
    }

    let winCount = 0;
    let loseCount = 0;
    let drawCount = 0;
    let totalRisk = 0;
    const styleCount: Record<string, number> = {};
    const threatCount: Record<PlayerId, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };

    for (const s of stats) {
      if (s.result === 'HU') winCount++;
      else if (s.result === 'LOSE') loseCount++;
      else if (s.result === 'DRAW') drawCount++;

      for (const d of s.decisions) {
        const style = d.style;
        styleCount[style] = (styleCount[style] || 0) + 1;

        if (d.dangerLevel === 'HIGH') totalRisk += 1.0;
        else if (d.dangerLevel === 'MEDIUM') totalRisk += 0.5;

        if (d.topThreat) {
          threatCount[d.topThreat.playerId]++;
        }
      }
    }

    const totalDecisions = stats.reduce((sum, s) => sum + s.decisions.length, 0);
    const avgRiskTaken = totalDecisions > 0 ? totalRisk / totalDecisions : 0;

    let biggestThreatOpponent: PlayerId | undefined;
    let maxThreatCount = 0;
    for (const pid of ['P1', 'P2', 'P3'] as PlayerId[]) {
      if (threatCount[pid] > maxThreatCount) {
        maxThreatCount = threatCount[pid];
        biggestThreatOpponent = pid;
      }
    }

    return {
      winRate: winCount / stats.length,
      loseRate: loseCount / stats.length,
      drawRate: drawCount / stats.length,
      avgRiskTaken,
      styleDistribution: styleCount,
      biggestThreatOpponent: maxThreatCount > 0 ? biggestThreatOpponent : undefined,
      threatOpponentCount: threatCount,
    };
  }

  return { start, onRoundEnd, isFinished, getResult };
}
