/**
 * 血战到底专用 EV 计算模块
 * 实现阶段化的 P(win), P(lose), Score, Loss 建模
 */

import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import { shantenWithMelds, ukeireTilesWithMelds, handToCounts } from './shanten';
import { evaluateTileDanger } from './danger';
import { getAIParams } from './aiParams';

// ============ 阶段定义 ============

export type Stage = 'A' | 'B' | 'C';

export interface StageInfo {
  stage: Stage;
  huCount: number; // 已胡人数
  iHaveHu: boolean; // 我是否已胡
  shouldDefend: boolean; // 是否应该防守优先
}

/**
 * 计算当前阶段
 * Stage A: 无人胡
 * Stage B: 有人胡且我未胡
 * Stage C: 我已胡
 */
export function calcStage(state: GameState, playerId: PlayerId): StageInfo {
  const huPlayers = (['P0', 'P1', 'P2', 'P3'] as PlayerId[]).filter(
    pid => state.declaredHu[pid]
  );
  const huCount = huPlayers.length;
  const iHaveHu = state.declaredHu[playerId];
  
  let stage: Stage;
  if (iHaveHu) {
    stage = 'C';
  } else if (huCount > 0) {
    stage = 'B';
  } else {
    stage = 'A';
  }
  
  // Stage B 且向听 >= 2 时，防守优先
  const hand = state.hands[playerId];
  const meldCount = state.melds[playerId].length;
  const xiangting = shantenWithMelds(hand, meldCount);
  const shouldDefend = stage === 'B' && xiangting >= 2;
  
  return { stage, huCount, iHaveHu, shouldDefend };
}

// ============ 剩余牌统计 ============

interface RemainCounts {
  total: number;
  byTile: Map<string, number>; // key: "W1", "B5" etc
}

function calcRemainCounts(state: GameState): RemainCounts {
  const total = state.wall.length;
  const byTile = new Map<string, number>();
  
  // 初始化：每种牌 4 张
  for (const suit of ['W', 'B', 'T']) {
    for (let rank = 1; rank <= 9; rank++) {
      byTile.set(`${suit}${rank}`, 4);
    }
  }
  
  // 减去所有可见的牌
  const allPlayers = ['P0', 'P1', 'P2', 'P3'] as PlayerId[];
  for (const pid of allPlayers) {
    // 手牌
    for (const t of state.hands[pid]) {
      const key = `${t.suit}${t.rank}`;
      byTile.set(key, Math.max(0, (byTile.get(key) || 0) - 1));
    }
    // 弃牌
    for (const t of state.discards[pid]) {
      const key = `${t.suit}${t.rank}`;
      byTile.set(key, Math.max(0, (byTile.get(key) || 0) - 1));
    }
    // 副露
    for (const meld of state.melds[pid]) {
      const key = `${meld.tile.suit}${meld.tile.rank}`;
      const count = meld.type === 'GANG' ? 4 : 3;
      byTile.set(key, Math.max(0, (byTile.get(key) || 0) - count));
    }
  }
  
  return { total, byTile };
}

// ============ P(win) 增强 ============

export interface PwinDetails {
  xiangting: number;
  effectiveTiles: string[]; // ["W1", "B5", ...]
  effectiveWeighted: number; // 加权有效牌数
  Pimprove: number; // 未来 N 次摸牌命中概率
  stageFactor: number; // 阶段系数
  Pwin: number; // 最终胜率
}

/**
 * 计算 P(win) - 成为下一个胡的人的概率
 */
export function calcPwin(
  state: GameState,
  playerId: PlayerId,
  handAfter: Tile[],
  meldCount: number,
  stageInfo: StageInfo,
): PwinDetails {
  // Stage C: 已胡，P(win) = 0
  if (stageInfo.stage === 'C') {
    return {
      xiangting: -1,
      effectiveTiles: [],
      effectiveWeighted: 0,
      Pimprove: 0,
      stageFactor: 0,
      Pwin: 0,
    };
  }
  
  const xiangting = shantenWithMelds(handAfter, meldCount);
  
  // 已听牌或已胡
  if (xiangting < 0) {
    return {
      xiangting,
      effectiveTiles: [],
      effectiveWeighted: 0,
      Pimprove: 1.0,
      stageFactor: 1.0,
      Pwin: 1.0,
    };
  }
  
  // 计算有效牌
  const ukeireResult = ukeireTilesWithMelds(handAfter, meldCount);
  const effectiveTiles = ukeireResult.tiles.map(t => `${t.suit}${t.rank}`);
  
  // 计算剩余牌数
  const remain = calcRemainCounts(state);
  let effectiveWeighted = 0;
  for (const tile of effectiveTiles) {
    effectiveWeighted += remain.byTile.get(tile) || 0;
  }
  
  // 计算 P_improve: 未来 N 次摸牌命中有效牌的概率
  // P_improve ≈ 1 - Π(1 - remain[t]/remainTotal)
  const params = getAIParams();
  const N = stageInfo.stage === 'A' ? params.pimproveNStageA : params.pimproveNStageB;
  let Pimprove = 0;
  if (remain.total > 0 && effectiveWeighted > 0) {
    const pMiss = Math.pow(1 - effectiveWeighted / remain.total, N);
    Pimprove = 1 - pMiss;
  }
  
  // 向听数因子
  const xiangtingFactor = Math.pow(params.xiangtingBase, xiangting);
  
  // 阶段因子
  let stageFactor = 1.0;
  if (stageInfo.stage === 'B') {
    stageFactor = params.stageFactorB;
  }
  
  // 最终 P(win)
  const Pwin = xiangtingFactor * Pimprove * stageFactor;
  
  return {
    xiangting,
    effectiveTiles,
    effectiveWeighted,
    Pimprove,
    stageFactor,
    Pwin,
  };
}

// ============ P(lose) 增强 ============

export interface PloseDetails {
  riskByOpponent: Record<PlayerId, number>; // 每个对手的危险度
  maxRisk: number; // 最大危险度
  maxRiskOpponent: PlayerId | null; // 最危险对手
  gangSideEffect: number; // 杠的副作用风险
  stageFactor: number; // 阶段系数
  Plose: number; // 最终放炮概率
}

/**
 * 计算单个对手的危险度
 */
function calcOpponentRisk(
  state: GameState,
  playerId: PlayerId,
  opponent: PlayerId,
  tile: Tile,
): number {
  // 已胡的对手，风险为 0
  if (state.declaredHu[opponent]) {
    return 0;
  }
  
  const params = getAIParams();
  const danger = evaluateTileDanger(state, playerId, tile);
  let risk = danger.score / 100; // 归一化到 0-1
  
  // 现物检查：对手弃过同牌
  const hasDiscarded = state.discards[opponent].some(
    t => t.suit === tile.suit && t.rank === tile.rank
  );
  if (hasDiscarded) {
    risk *= params.genbutsuRiskScale;
  }
  
  // 定缺检查
  const dingQue = (state as any).dingQueSelection?.[opponent];
  if (dingQue && tile.suit === dingQue) {
    risk *= params.dingQueRiskScale;
  }
  
  // 副露检查：对手副露偏向某花色
  const meldSuits = state.melds[opponent].map(m => m.tile.suit);
  const dominantSuit = meldSuits.length > 0 ? meldSuits[0] : null;
  if (dominantSuit && tile.suit === dominantSuit) {
    risk *= params.meldSuitRiskScale;
  }
  
  // 轮次因子：越后期越危险
  const turnFactor = Math.min(1.5, 1.0 + state.turn * params.turnRiskFactor);
  risk *= turnFactor;
  
  return Math.min(1.0, risk);
}

/**
 * 计算 P(lose) - 放炮或加速对手的概率
 */
export function calcPlose(
  state: GameState,
  playerId: PlayerId,
  tile: Tile,
  stageInfo: StageInfo,
  isGangAction: boolean = false,
): PloseDetails {
  const riskByOpponent: Record<PlayerId, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
  };
  
  // 计算每个对手的危险度
  const opponents = (['P0', 'P1', 'P2', 'P3'] as PlayerId[]).filter(
    pid => pid !== playerId
  );
  
  for (const opp of opponents) {
    riskByOpponent[opp] = calcOpponentRisk(state, playerId, opp, tile);
  }
  
  // 找到最危险对手
  let maxRisk = 0;
  let maxRiskOpponent: PlayerId | null = null;
  for (const opp of opponents) {
    if (riskByOpponent[opp] > maxRisk) {
      maxRisk = riskByOpponent[opp];
      maxRiskOpponent = opp;
    }
  }
  
  const params = getAIParams();
  
  // 杠的副作用风险
  let gangSideEffect = 0;
  if (isGangAction) {
    // 杠给对手增加摸牌机会
    const threatLevel = opponents.reduce((sum, opp) => {
      const meldCount = state.melds[opp].length;
      const hasHu = state.declaredHu[opp];
      return sum + (hasHu ? 0 : meldCount * params.oppMeldMultiplierK);
    }, 0);
    gangSideEffect = threatLevel * params.gangSideEffectK;
    
    // Stage B/C 下杠的惩罚更大
    if (stageInfo.stage === 'B' || stageInfo.stage === 'C') {
      gangSideEffect *= params.gangPenaltyBCMultiplier;
    }
  }
  
  // 阶段因子
  let stageFactor = 1.0;
  if (stageInfo.stage === 'B') {
    stageFactor = params.stageFactorPloseB;
  } else if (stageInfo.stage === 'C') {
    stageFactor = params.stageFactorPloseC;
  }
  
  // 最终 P(lose)
  const basePlose = maxRisk * params.basePloseScale;
  const Plose = Math.min(1.0, (basePlose + gangSideEffect) * stageFactor);
  
  return {
    riskByOpponent,
    maxRisk,
    maxRiskOpponent,
    gangSideEffect,
    stageFactor,
    Plose,
  };
}

// ============ Score 增强 ============

export interface ScoreDetails {
  baseWinValue: number; // 基础胜利价值
  speedBonus: number; // 速度奖励
  firstWinBonus: number; // 先胡奖励
  stageDiscount: number; // 阶段折扣
  Score: number; // 最终得分
}

/**
 * 计算 Score - 胜利的价值
 */
export function calcScore(
  state: GameState,
  playerId: PlayerId,
  stageInfo: StageInfo,
  xiangting: number,
): ScoreDetails {
  // Stage C: 已胡，Score = 0
  if (stageInfo.stage === 'C') {
    return {
      baseWinValue: 0,
      speedBonus: 0,
      firstWinBonus: 0,
      stageDiscount: 0,
      Score: 0,
    };
  }
  
  const params = getAIParams();
  
  // 基础价值
  const baseWinValue = params.baseWinValue;
  
  // 速度奖励：向听越小，奖励越高
  const speedBonus = Math.max(0, (3 - xiangting) * params.speedBonusK);
  
  // 先胡奖励：Stage A 下成为第一个胡的额外奖励
  const firstWinBonus = stageInfo.stage === 'A' ? params.firstWinBonus : 0;
  
  // 阶段折扣
  let stageDiscount = 1.0;
  if (stageInfo.stage === 'B') {
    stageDiscount = params.stageDiscountB;
  }
  
  // 最终 Score
  const Score = (baseWinValue + speedBonus + firstWinBonus) * stageDiscount;
  
  return {
    baseWinValue,
    speedBonus,
    firstWinBonus,
    stageDiscount,
    Score,
  };
}

// ============ Loss 增强 ============

export interface LossDetails {
  baseLoss: number; // 基础损失
  stageMultiplier: number; // 阶段系数
  opponentMultiplier: number; // 对手系数
  Loss: number; // 最终损失
}

/**
 * 计算 Loss - 放炮的损失
 */
export function calcLoss(
  state: GameState,
  playerId: PlayerId,
  stageInfo: StageInfo,
  maxRiskOpponent: PlayerId | null,
): LossDetails {
  const params = getAIParams();
  const baseLoss = params.baseLoss;
  
  // 阶段系数
  let stageMultiplier = 1.0;
  if (stageInfo.stage === 'A') {
    stageMultiplier = params.stageMultiplierA;
  } else if (stageInfo.stage === 'B') {
    stageMultiplier = params.stageMultiplierB;
  } else if (stageInfo.stage === 'C') {
    stageMultiplier = params.stageMultiplierC;
  }
  
  // 对手系数
  let opponentMultiplier = 1.0;
  if (maxRiskOpponent) {
    const oppHasHu = state.declaredHu[maxRiskOpponent];
    if (!oppHasHu) {
      opponentMultiplier = params.oppNotHuMultiplier;
    }
    
    // 对手副露越多，威胁越大
    const oppMeldCount = state.melds[maxRiskOpponent].length;
    opponentMultiplier *= 1.0 + oppMeldCount * params.oppMeldMultiplierK;
  }
  
  // 最终 Loss
  const Loss = baseLoss * stageMultiplier * opponentMultiplier;
  
  return {
    baseLoss,
    stageMultiplier,
    opponentMultiplier,
    Loss,
  };
}

// ============ 综合 EV 计算 ============

export interface EVDetails {
  stage: StageInfo;
  Pwin: PwinDetails;
  Plose: PloseDetails;
  Score: ScoreDetails;
  Loss: LossDetails;
  EV: number;
}

/**
 * 计算弃牌动作的完整 EV
 */
export function calcDiscardEV(
  state: GameState,
  playerId: PlayerId,
  tile: Tile,
  handAfter: Tile[],
  meldCount: number,
): EVDetails {
  const stage = calcStage(state, playerId);
  
  // Stage C: 只防守，选择最小 P(lose) 的牌
  if (stage.stage === 'C') {
    const Plose = calcPlose(state, playerId, tile, stage, false);
    return {
      stage,
      Pwin: {
        xiangting: -1,
        effectiveTiles: [],
        effectiveWeighted: 0,
        Pimprove: 0,
        stageFactor: 0,
        Pwin: 0,
      },
      Plose,
      Score: {
        baseWinValue: 0,
        speedBonus: 0,
        firstWinBonus: 0,
        stageDiscount: 0,
        Score: 0,
      },
      Loss: calcLoss(state, playerId, stage, Plose.maxRiskOpponent),
      EV: -Plose.Plose * calcLoss(state, playerId, stage, Plose.maxRiskOpponent).Loss,
    };
  }
  
  const Pwin = calcPwin(state, playerId, handAfter, meldCount, stage);
  const Plose = calcPlose(state, playerId, tile, stage, false);
  const Score = calcScore(state, playerId, stage, Pwin.xiangting);
  const Loss = calcLoss(state, playerId, stage, Plose.maxRiskOpponent);
  
  // EV = P(win) × Score - P(lose) × Loss
  const EV = Pwin.Pwin * Score.Score - Plose.Plose * Loss.Loss;
  
  return { stage, Pwin, Plose, Score, Loss, EV };
}

/**
 * 计算碰/杠动作的完整 EV
 */
export function calcMeldEV(
  state: GameState,
  playerId: PlayerId,
  tile: Tile,
  handAfter: Tile[],
  meldCount: number,
  isGang: boolean,
): EVDetails {
  const stage = calcStage(state, playerId);
  
  // Stage C: 已胡，不应该碰/杠
  if (stage.stage === 'C') {
    return {
      stage,
      Pwin: {
        xiangting: -1,
        effectiveTiles: [],
        effectiveWeighted: 0,
        Pimprove: 0,
        stageFactor: 0,
        Pwin: 0,
      },
      Plose: {
        riskByOpponent: { P0: 0, P1: 0, P2: 0, P3: 0 },
        maxRisk: 0,
        maxRiskOpponent: null,
        gangSideEffect: 0,
        stageFactor: 0,
        Plose: 0,
      },
      Score: {
        baseWinValue: 0,
        speedBonus: 0,
        firstWinBonus: 0,
        stageDiscount: 0,
        Score: 0,
      },
      Loss: {
        baseLoss: 0,
        stageMultiplier: 0,
        opponentMultiplier: 0,
        Loss: 0,
      },
      EV: -10000, // 强制不碰/杠
    };
  }
  
  const Pwin = calcPwin(state, playerId, handAfter, meldCount, stage);
  const Plose = calcPlose(state, playerId, tile, stage, isGang);
  const Score = calcScore(state, playerId, stage, Pwin.xiangting);
  const Loss = calcLoss(state, playerId, stage, Plose.maxRiskOpponent);
  
  // 信息暴露惩罚
  const params = getAIParams();
  let informationPenalty = 0;
  if (isGang) {
    informationPenalty = stage.stage === 'A' ? params.informationPenaltyGangA : params.informationPenaltyGangB;
  } else {
    informationPenalty = stage.stage === 'A' ? params.informationPenaltyPengA : params.informationPenaltyPengB;
  }
  
  const EV = Pwin.Pwin * Score.Score - Plose.Plose * Loss.Loss - informationPenalty;
  
  return { stage, Pwin, Plose, Score, Loss, EV };
}
