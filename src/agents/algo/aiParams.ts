/**
 * AI 参数配置系统
 * 将所有硬编码常数参数化，支持训练优化
 */

export interface AIParams {
  // P(win) 相关
  xiangtingBase: number;              // 向听数基础系数 (原 0.35)
  pimproveNStageA: number;            // Stage A 进张次数 (原 6)
  pimproveNStageB: number;            // Stage B 进张次数 (原 4)
  stageFactorB: number;               // Stage B 胜率折扣 (原 0.6)
  
  // P(lose) 相关
  basePloseScale: number;             // 基础放炮概率系数 (原 0.3)
  stageFactorPloseB: number;          // Stage B 放炮系数 (原 1.5)
  stageFactorPloseC: number;          // Stage C 放炮系数 (原 3.0)
  gangSideEffectK: number;            // 杠副作用系数 (原 0.2)
  gangPenaltyBCMultiplier: number;    // Stage B/C 杠惩罚倍数 (原 2.0)
  
  // 危险度评估
  genbutsuRiskScale: number;          // 现物风险系数 (原 0.1)
  dingQueRiskScale: number;           // 定缺风险系数 (原 0.3)
  meldSuitRiskScale: number;          // 副露花色风险系数 (原 1.5)
  turnRiskFactor: number;             // 轮次风险因子 (原 1.0 + turn/100)
  
  // Score 相关
  baseWinValue: number;               // 基础胜利价值 (原 1000)
  speedBonusK: number;                // 速度奖励系数 (原 200)
  firstWinBonus: number;              // 先胡奖励 (原 500)
  stageDiscountB: number;             // Stage B 折扣 (原 0.7)
  
  // Loss 相关
  baseLoss: number;                   // 基础损失 (原 1500)
  stageMultiplierA: number;           // Stage A 损失系数 (原 2.0)
  stageMultiplierB: number;           // Stage B 损失系数 (原 1.5)
  stageMultiplierC: number;           // Stage C 损失系数 (原 3.0)
  oppNotHuMultiplier: number;         // 对手未胡系数 (原 1.5)
  oppMeldMultiplierK: number;         // 对手副露系数 (原 0.1)
  
  // 碰/杠信息暴露惩罚
  informationPenaltyPengA: number;    // Stage A 碰惩罚 (原 100)
  informationPenaltyPengB: number;    // Stage B 碰惩罚 (原 150)
  informationPenaltyGangA: number;    // Stage A 杠惩罚 (原 100)
  informationPenaltyGangB: number;    // Stage B 杠惩罚 (原 200)
}

export const DEFAULT_PARAMS: AIParams = {
  xiangtingBase: 0.35,
  pimproveNStageA: 6,
  pimproveNStageB: 4,
  stageFactorB: 0.6,
  
  basePloseScale: 0.3,
  stageFactorPloseB: 1.5,
  stageFactorPloseC: 3.0,
  gangSideEffectK: 0.2,
  gangPenaltyBCMultiplier: 2.0,
  
  genbutsuRiskScale: 0.1,
  dingQueRiskScale: 0.3,
  meldSuitRiskScale: 1.5,
  turnRiskFactor: 0.01,
  
  baseWinValue: 1000,
  speedBonusK: 200,
  firstWinBonus: 500,
  stageDiscountB: 0.7,
  
  baseLoss: 1500,
  stageMultiplierA: 2.0,
  stageMultiplierB: 1.5,
  stageMultiplierC: 3.0,
  oppNotHuMultiplier: 1.5,
  oppMeldMultiplierK: 0.1,
  
  informationPenaltyPengA: 100,
  informationPenaltyPengB: 150,
  informationPenaltyGangA: 100,
  informationPenaltyGangB: 200,
};

export const PARAM_BOUNDS: Record<keyof AIParams, { min: number; max: number }> = {
  xiangtingBase: { min: 0.2, max: 0.5 },
  pimproveNStageA: { min: 4, max: 8 },
  pimproveNStageB: { min: 2, max: 6 },
  stageFactorB: { min: 0.4, max: 0.8 },
  
  basePloseScale: { min: 0.1, max: 0.5 },
  stageFactorPloseB: { min: 1.0, max: 2.0 },
  stageFactorPloseC: { min: 2.0, max: 4.0 },
  gangSideEffectK: { min: 0.1, max: 0.4 },
  gangPenaltyBCMultiplier: { min: 1.5, max: 3.0 },
  
  genbutsuRiskScale: { min: 0.05, max: 0.2 },
  dingQueRiskScale: { min: 0.2, max: 0.5 },
  meldSuitRiskScale: { min: 1.2, max: 2.0 },
  turnRiskFactor: { min: 0.005, max: 0.02 },
  
  baseWinValue: { min: 500, max: 1500 },
  speedBonusK: { min: 100, max: 300 },
  firstWinBonus: { min: 300, max: 700 },
  stageDiscountB: { min: 0.5, max: 0.9 },
  
  baseLoss: { min: 1000, max: 2000 },
  stageMultiplierA: { min: 1.5, max: 2.5 },
  stageMultiplierB: { min: 1.0, max: 2.0 },
  stageMultiplierC: { min: 2.5, max: 4.0 },
  oppNotHuMultiplier: { min: 1.2, max: 2.0 },
  oppMeldMultiplierK: { min: 0.05, max: 0.2 },
  
  informationPenaltyPengA: { min: 50, max: 150 },
  informationPenaltyPengB: { min: 100, max: 250 },
  informationPenaltyGangA: { min: 50, max: 150 },
  informationPenaltyGangB: { min: 150, max: 300 },
};

// 全局参数实例（模块单例）
let currentParams: AIParams = { ...DEFAULT_PARAMS };

export function getAIParams(): AIParams {
  return currentParams;
}

export function setAIParams(params: AIParams): void {
  currentParams = { ...params };
}

export function resetAIParams(): void {
  currentParams = { ...DEFAULT_PARAMS };
}
