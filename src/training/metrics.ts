/**
 * 训练指标系统
 * 收集每局游戏的关键指标并计算 fitness
 */

import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';

export interface GameMetrics {
  // 基础结果
  playerId: PlayerId;
  result: 'WIN' | 'LOSE' | 'DRAW';
  finalScore: number; // 净收益（正数为赢，负数为输）
  
  // 胡牌相关
  didWin: boolean;
  isFirstHu: boolean; // 是否首胡
  winTurn: number; // 胡牌轮次（越小越好）
  
  // 放炮相关
  dealInCount: number; // 放炮次数
  stageBDealIn: number; // Stage B 放炮次数（重点惩罚）
  stageCDealIn: number; // Stage C 放炮次数（最严重）
  
  // 决策质量
  avgEV: number; // 平均 EV（从 AI 决策日志计算）
  totalTurns: number; // 总轮次
  
  // 效率指标
  xiangting: number; // 最终向听数
  meldCount: number; // 副露次数
}

export interface FitnessWeights {
  netGain: number; // 净收益权重
  firstHuBonus: number; // 首胡奖励
  dealInPenalty: number; // 放炮惩罚
  stageBDealInPenalty: number; // Stage B 放炮额外惩罚
  stageCDealInPenalty: number; // Stage C 放炮额外惩罚
  avgEVWeight: number; // 平均 EV 权重
  speedBonus: number; // 速度奖励（早胡）
  lossPenalty: number; // 输局固定惩罚
  drawPenalty: number; // 流局轻微惩罚
}

export const DEFAULT_FITNESS_WEIGHTS: FitnessWeights = {
  netGain: 1.0,
  firstHuBonus: 500,
  dealInPenalty: -1500,
  stageBDealInPenalty: -1000,
  stageCDealInPenalty: -2000,
  avgEVWeight: 0.1,
  speedBonus: 0.5,
  lossPenalty: -2000,
  drawPenalty: -300,
};

/**
 * 计算 fitness 值（越高越好）
 */
export function calculateFitness(
  metrics: GameMetrics,
  weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
): number {
  let fitness = 0;
  
  // 1. 净收益
  fitness += metrics.finalScore * weights.netGain;

  // 2. 首胡奖励
  if (metrics.isFirstHu) {
    fitness += weights.firstHuBonus;
  }

  // 2.5 固定输/流局惩罚，放大对失败的敏感度
  if (metrics.result === 'LOSE') {
    fitness += weights.lossPenalty;
  } else if (metrics.result === 'DRAW') {
    fitness += weights.drawPenalty;
  }

  // 3. 放炮惩罚
  fitness += metrics.dealInCount * weights.dealInPenalty;
  fitness += metrics.stageBDealIn * weights.stageBDealInPenalty;
  fitness += metrics.stageCDealIn * weights.stageCDealInPenalty;
  
  // 4. 平均 EV
  fitness += metrics.avgEV * weights.avgEVWeight;
  
  // 5. 速度奖励（越早胡越好）
  if (metrics.didWin && metrics.winTurn > 0) {
    const speedScore = Math.max(0, 100 - metrics.winTurn) * weights.speedBonus;
    fitness += speedScore;
  }
  
  return fitness;
}

/**
 * 从游戏状态提取指标
 */
export function extractMetrics(
  state: GameState,
  playerId: PlayerId,
  aiDecisionLog: any[] = []
): GameMetrics {
  const didWin = state.declaredHu[playerId];
  const huPlayers = (['P0', 'P1', 'P2', 'P3'] as PlayerId[]).filter(
    pid => state.declaredHu[pid]
  );
  const isFirstHu = didWin && huPlayers.length === 1;

  // 真实计分：优先使用规则包写入的 roundScores
  const scores = (state as GameState & {
    roundScores?: Record<PlayerId, number>;
  }).roundScores;
  let finalScore: number | undefined = scores?.[playerId];

  if (typeof finalScore !== 'number') {
    // 兜底：保持原有的简化逻辑，避免其他规则包报错
    if (didWin) {
      finalScore = 1000;
      if (isFirstHu) finalScore += 500;
    } else {
      const otherWinners = huPlayers.filter(pid => pid !== playerId);
      finalScore = otherWinners.length > 0 ? -500 : 100;
    }
  }

  // 放炮统计：读取规则包写入的 dealInStats
  const dealIns = (state as GameState & {
    dealInStats?: Record<PlayerId, { count: number; stageB: number; stageC: number }>;
  }).dealInStats;
  const dealInStat = dealIns?.[playerId];
  const dealInCount = dealInStat?.count ?? 0;
  const stageBDealIn = dealInStat?.stageB ?? 0;
  const stageCDealIn = dealInStat?.stageC ?? 0;

  // 计算平均 EV
  let avgEV = 0;
  if (aiDecisionLog.length > 0) {
    const totalEV = aiDecisionLog.reduce((sum, log) => {
      return sum + (log.selectedEV || 0);
    }, 0);
    avgEV = totalEV / aiDecisionLog.length;
  }

  const hand = state.hands[playerId];
  const xiangting = didWin ? -1 : hand.length; // TODO: 替换为真实向听数
  const result: GameMetrics['result'] = didWin
    ? 'WIN'
    : huPlayers.length === 0
      ? 'DRAW'
      : 'LOSE';

  return {
    playerId,
    result,
    finalScore,
    didWin,
    isFirstHu,
    winTurn: state.turn,
    dealInCount,
    stageBDealIn,
    stageCDealIn,
    avgEV,
    totalTurns: state.turn,
    xiangting,
    meldCount: state.melds[playerId].length,
  };
}

/**
 * 批量计算多局的平均 fitness
 */
export function calculateAverageFitness(
  metricsArray: GameMetrics[],
  weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
): number {
  if (metricsArray.length === 0) return -Infinity;
  
  const totalFitness = metricsArray.reduce((sum, metrics) => {
    return sum + calculateFitness(metrics, weights);
  }, 0);
  
  return totalFitness / metricsArray.length;
}

/**
 * 打印指标摘要
 */
export function printMetricsSummary(metrics: GameMetrics): string {
  const parts = [
    `Result: ${metrics.result}`,
    `Score: ${metrics.finalScore}`,
    metrics.isFirstHu ? '🏆 First Hu' : '',
    `DealIn: ${metrics.dealInCount}`,
    `AvgEV: ${metrics.avgEV.toFixed(1)}`,
    `Turns: ${metrics.totalTurns}`,
  ];
  
  return parts.filter(p => p).join(' | ');
}
