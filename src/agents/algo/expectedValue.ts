/**
 * Expected Value (EV) 计算模块
 * 用于评估每个动作的期望收益，平衡风险与回报
 */

import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import { shantenWithMelds, ukeireTilesWithMelds } from './shanten';
import { evaluateTileDanger } from './danger';
import { findWinPatterns, detectYaku, calculateScore } from '../../core/rules/packs/chengdu/patterns';

/**
 * 估算胜率（基于 shanten 和 ukeire）
 */
export function estimateWinProbability(shanten: number, ukeire: number, wallRemaining: number): number {
  if (shanten < 0) return 1.0; // 已胡
  if (shanten > 3) return 0.01; // 太远
  
  // 基础胜率：shanten 越小，胜率越高
  const shantenFactor = Math.pow(0.3, shanten);
  
  // ukeire 越多，胜率越高（归一化到 0-1）
  const ukeireFactor = Math.min(1.0, ukeire / 30);
  
  // 牌墙剩余越少，胜率衰减
  const wallFactor = Math.min(1.0, wallRemaining / 40);
  
  return shantenFactor * ukeireFactor * wallFactor;
}

/**
 * 估算期望得分（基于当前手牌可能形成的番型）
 */
export function estimateExpectedScore(
  hand: Tile[],
  melds: Array<{ type: string; tile: Tile; from: PlayerId }>,
  isSelfDraw: boolean,
  gangCount: number,
): number {
  // 如果已经听牌，尝试计算实际番型
  if (hand.length === 13) {
    // 尝试每个可能的胡牌
    const possibleScores: number[] = [];
    const uniqueTiles = Array.from(new Set(hand.map(t => `${t.suit}${t.rank}`)))
      .map(key => {
        const [suit, rank] = [key[0], parseInt(key.slice(1))];
        return { suit: suit as Tile['suit'], rank: rank as Tile['rank'] };
      });
    
    for (const winTile of uniqueTiles) {
      const testHand = [...hand, winTile];
      const patterns = findWinPatterns(testHand);
      const validPattern = patterns.find(p => p.isValid);
      
      if (validPattern) {
        const yakuList = detectYaku(
          validPattern,
          testHand,
          winTile,
          isSelfDraw,
          melds.length,
          false,
          false,
          false,
        );
        const score = calculateScore(yakuList, gangCount);
        possibleScores.push(score);
      }
    }
    
    if (possibleScores.length > 0) {
      // 返回平均期望得分
      return possibleScores.reduce((a, b) => a + b, 0) / possibleScores.length;
    }
  }
  
  // 未听牌：基于手牌特征估算
  let estimatedFan = 1; // 基础平胡
  
  // 检查清一色可能性
  const suits = new Set(hand.map(t => t.suit));
  if (suits.size === 1) estimatedFan += 6;
  else if (suits.size === 2) estimatedFan += 1; // 可能混一色
  
  // 检查对对胡可能性
  const counts = new Map<string, number>();
  for (const t of hand) {
    const key = `${t.suit}${t.rank}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const pairCount = Array.from(counts.values()).filter(c => c >= 2).length;
  if (pairCount >= 4) estimatedFan += 1; // 可能对对胡
  
  // 自摸加番
  if (isSelfDraw) estimatedFan += 1;
  
  // 门清加番
  if (melds.length === 0) estimatedFan += 1;
  
  return calculateScore([{ type: 'PING_HU', fan: estimatedFan, description: '估算' }], gangCount);
}

/**
 * 估算放炮损失（基于对手危险度和可能番型）
 */
export function estimateLossProbability(
  state: GameState,
  playerId: PlayerId,
  discardTile: Tile,
): { probability: number; expectedLoss: number } {
  const danger = evaluateTileDanger(state, playerId, discardTile);
  
  // 危险度映射到放炮概率
  let probability = 0;
  if (danger.level === 'HIGH') probability = 0.3;
  else if (danger.level === 'MEDIUM') probability = 0.1;
  else probability = 0.02;
  
  // 估算对手可能的得分（基于危险度）
  const expectedLoss = danger.score * 100; // 危险度越高，估算失分越大
  
  return { probability, expectedLoss };
}

/**
 * 计算弃牌动作的期望值
 */
export function calculateDiscardEV(
  state: GameState,
  playerId: PlayerId,
  discardTile: Tile,
  handAfterDiscard: Tile[],
  meldCount: number,
  gangCount: number,
): {
  ev: number;
  winProb: number;
  expectedScore: number;
  lossProb: number;
  expectedLoss: number;
  shanten: number;
  ukeire: number;
} {
  const shanten = shantenWithMelds(handAfterDiscard, meldCount);
  const ukeire = ukeireTilesWithMelds(handAfterDiscard, meldCount).total;
  
  // 估算胜率和期望得分
  const winProb = estimateWinProbability(shanten, ukeire, state.wall.length);
  const expectedScore = estimateExpectedScore(handAfterDiscard, state.melds[playerId], false, gangCount);
  
  // 估算放炮概率和损失
  const { probability: lossProb, expectedLoss } = estimateLossProbability(state, playerId, discardTile);
  
  // EV = P(win) × Score(win) - P(lose) × Score(lose)
  const ev = winProb * expectedScore - lossProb * expectedLoss;
  
  return {
    ev,
    winProb,
    expectedScore,
    lossProb,
    expectedLoss,
    shanten,
    ukeire,
  };
}

/**
 * 计算碰/杠动作的期望值
 */
export function calculateMeldEV(
  state: GameState,
  playerId: PlayerId,
  action: Action,
  handAfterMeld: Tile[],
  meldCount: number,
  gangCount: number,
): {
  ev: number;
  winProb: number;
  expectedScore: number;
  shanten: number;
  ukeire: number;
} {
  const shanten = shantenWithMelds(handAfterMeld, meldCount);
  const ukeire = ukeireTilesWithMelds(handAfterMeld, meldCount).total;
  
  const winProb = estimateWinProbability(shanten, ukeire, state.wall.length);
  
  // 碰/杠后期望得分会增加（因为有副露）
  let gangBonus = 0;
  if (action.type === 'GANG') gangBonus = gangCount + 1;
  
  const expectedScore = estimateExpectedScore(handAfterMeld, state.melds[playerId], false, gangBonus);
  
  // 碰/杠动作没有直接放炮风险，但会暴露手牌信息（小幅降低 EV）
  const informationPenalty = 50;
  
  const ev = winProb * expectedScore - informationPenalty;
  
  return {
    ev,
    winProb,
    expectedScore,
    shanten,
    ukeire,
  };
}

/**
 * 计算胡牌动作的期望值（最高优先级）
 */
export function calculateHuEV(
  state: GameState,
  playerId: PlayerId,
  winTile: Tile,
  isSelfDraw: boolean,
): {
  ev: number;
  score: number;
} {
  const hand = [...state.hands[playerId], winTile];
  const patterns = findWinPatterns(hand);
  const validPattern = patterns.find(p => p.isValid);
  
  if (!validPattern) {
    return { ev: 0, score: 0 };
  }
  
  const gangCount = state.melds[playerId].filter(m => m.type === 'GANG').length;
  const yakuList = detectYaku(
    validPattern,
    hand,
    winTile,
    isSelfDraw,
    state.melds[playerId].length,
    false,
    false,
    state.wall.length === 0,
  );
  
  const score = calculateScore(yakuList, gangCount);
  
  // 胡牌的 EV 就是得分本身（100% 胜率）
  return { ev: score, score };
}
