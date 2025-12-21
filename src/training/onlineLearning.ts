import type { AIParams } from '../agents/algo/aiParams';
import type { GameMetrics } from './metrics';
import { loadParams } from './paramPersistence';

/**
 * 游戏结果接口
 */
export interface GameResult {
  metrics: GameMetrics;
  params: AIParams;
  timestamp: number;
  gameId: string;
  playerId: string;
  fitness: number;
}

// 内存中的游戏结果缓存
const gameResults: GameResult[] = [];

/**
 * 记录游戏结果
 */
export function recordGameResult(result: GameResult): void {
  gameResults.push(result);
  
  // 保存到本地存储（可选）
  try {
    const savedResults = loadGameResults();
    savedResults.push(result);
    localStorage.setItem('ai-mahjong:training:gameResults', JSON.stringify(savedResults));
  } catch (error) {
    console.error('Failed to save game result:', error);
  }
}

/**
 * 从本地存储加载游戏结果
 */
function loadGameResults(): GameResult[] {
  try {
    const saved = localStorage.getItem('ai-mahjong:training:gameResults');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load game results:', error);
    return [];
  }
}

/**
 * 获取在线学习到的参数
 * 这里可以添加更复杂的逻辑来从游戏结果中学习
 */
export function loadOnlineLearnedParams(): AIParams {
  // 简单实现：返回最后保存的参数
  const paramsFile = loadParams();
  return paramsFile.params;
}

/**
 * 获取游戏结果统计信息
 */
export function getGameStats() {
  const results = [...gameResults, ...loadGameResults()];
  
  if (results.length === 0) {
    return {
      totalGames: 0,
      avgFitness: 0,
      winRate: 0,
      avgScore: 0,
      lastUpdated: null
    };
  }

  const wins = results.filter(r => r.metrics.finalScore > 0).length;
  const totalFitness = results.reduce((sum, r) => sum + (r.fitness || 0), 0);
  const totalScore = results.reduce((sum, r) => sum + (r.metrics.finalScore || 0), 0);
  
  return {
    totalGames: results.length,
    avgFitness: totalFitness / results.length,
    winRate: wins / results.length,
    avgScore: totalScore / results.length,
    lastUpdated: new Date(Math.max(...results.map(r => r.timestamp)))
  };
}
