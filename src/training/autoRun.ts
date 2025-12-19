/**
 * 自动跑局训练系统
 * 支持阻塞/非阻塞两种模式
 */

import type { GameOrchestrator } from '../orchestration/GameOrchestrator';
import type { RuleId } from '../store/settingsStore';
import { setAIParams } from '../agents/algo/aiParams';
import { loadParams, saveParams } from './paramPersistence';
import { OnlineOptimizer, getParamDiff } from './optimizer';
import { extractMetrics } from './metrics';
import type { TrainingState } from './paramPersistence';

export interface TrainingConfig {
  totalGames: number;
  blocking: boolean; // true: 阻塞模式（最快），false: 非阻塞模式（UI 友好）
  mode: 'baseline' | 'mirror'; // baseline: 对手用最佳参数，mirror: 所有人用同一参数
  batchSize: number; // 每批次局数（默认 1）
  ruleId: RuleId;
  trainPlayerId: 'P0' | 'P1' | 'P2' | 'P3'; // 训练哪个玩家
  verbose: boolean; // 是否输出详细日志
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  totalGames: 100,
  blocking: false,
  mode: 'baseline',
  batchSize: 1,
  ruleId: 'chengdu',
  trainPlayerId: 'P0',
  verbose: false,
};

export interface TrainingProgress {
  currentGame: number;
  totalGames: number;
  bestFitness: number;
  currentFitness: number;
  acceptRate: number;
  step: number;
  isRunning: boolean;
}

export type TrainingLogger = (log: any) => void;

/**
 * 自动训练器类
 */
export class AutoTrainer {
  private orchestrator: GameOrchestrator;
  private optimizer: OnlineOptimizer;
  private config: TrainingConfig;
  private logger: TrainingLogger;
  private progress: TrainingProgress;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(
    orchestrator: GameOrchestrator,
    config: TrainingConfig = DEFAULT_TRAINING_CONFIG,
    logger: TrainingLogger = console.log
  ) {
    this.orchestrator = orchestrator;
    this.config = { ...DEFAULT_TRAINING_CONFIG, ...config };
    this.logger = logger;
    
    // 加载或初始化优化器
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
        temperature: 1.0 / Math.log(paramsFile.trainingState.currentStep + 2),
        acceptCount: 0,
        rejectCount: 0,
        rngSeed: paramsFile.trainingState.rngSeed,
      });
    }
    
    this.progress = {
      currentGame: 0,
      totalGames: config.totalGames,
      bestFitness: paramsFile.trainingState.bestFitness,
      currentFitness: paramsFile.trainingState.bestFitness,
      acceptRate: 0,
      step: paramsFile.trainingState.currentStep,
      isRunning: false,
    };
  }

  getProgress(): TrainingProgress {
    return { ...this.progress };
  }

  /**
   * 开始训练
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger({ type: 'warning', message: 'Training already running' });
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.progress.isRunning = true;

    this.logger({
      type: 'info',
      message: `Starting training: ${this.config.totalGames} games, mode=${this.config.mode}, blocking=${this.config.blocking}`,
    });

    if (this.config.blocking) {
      await this.runBlocking();
    } else {
      await this.runNonBlocking();
    }

    this.isRunning = false;
    this.progress.isRunning = false;

    this.logger({
      type: 'info',
      message: 'Training completed',
      stats: this.optimizer.getStats(),
    });
  }

  /**
   * 停止训练
   */
  stop(): void {
    this.shouldStop = true;
    this.logger({ type: 'info', message: 'Stopping training...' });
  }

  /**
   * 阻塞模式：紧密循环，最快
   */
  private async runBlocking(): Promise<void> {
    for (let i = 0; i < this.config.totalGames; i++) {
      if (this.shouldStop) break;

      this.progress.currentGame = i + 1;
      await this.runSingleGame();
    }
  }

  /**
   * 非阻塞模式：每局后让出事件循环
   */
  private async runNonBlocking(): Promise<void> {
    for (let i = 0; i < this.config.totalGames; i++) {
      if (this.shouldStop) break;

      this.progress.currentGame = i + 1;
      await this.runSingleGame();

      // 让出事件循环，避免 UI 卡死
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  /**
   * 运行单局游戏
   */
  private async runSingleGame(): Promise<void> {
    // 1. 生成候选参数
    const candidateParams = this.optimizer.generateCandidate();
    const paramDiff = getParamDiff(this.optimizer.getState().currentParams, candidateParams);

    // 2. 设置参数
    setAIParams(candidateParams);

    // 3. 运行游戏
    this.orchestrator.startNewMatch(this.config.ruleId);
    
    // 等待游戏结束（简化版，实际需要监听游戏状态）
    await this.waitForGameEnd();

    // 4. 提取指标
    const state = this.orchestrator.getState();
    if (!state) {
      this.logger({ type: 'error', message: 'No game state available' });
      return;
    }

    const metrics = extractMetrics(state, this.config.trainPlayerId);

    // 5. 更新优化器
    const updateResult = this.optimizer.update(metrics, candidateParams);

    // 6. 保存参数
    const paramsFile = loadParams();
    paramsFile.params = this.optimizer.getState().currentParams;
    paramsFile.trainingState = {
      bestParams: this.optimizer.getState().bestParams,
      bestFitness: this.optimizer.getState().bestFitness,
      currentStep: this.optimizer.getState().step,
      rngSeed: this.optimizer.getState().rngSeed,
      lastResult: {
        fitness: updateResult.fitness,
        accepted: updateResult.accepted,
        metrics,
      },
    };
    saveParams(paramsFile);

    // 7. 更新进度
    const stats = this.optimizer.getStats();
    this.progress.bestFitness = stats.bestFitness;
    this.progress.currentFitness = stats.currentFitness;
    this.progress.acceptRate = stats.acceptRate;
    this.progress.step = stats.step;

    // 8. 输出日志
    this.logTrainingStep(metrics, updateResult, paramDiff, stats);
  }

  /**
   * 等待游戏结束
   */
  private async waitForGameEnd(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const state = this.orchestrator.getState();
        if (!state || state.phase === 'END' || !this.orchestrator.isRunning()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * 输出训练步骤日志
   */
  private logTrainingStep(
    metrics: any,
    updateResult: any,
    paramDiff: any[],
    stats: any
  ): void {
    const log = {
      phase: 'train',
      step: stats.step,
      game: this.progress.currentGame,
      mode: this.config.mode,
      accepted: updateResult.accepted,
      reason: updateResult.reason,
      fitness: {
        current: stats.currentFitness,
        candidate: updateResult.fitness,
        delta: updateResult.delta,
        best: stats.bestFitness,
      },
      metrics: {
        result: metrics.result,
        finalScore: metrics.finalScore,
        isFirstHu: metrics.isFirstHu,
        dealInCount: metrics.dealInCount,
        stageBDealIn: metrics.stageBDealIn,
        avgEV: metrics.avgEV,
        totalTurns: metrics.totalTurns,
      },
      stats: {
        acceptRate: (stats.acceptRate * 100).toFixed(1) + '%',
        temperature: stats.temperature.toFixed(3),
      },
      changedParams: paramDiff.slice(0, 5).map(d => ({
        key: d.key,
        from: d.from.toFixed(2),
        to: d.to.toFixed(2),
        delta: d.delta > 0 ? `+${d.delta.toFixed(2)}` : d.delta.toFixed(2),
      })),
    };

    this.logger(log);

    // 简化版控制台输出
    if (!this.config.verbose) {
      console.log(
        `[${this.progress.currentGame}/${this.config.totalGames}] ` +
        `${updateResult.accepted ? '✓' : '✗'} ` +
        `Fitness: ${updateResult.fitness.toFixed(0)} ` +
        `(Best: ${stats.bestFitness.toFixed(0)}) ` +
        `${metrics.result} ${metrics.isFirstHu ? '🏆' : ''}`
      );
    }
  }
}

/**
 * 全局训练器实例（用于 UI 控制）
 */
let globalTrainer: AutoTrainer | null = null;

export function getGlobalTrainer(): AutoTrainer | null {
  return globalTrainer;
}

export function setGlobalTrainer(trainer: AutoTrainer | null): void {
  globalTrainer = trainer;
}
