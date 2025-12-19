/**
 * 在线参数优化器
 * 使用随机爬山 + 模拟退火策略
 */

import type { AIParams } from '../agents/algo/aiParams';
import { DEFAULT_PARAMS, PARAM_BOUNDS } from '../agents/algo/aiParams';
import type { GameMetrics } from './metrics';
import { calculateFitness } from './metrics';

export interface OptimizerState {
  currentParams: AIParams;
  bestParams: AIParams;
  currentFitness: number;
  bestFitness: number;
  step: number;
  temperature: number;
  acceptCount: number;
  rejectCount: number;
  rngSeed: number;
}

export interface MutationConfig {
  mutationRate: number; // 每个参数变异的概率 (0-1)
  mutationScale: number; // 变异幅度 (相对于参数范围的比例)
  minMutations: number; // 最少变异参数数量
  maxMutations: number; // 最多变异参数数量
}

export const DEFAULT_MUTATION_CONFIG: MutationConfig = {
  mutationRate: 0.5, // 50% 参数变异 (从30%增加)
  mutationScale: 0.3, // 30% 范围内变异 (从10%大幅增加)
  minMutations: 2, // 最少变异参数数量 (从1增加)
  maxMutations: 8, // 最多变异参数数量 (从5增加)
};

/**
 * 简单的伪随机数生成器（可重现）
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

/**
 * 参数变异：在 bounds 内小幅扰动
 */
export function mutateParams(
  params: AIParams,
  config: MutationConfig = DEFAULT_MUTATION_CONFIG,
  rng: SeededRandom
): AIParams {
  const mutated = { ...params };
  const keys = Object.keys(params) as (keyof AIParams)[];
  
  // 随机选择要变异的参数数量
  const numMutations = rng.nextInt(config.minMutations, config.maxMutations);
  
  // 随机选择要变异的参数
  const shuffled = [...keys].sort(() => rng.next() - 0.5);
  const selectedKeys = shuffled.slice(0, numMutations);
  
  for (const key of selectedKeys) {
    if (rng.next() < config.mutationRate) {
      const bounds = PARAM_BOUNDS[key];
      const range = bounds.max - bounds.min;
      const delta = rng.nextFloat(-range * config.mutationScale, range * config.mutationScale);
      
      let newValue = params[key] + delta;
      
      // 确保在 bounds 内
      newValue = Math.max(bounds.min, Math.min(bounds.max, newValue));
      
      // 对于整数参数，四舍五入
      if (key.includes('Stage') && key.includes('N')) {
        newValue = Math.round(newValue);
      }
      
      mutated[key] = newValue;
    }
  }
  
  return mutated;
}

/**
 * 计算参数差异（用于日志）
 */
export function getParamDiff(
  oldParams: AIParams,
  newParams: AIParams
): Array<{ key: string; from: number; to: number; delta: number }> {
  const diff: Array<{ key: string; from: number; to: number; delta: number }> = [];
  
  for (const key of Object.keys(oldParams) as (keyof AIParams)[]) {
    const from = oldParams[key];
    const to = newParams[key];
    if (Math.abs(from - to) > 0.001) {
      diff.push({
        key,
        from,
        to,
        delta: to - from,
      });
    }
  }
  
  // 按变化幅度排序
  diff.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  
  return diff;
}

/**
 * 在线优化器类
 */
export class OnlineOptimizer {
  private state: OptimizerState;
  private rng: SeededRandom;
  private config: MutationConfig;
  
  constructor(
    initialParams: AIParams = DEFAULT_PARAMS,
    seed: number = Date.now(),
    config: MutationConfig = DEFAULT_MUTATION_CONFIG
  ) {
    this.rng = new SeededRandom(seed);
    this.config = config;
    this.state = {
      currentParams: { ...initialParams },
      bestParams: { ...initialParams },
      currentFitness: -Infinity,
      bestFitness: -Infinity,
      step: 0,
      temperature: 1.0,
      acceptCount: 0,
      rejectCount: 0,
      rngSeed: seed,
    };
  }
  
  getState(): OptimizerState {
    return { ...this.state };
  }
  
  setState(state: OptimizerState): void {
    this.state = { ...state };
    this.rng = new SeededRandom(state.rngSeed);
  }
  
  /**
   * 生成候选参数
   */
  generateCandidate(): AIParams {
    return mutateParams(this.state.currentParams, this.config, this.rng);
  }
  
  /**
   * 更新优化器状态（每局结束后调用）
   */
  update(metrics: GameMetrics, candidateParams: AIParams): {
    accepted: boolean;
    reason: string;
    fitness: number;
    delta: number;
  } {
    const candidateFitness = calculateFitness(metrics);
    const delta = candidateFitness - this.state.currentFitness;
    
    let accepted = false;
    let reason = '';
    
    // 接受规则
    if (this.state.currentFitness === -Infinity) {
      // 第一局，直接接受
      accepted = true;
      reason = 'First game';
    } else if (candidateFitness >= this.state.currentFitness) {
      // 更好或相等，接受
      accepted = true;
      reason = `Better fitness: ${candidateFitness.toFixed(1)} >= ${this.state.currentFitness.toFixed(1)}`;
    } else {
      // 更差，以概率接受（模拟退火）
      const probability = Math.exp(delta / this.state.temperature);
      if (this.rng.next() < probability) {
        accepted = true;
        reason = `Simulated annealing: p=${(probability * 100).toFixed(1)}%`;
      } else {
        accepted = false;
        reason = `Rejected: fitness ${candidateFitness.toFixed(1)} < ${this.state.currentFitness.toFixed(1)}`;
      }
    }
    
    // 更新状态
    if (accepted) {
      this.state.currentParams = { ...candidateParams };
      this.state.currentFitness = candidateFitness;
      this.state.acceptCount++;
      
      // 更新最佳
      if (candidateFitness > this.state.bestFitness) {
        this.state.bestParams = { ...candidateParams };
        this.state.bestFitness = candidateFitness;
      }
    } else {
      this.state.rejectCount++;
    }
    
    // 更新步数和温度
    this.state.step++;
    this.state.temperature = Math.max(0.1, 1.0 / Math.log(this.state.step + 2));
    
    return {
      accepted,
      reason,
      fitness: candidateFitness,
      delta,
    };
  }
  
  /**
   * 重置优化器
   */
  reset(params: AIParams = DEFAULT_PARAMS, seed?: number): void {
    if (seed !== undefined) {
      this.rng = new SeededRandom(seed);
      this.state.rngSeed = seed;
    }
    
    this.state.currentParams = { ...params };
    this.state.bestParams = { ...params };
    this.state.currentFitness = -Infinity;
    this.state.bestFitness = -Infinity;
    this.state.step = 0;
    this.state.temperature = 1.0;
    this.state.acceptCount = 0;
    this.state.rejectCount = 0;
  }
  
  /**
   * 获取训练统计
   */
  getStats(): {
    step: number;
    acceptRate: number;
    bestFitness: number;
    currentFitness: number;
    temperature: number;
  } {
    const total = this.state.acceptCount + this.state.rejectCount;
    const acceptRate = total > 0 ? this.state.acceptCount / total : 0;
    
    return {
      step: this.state.step,
      acceptRate,
      bestFitness: this.state.bestFitness,
      currentFitness: this.state.currentFitness,
      temperature: this.state.temperature,
    };
  }
}
