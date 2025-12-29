/**
 * 在线学习系统
 * 在正常对局中根据P1-P3的集体表现调整AI参数
 * 
 * 学习策略：
 * - 观察P1-P3三个AI玩家的集体表现（不是单个玩家）
 * - 计算整体胜率、平均排名、平均得分
 * - 基于集体表现调整参数
 * - 参数以"增量"形式存储，叠加在训练参数之上
 */

import { getAIParams, setAIParams, PARAM_BOUNDS, type AIParams } from '../agents/algo/aiParams';
import { loadParams, saveParams } from './paramPersistence';

export interface GameResult {
  playerId: string;
  isWinner: boolean;
  rank: number;        // 1-4, 1是第一名
  scoreChange: number; // 得失分
  turn: number;        // 游戏回合数
}

export interface OnlineLearningConfig {
  enabled: boolean;
  learningRate: number;      // 学习率 (0.01-0.1)
  minGamesForUpdate: number; // 最少多少局后才更新
  maxDelta: number;          // 单次最大变化比例
}

const DEFAULT_CONFIG: OnlineLearningConfig = {
  enabled: true,
  learningRate: 0.02,
  minGamesForUpdate: 1,
  maxDelta: 0.05,
};

// 存储参数增量（相对于基础参数的调整）
interface ParamDeltas {
  [key: string]: number;  // 参数名 -> 增量值
}

// 存储游戏结果历史
interface LearningState {
  gamesPlayed: number;
  totalWins: number;       // P1-P3 总胜场
  totalLosses: number;     // P1-P3 最后一名次数
  recentResults: GameResult[];
  lastUpdateGame: number;
  paramDeltas: ParamDeltas; // 参数增量
}

let learningState: LearningState = {
  gamesPlayed: 0,
  totalWins: 0,
  totalLosses: 0,
  recentResults: [],
  lastUpdateGame: 0,
  paramDeltas: {},
};

let config: OnlineLearningConfig = { ...DEFAULT_CONFIG };

/**
 * 设置在线学习配置
 */
export function setOnlineLearningConfig(newConfig: Partial<OnlineLearningConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * 获取在线学习配置
 */
export function getOnlineLearningConfig(): OnlineLearningConfig {
  return { ...config };
}

/**
 * 重置学习状态
 */
export function resetLearningState(): void {
  learningState = {
    gamesPlayed: 0,
    totalWins: 0,
    totalLosses: 0,
    recentResults: [],
    lastUpdateGame: 0,
    paramDeltas: {},
  };
}

/**
 * 记录游戏结果并触发学习
 */
export function recordGameResult(results: GameResult[]): void {
  if (!config.enabled) return;
  
  learningState.gamesPlayed++;
  
  // 统计AI玩家(P1-P3)的结果
  const aiResults = results.filter(r => r.playerId !== 'P0');
  
  for (const result of aiResults) {
    if (result.isWinner) {
      learningState.totalWins++;
    } else if (result.rank === 4) {
      learningState.totalLosses++;
    }
    learningState.recentResults.push(result);
  }
  
  // 保持最近20局的结果
  if (learningState.recentResults.length > 60) {
    learningState.recentResults = learningState.recentResults.slice(-60);
  }
  
  // 检查是否需要更新参数
  const gamesSinceUpdate = learningState.gamesPlayed - learningState.lastUpdateGame;
  if (gamesSinceUpdate >= config.minGamesForUpdate) {
    updateParamsFromResults();
    learningState.lastUpdateGame = learningState.gamesPlayed;
  }
}

/**
 * 根据P1-P3集体表现调整参数
 * 
 * 学习逻辑：
 * - P1-P3共享同一套参数，观察他们的集体表现
 * - 如果整体胜率低，说明参数不够激进
 * - 如果整体排名靠后，说明防守不足
 * - 参数调整以增量形式累积
 */
function updateParamsFromResults(): void {
  const recentResults = learningState.recentResults;
  if (recentResults.length === 0) return;
  
  const currentParams = getAIParams();
  const newParams = { ...currentParams };
  
  // 计算P1-P3的集体表现指标
  const aiResults = recentResults.filter(r => r.playerId !== 'P0');
  if (aiResults.length === 0) return;
  
  const winRate = aiResults.filter(r => r.isWinner).length / aiResults.length;
  const avgRank = aiResults.reduce((sum, r) => sum + r.rank, 0) / aiResults.length;
  const avgScoreChange = aiResults.reduce((sum, r) => sum + r.scoreChange, 0) / aiResults.length;
  
  console.log(`[OnlineLearning] 📊 P1-P3 集体表现: 胜率=${(winRate * 100).toFixed(1)}%, 平均排名=${avgRank.toFixed(2)}, 平均得分=${avgScoreChange.toFixed(0)}`);
  console.log(`[OnlineLearning] 📈 统计: ${learningState.gamesPlayed}局, AI胜${learningState.totalWins}场`);
  
  // 根据表现调整参数
  const lr = config.learningRate;
  const maxDelta = config.maxDelta;
  let adjusted = false;
  
  // 策略1: 胜率太低 (P0人类经常赢) -> AI需要更激进
  if (winRate < 0.2) {
    accumulateDelta('baseWinValue', lr * 1.5, maxDelta);
    accumulateDelta('speedBonusK', lr, maxDelta);
    accumulateDelta('firstWinBonus', lr, maxDelta);
    console.log('[OnlineLearning] 🔥 AI胜率低，增加进攻性');
    adjusted = true;
  }
  
  // 策略2: 胜率高但得分低 -> 优化得分效率
  if (winRate > 0.25 && avgScoreChange < 0) {
    accumulateDelta('baseLoss', -lr * 0.5, maxDelta);
    accumulateDelta('speedBonusK', lr, maxDelta);
    console.log('[OnlineLearning] ⚡ AI胜率好但得分低，优化效率');
    adjusted = true;
  }
  
  // 策略3: 排名靠后 -> 增加防守
  if (avgRank > 2.8) {
    accumulateDelta('baseLoss', lr, maxDelta);
    accumulateDelta('genbutsuRiskScale', -lr * 0.3, maxDelta);
    console.log('[OnlineLearning] 🛡️ AI排名靠后，增加防守');
    adjusted = true;
  }
  
  // 策略4: 表现良好 -> 小幅随机探索
  if (winRate >= 0.25 && avgRank <= 2.5) {
    const keys: (keyof AIParams)[] = ['xiangtingBase', 'stageFactorB', 'stageDiscountB'];
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const direction = Math.random() > 0.5 ? 1 : -1;
    accumulateDelta(randomKey, lr * 0.3 * direction, maxDelta);
    console.log(`[OnlineLearning] 🎲 AI表现好，探索调整 ${randomKey}`);
    adjusted = true;
  }
  
  if (adjusted) {
    // 应用累积的增量到当前参数
    applyDeltas(newParams);
    setAIParams(newParams);
    
    // 保存增量到 localStorage（而不是完整参数）
    saveDeltas();
  }
}

/**
 * 累积参数增量
 */
function accumulateDelta(key: string, delta: number, maxDelta: number): void {
  const bounds = PARAM_BOUNDS[key as keyof AIParams];
  if (!bounds) return;
  
  const range = bounds.max - bounds.min;
  const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta)) * range;
  
  // 累积增量
  const currentDelta = learningState.paramDeltas[key] || 0;
  const newDelta = currentDelta + clampedDelta;
  
  // 限制总增量不超过范围的20%
  const maxTotalDelta = range * 0.2;
  learningState.paramDeltas[key] = Math.max(-maxTotalDelta, Math.min(maxTotalDelta, newDelta));
}

/**
 * 将累积的增量应用到参数
 */
function applyDeltas(params: AIParams): void {
  for (const [key, delta] of Object.entries(learningState.paramDeltas)) {
    const paramKey = key as keyof AIParams;
    const bounds = PARAM_BOUNDS[paramKey];
    if (!bounds) continue;
    
    const current = params[paramKey];
    const newValue = current + delta;
    (params as any)[paramKey] = Math.max(bounds.min, Math.min(bounds.max, newValue));
  }
}

/**
 * 保存增量到 localStorage 和 ai-params.json
 */
function saveDeltas(): void {
  // 1. 保存增量到 localStorage（用于快速恢复）
  try {
    const data = {
      deltas: learningState.paramDeltas,
      gamesPlayed: learningState.gamesPlayed,
      totalWins: learningState.totalWins,
    };
    localStorage.setItem('ai-params-online-deltas', JSON.stringify(data));
  } catch (e) {
    // localStorage 可能不可用
  }
  
  // 2. 同步保存到 ai-params.json（持久化）
  try {
    const paramsFile = loadParams();
    const currentParams = getAIParams();
    
    // 更新参数文件中的参数
    paramsFile.params = { ...currentParams };
    
    // 添加在线学习统计信息
    (paramsFile as any).onlineLearning = {
      gamesPlayed: learningState.gamesPlayed,
      totalWins: learningState.totalWins,
      paramDeltas: learningState.paramDeltas,
      lastUpdated: new Date().toISOString(),
    };
    
    saveParams(paramsFile);
    console.log(`[OnlineLearning] 💾 保存到 ai-params.json (${learningState.gamesPlayed}局, AI胜${learningState.totalWins}场)`);
  } catch (e) {
    console.warn('[OnlineLearning] ⚠️ 保存到 ai-params.json 失败:', e);
  }
}

/**
 * 从 localStorage 或 ai-params.json 加载在线学习的增量，并叠加到当前参数上
 */
export function loadOnlineLearnedParams(): boolean {
  let data: any = null;
  
  // 1. 优先从 localStorage 加载（更快）
  try {
    const saved = localStorage.getItem('ai-params-online-deltas');
    if (saved) {
      data = JSON.parse(saved);
    }
  } catch (e) {
    // localStorage 加载失败
  }
  
  // 2. 如果 localStorage 没有，尝试从 ai-params.json 加载
  if (!data || !data.deltas) {
    try {
      const paramsFile = loadParams();
      const onlineLearning = (paramsFile as any).onlineLearning;
      if (onlineLearning && onlineLearning.paramDeltas) {
        data = {
          deltas: onlineLearning.paramDeltas,
          gamesPlayed: onlineLearning.gamesPlayed || 0,
          totalWins: onlineLearning.totalWins || 0,
        };
        console.log('[OnlineLearning] 📂 从 ai-params.json 加载在线学习数据');
      }
    } catch (e) {
      // ai-params.json 加载失败
    }
  }
  
  // 3. 应用增量
  if (data && data.deltas && Object.keys(data.deltas).length > 0) {
    // 恢复学习状态
    learningState.paramDeltas = data.deltas;
    learningState.gamesPlayed = data.gamesPlayed || 0;
    learningState.totalWins = data.totalWins || 0;
    
    // 将增量应用到当前参数上（叠加）
    const currentParams = getAIParams();
    const newParams = { ...currentParams };
    applyDeltas(newParams);
    setAIParams(newParams);
    
    const deltaCount = Object.keys(data.deltas).length;
    console.log(`[OnlineLearning] ✅ 加载${deltaCount}个参数增量，叠加到训练参数上`);
    console.log(`[OnlineLearning] 📈 历史: ${data.gamesPlayed || 0}局, AI胜${data.totalWins || 0}场`);
    return true;
  }
  
  return false;
}

/**
 * 获取学习状态统计
 */
export function getLearningStats(): {
  gamesPlayed: number;
  winRate: number;
  avgRank: number;
} {
  const aiResults = learningState.recentResults.filter(r => r.playerId !== 'P0');
  const winRate = aiResults.length > 0 
    ? aiResults.filter(r => r.isWinner).length / aiResults.length 
    : 0;
  const avgRank = aiResults.length > 0
    ? aiResults.reduce((sum, r) => sum + r.rank, 0) / aiResults.length
    : 2.5;
  
  return {
    gamesPlayed: learningState.gamesPlayed,
    winRate,
    avgRank,
  };
}
