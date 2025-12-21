/**
 * 并行训练系统 - 使用多线程大幅提高训练速度
 */

import { WorkerPool, type GameResult } from './workerPool';
import { OnlineOptimizer, getParamDiff } from './optimizer';
import { loadParams, saveParams } from './paramPersistence';
import type { GameMetrics } from './metrics';
import type { AIParams } from '../agents/algo/aiParams';

export interface ParallelTrainingConfig {
  totalGames: number;
  batchSize: number;
  workerCount: number;
  verbose: boolean;
}

const DEFAULT_CONFIG: ParallelTrainingConfig = {
  totalGames: 1000,
  batchSize: 20,
  workerCount: 4,
  verbose: false,
};

/**
 * 并行训练器
 */
export class ParallelAutoTrainer {
  private config: ParallelTrainingConfig;
  private optimizer: OnlineOptimizer;
  private pool: WorkerPool;
  private gameCounter = 0;
  private startTime = 0;
  private winCount = 0;
  private drawCount = 0;
  
  constructor(config: Partial<ParallelTrainingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 加载参数
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
      console.log(`[ParallelTrainer] 📂 Resumed from step ${paramsFile.trainingState.currentStep}`);
    }
    
    // 创建Worker池
    this.pool = new WorkerPool({ maxWorkers: this.config.workerCount });
  }
  
  /**
   * 运行并行训练
   */
  async run(): Promise<void> {
    this.startTime = Date.now();
    
    console.log('\n🚀 Parallel Training Started');
    console.log(`   Total Games: ${this.config.totalGames}`);
    console.log(`   Batch Size: ${this.config.batchSize}`);
    console.log(`   Workers: ${this.config.workerCount}`);
    console.log('');
    
    const batchCount = Math.ceil(this.config.totalGames / this.config.batchSize);
    
    for (let batch = 0; batch < batchCount; batch++) {
      const gamesInBatch = Math.min(
        this.config.batchSize,
        this.config.totalGames - batch * this.config.batchSize
      );
      
      // 生成候选参数
      const candidateParams = this.optimizer.generateCandidate();
      
      if (this.config.verbose) {
        const diff = getParamDiff(this.optimizer.getState().currentParams, candidateParams);
        if (diff.length > 0) {
          console.log(`[Batch ${batch + 1}] Params changed: ${diff.length}`);
        }
      }
      
      // 并行运行游戏
      const results = await this.runBatchParallel(candidateParams, gamesInBatch);
      
      // 提取指标
      const batchMetrics = this.extractBatchMetrics(results);
      
      // 更新优化器
      const updateResult = this.optimizer.update(batchMetrics, candidateParams);
      
      // 保存参数
      this.saveProgress(updateResult, batchMetrics);
      
      // 输出进度
      this.logProgress(batch, batchCount, updateResult, results);
    }
    
    await this.pool.shutdown();
    this.logFinalStats();
  }
  
  /**
   * 并行运行一批游戏
   */
  private async runBatchParallel(params: AIParams, count: number): Promise<GameResult[]> {
    return this.pool.runBatch(params, count, (completed) => {
      if (this.config.verbose) {
        process.stdout.write(`\r  Running: ${completed}/${count}`);
      }
    });
  }
  
  /**
   * 从结果中提取指标
   */
  private extractBatchMetrics(results: GameResult[]): GameMetrics[] {
    const metrics: GameMetrics[] = [];
    
    for (const result of results) {
      this.gameCounter++;
      
      if (!result.success || !result.metrics) {
        this.drawCount++;
        continue;
      }
      
      // 统计胜负
      const winners = result.metrics.filter(m => m.didWin);
      if (winners.length > 0) {
        this.winCount++;
        // 只收集赢家指标
        const firstHu = winners.find(m => m.isFirstHu);
        metrics.push(firstHu || winners[0]);
      } else {
        this.drawCount++;
        // 流局：用分数最高的
        const best = result.metrics.reduce((a, b) =>
          a.finalScore > b.finalScore ? a : b
        );
        metrics.push(best);
      }
    }
    
    return metrics;
  }
  
  /**
   * 保存训练进度
   */
  private saveProgress(updateResult: any, batchMetrics: GameMetrics[]): void {
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
          fitness: updateResult.fitness,
          accepted: updateResult.accepted,
          metrics: batchMetrics[batchMetrics.length - 1] || null,
        },
      },
      updatedAt: new Date().toISOString(),
    });
  }
  
  /**
   * 输出进度日志
   */
  private logProgress(batch: number, batchCount: number, updateResult: any, results: GameResult[]): void {
    const state = this.optimizer.getState();
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gps = this.gameCounter / elapsed;
    const progress = ((batch + 1) / batchCount * 100).toFixed(1);
    const status = updateResult.accepted ? '✓' : '✗';
    const winRate = (this.winCount / this.gameCounter * 100).toFixed(1);
    const successRate = (results.filter(r => r.success).length / results.length * 100).toFixed(0);
    
    console.log(
      `[${this.gameCounter}/${this.config.totalGames}] ${progress}% | ` +
      `${status} Fit: ${updateResult.fitness.toFixed(0)} (Best: ${state.bestFitness.toFixed(0)}) | ` +
      `Win: ${winRate}% | Speed: ${gps.toFixed(2)}/s | Success: ${successRate}%`
    );
  }
  
  /**
   * 输出最终统计
   */
  private logFinalStats(): void {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const state = this.optimizer.getState();
    const winRate = (this.winCount / this.gameCounter * 100).toFixed(1);
    const drawRate = (this.drawCount / this.gameCounter * 100).toFixed(1);
    
    console.log('\n✅ Training Complete!');
    console.log(`   Duration: ${totalTime.toFixed(1)}s`);
    console.log(`   Games/sec: ${(this.gameCounter / totalTime).toFixed(2)}`);
    console.log(`   Total Games: ${this.gameCounter}`);
    console.log(`   Win Rate: ${winRate}%`);
    console.log(`   Draw Rate: ${drawRate}%`);
    console.log(`   Best Fitness: ${state.bestFitness.toFixed(0)}`);
    console.log(`   Steps: ${state.step}`);
    console.log(`   Accept Rate: ${(state.acceptCount / (state.acceptCount + state.rejectCount) * 100).toFixed(1)}%`);
  }
}

/**
 * 运行并行训练
 */
export async function runParallelTraining(config: Partial<ParallelTrainingConfig> = {}): Promise<void> {
  const trainer = new ParallelAutoTrainer(config);
  await trainer.run();
}
