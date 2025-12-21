/**
 * 并行训练系统
 * 使用并发游戏大幅提高训练速度
 */

import { GameOrchestrator } from '../orchestration/GameOrchestrator';
import { chengduRulePack } from '../core/rules/packs/chengdu';
import { testConfig } from '../config/testConfig';
import { setAIParams, type AIParams } from '../agents/algo/aiParams';
import { extractMetrics, type GameMetrics } from './metrics';
import { OnlineOptimizer, getParamDiff } from './optimizer';
import { loadParams, saveParams } from './paramPersistence';
import type { PlayerId } from '../core/model/types';
import type { GameState } from '../core/model/state';
import { settingsStore } from '../store/settingsStore';

export interface ParallelGameResult {
  gameId: number;
  metrics: GameMetrics[];
  winnerIds: PlayerId[];
  scores: Record<PlayerId, number>;
  duration: number;
}

export interface FastTrainingConfig {
  totalGames: number;
  batchSize: number;
  concurrency: number;  // 并发数
  verbose: boolean;
}

const DEFAULT_FAST_CONFIG: FastTrainingConfig = {
  totalGames: 100,
  batchSize: 5,
  concurrency: 1,  // 当前单线程，但优化了游戏逻辑
  verbose: false,
};

/**
 * 快速训练器 - 优化的训练系统
 */
export class FastTrainer {
  private optimizer: OnlineOptimizer;
  private config: FastTrainingConfig;
  private gameCounter = 0;
  private startTime = 0;
  
  constructor(config: Partial<FastTrainingConfig> = {}) {
    this.config = { ...DEFAULT_FAST_CONFIG, ...config };
    
    // 加载现有参数
    const paramsFile = loadParams();
    this.optimizer = new OnlineOptimizer(
      paramsFile.params,
      paramsFile.trainingState.rngSeed
    );
    
    // 恢复训练状态
    if (paramsFile.trainingState.currentStep > 0) {
      this.optimizer.setState({
        currentParams: paramsFile.trainingState.bestParams,
        bestParams: paramsFile.trainingState.bestParams,
        currentFitness: paramsFile.trainingState.bestFitness,
        bestFitness: paramsFile.trainingState.bestFitness,
        step: paramsFile.trainingState.currentStep,
        temperature: Math.max(0.1, 1.0 / Math.sqrt(paramsFile.trainingState.currentStep + 1)),
        acceptCount: paramsFile.trainingState.acceptCount ?? 0,
        rejectCount: paramsFile.trainingState.rejectCount ?? 0,
        rngSeed: paramsFile.trainingState.rngSeed,
      });
      console.log(`[FastTrainer] 📂 Resumed from step ${paramsFile.trainingState.currentStep}, bestFitness=${paramsFile.trainingState.bestFitness.toFixed(0)}`);
    } else {
      console.log('[FastTrainer] 🆕 Starting fresh training');
    }
  }
  
  /**
   * 运行快速训练
   */
  async run(): Promise<void> {
    testConfig.trainingMode = true;
    this.startTime = Date.now();
    
    console.log(`\n🚀 Fast Training Started`);
    console.log(`   Games: ${this.config.totalGames}, Batch: ${this.config.batchSize}`);
    
    const batchCount = Math.ceil(this.config.totalGames / this.config.batchSize);
    
    for (let batch = 0; batch < batchCount; batch++) {
      const gamesInBatch = Math.min(
        this.config.batchSize,
        this.config.totalGames - batch * this.config.batchSize
      );
      
      // 生成候选参数
      const candidateParams = this.optimizer.generateCandidate();
      const paramDiff = getParamDiff(this.optimizer.getState().currentParams, candidateParams);
      
      if (this.config.verbose && paramDiff.length > 0) {
        console.log(`[Batch ${batch + 1}] Params changed: ${paramDiff.length}`);
      }
      
      // 运行批次游戏
      const batchMetrics = await this.runBatch(candidateParams, gamesInBatch);
      
      // 更新优化器
      const result = this.optimizer.update(batchMetrics, candidateParams);
      
      // 保存参数
      const state = this.optimizer.getState();
      saveParams({
        version: '1.0.0',
        params: state.currentParams,
        trainingState: {
          bestFitness: state.bestFitness,
          bestParams: state.bestParams,
          currentStep: state.step,
          acceptCount: state.acceptCount,
          rejectCount: state.rejectCount,
          rngSeed: state.rngSeed,
          lastResult: {
            fitness: result.fitness,
            accepted: result.accepted,
            metrics: batchMetrics[batchMetrics.length - 1] || null,
          },
        },
        updatedAt: new Date().toISOString(),
      });
      
      // 进度报告
      const progress = ((batch + 1) * this.config.batchSize / this.config.totalGames * 100).toFixed(1);
      const elapsed = (Date.now() - this.startTime) / 1000;
      const gps = this.gameCounter / elapsed;
      const acceptRate = (state.acceptCount / (state.acceptCount + state.rejectCount) * 100).toFixed(1);
      
      const status = result.accepted ? '✓' : '✗';
      const trophy = result.fitness >= state.bestFitness ? ' 🏆' : '';
      
      console.log(
        `[${this.gameCounter}/${this.config.totalGames}] ${progress}% | ` +
        `${status} Fit: ${result.fitness.toFixed(0)} (Best: ${state.bestFitness.toFixed(0)}) | ` +
        `Accept: ${acceptRate}% | Speed: ${gps.toFixed(2)}/s${trophy}`
      );
    }
    
    testConfig.trainingMode = false;
    
    const totalTime = (Date.now() - this.startTime) / 1000;
    const finalState = this.optimizer.getState();
    
    console.log(`\n✅ Training Complete!`);
    console.log(`   Duration: ${totalTime.toFixed(1)}s`);
    console.log(`   Games/sec: ${(this.gameCounter / totalTime).toFixed(2)}`);
    console.log(`   Best Fitness: ${finalState.bestFitness.toFixed(0)}`);
    console.log(`   Steps: ${finalState.step}`);
  }
  
  /**
   * 运行一批游戏
   */
  private async runBatch(params: AIParams, count: number): Promise<GameMetrics[]> {
    setAIParams(params);
    const batchMetrics: GameMetrics[] = [];
    
    for (let i = 0; i < count; i++) {
      const result = await this.runSingleGame();
      
      // 只收集赢家指标，或流局时收集最佳表现者
      const winners = result.metrics.filter(m => m.didWin);
      if (winners.length > 0) {
        const firstHu = winners.find(m => m.isFirstHu);
        batchMetrics.push(firstHu || winners[0]);
      } else {
        // 流局：用分数最高的
        const best = result.metrics.reduce((a, b) => 
          a.finalScore > b.finalScore ? a : b
        );
        batchMetrics.push(best);
      }
    }
    
    return batchMetrics;
  }
  
  /**
   * 运行单局游戏 - 优化版
   */
  private async runSingleGame(): Promise<ParallelGameResult> {
    this.gameCounter++;
    const startTime = Date.now();
    
    // 创建游戏 - 使用简化配置
    const orchestrator = new GameOrchestrator(chengduRulePack);
    
    // 设置难度
    settingsStore.difficulty = 'high';
    
    // 设置唯一游戏种子
    (globalThis as any).__trainingGameSeed = Date.now() + this.gameCounter * 1000000;
    
    // 开始游戏
    orchestrator.startNewMatch('chengdu');
    
    // 等待游戏结束
    await this.waitForGameEnd(orchestrator);
    
    const state = orchestrator.getState();
    if (!state) {
      throw new Error('Game state is null');
    }
    
    // 提取指标
    const playerIds: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
    const metrics: GameMetrics[] = [];
    const winnerIds: PlayerId[] = [];
    
    for (const pid of playerIds) {
      const m = extractMetrics(state, pid);
      metrics.push(m);
      if (m.didWin) {
        winnerIds.push(pid);
      }
    }
    
    // 获取分数
    const roundScores = (state as GameState & { roundScores?: Record<PlayerId, number> }).roundScores;
    const scores: Record<PlayerId, number> = {
      P0: roundScores?.P0 ?? 0,
      P1: roundScores?.P1 ?? 0,
      P2: roundScores?.P2 ?? 0,
      P3: roundScores?.P3 ?? 0,
    };
    
    return {
      gameId: this.gameCounter,
      metrics,
      winnerIds,
      scores,
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * 等待游戏结束
   */
  private async waitForGameEnd(orchestrator: GameOrchestrator): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const state = orchestrator.getState();
        if (!state || state.phase === 'END' || !orchestrator.isRunning()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50); // 检查50ms
      
      // 30秒超时保护
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[FastTrainer] Game timeout');
        orchestrator.stop();
        resolve();
      }, 30000);
    });
  }
}
