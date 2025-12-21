/**
 * 自动跑局训练系统
 * 支持阻塞/非阻塞两种模式
 */

import type { GameOrchestrator } from '../orchestration/GameOrchestrator';
import type { RuleId } from '../store/settingsStore';
import { settingsStore } from '../store/settingsStore';
import { setAIParams } from '../agents/algo/aiParams';
import { loadParams, saveParams } from './paramPersistence';
import { OnlineOptimizer, getParamDiff } from './optimizer';
import { extractMetrics } from './metrics';
import type { AIParams } from '../agents/algo/aiParams';
import type { GameMetrics } from './metrics';
import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';

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
  batchSize: 10,
  ruleId: 'chengdu',
  trainPlayerId: 'P0',
  verbose: false,
};

const TRAINING_PLAYERS: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];

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
  private gameCounter: number = 0; // 添加游戏计数器
  private pendingBatchMetrics: GameMetrics[] = [];
  private currentCandidateParams: AIParams | null = null;
  private currentParamDiff: Array<{ key: string; from: number; to: number; delta: number }> = [];

  constructor(
    orchestrator: GameOrchestrator,
    config: TrainingConfig = DEFAULT_TRAINING_CONFIG,
    logger: TrainingLogger = console.log,
    seed?: number  // 可选的随机种子
  ) {
    this.orchestrator = orchestrator;
    this.config = { ...DEFAULT_TRAINING_CONFIG, ...config };
    this.logger = logger;
    
    // 加载或初始化优化器
    const paramsFile = loadParams();
    const effectiveSeed = seed ?? paramsFile.trainingState.rngSeed;
    this.optimizer = new OnlineOptimizer(
      paramsFile.params,
      effectiveSeed
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
        rngSeed: effectiveSeed,
      });
      console.log(`[Training] 📂 Resumed training from step ${paramsFile.trainingState.currentStep}, bestFitness=${paramsFile.trainingState.bestFitness.toFixed(0)}`);
    } else {
      console.log('[Training] 🆕 Starting fresh training');
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

    // 自动开启 P0 AI 模式（训练需要 AI vs AI 环境）
    const wasP0AIEnabled = settingsStore.p0IsAI;
    settingsStore.setP0IsAI(true);
    console.log('[Training] Auto-enabled P0 AI mode for training');

    this.isRunning = true;
    this.shouldStop = false;
    this.progress.isRunning = true;

    this.logger({
      type: 'info',
      message: `Starting training: ${this.config.totalGames} games, mode=${this.config.mode}, blocking=${this.config.blocking}`,
    });

    try {
      if (this.config.blocking) {
        await this.runBlocking();
      } else {
        await this.runNonBlocking();
      }
    } finally {
      // 恢复原始的 P0 AI 设置
      settingsStore.setP0IsAI(wasP0AIEnabled);
      console.log('[Training] Restored P0 AI mode to:', wasP0AIEnabled);
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

    if (this.pendingBatchMetrics.length > 0) {
      this.finishBatch();
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

    if (this.pendingBatchMetrics.length > 0) {
      this.finishBatch();
    }
  }

  /**
   * 运行单局游戏
   */
  private async runSingleGame(): Promise<void> {
    // 增加游戏计数器
    this.gameCounter++;
    
    // 1. 生成候选参数（批次开始时）
    if (!this.currentCandidateParams) {
      const candidateParams = this.optimizer.generateCandidate();
      this.currentCandidateParams = candidateParams;
      this.currentParamDiff = getParamDiff(this.optimizer.getState().currentParams, candidateParams);
      
      console.log(`[DEBUG] Game #${this.gameCounter} - Candidate params generated. Changes: ${this.currentParamDiff.length}`);
      if (this.currentParamDiff.length > 0) {
        console.log(`[DEBUG] First change: ${this.currentParamDiff[0].key} ${this.currentParamDiff[0].from} → ${this.currentParamDiff[0].to}`);
      }
    }

    // 2. 设置参数（批次内保持一致）
    // TODO: baseline 模式应该让训练玩家用候选参数，对手用最佳参数
    // 当前实现：所有玩家共享同一套参数（等效于 mirror 模式）
    // 对于自我对弈训练，mirror 模式更能反映参数的整体质量
    setAIParams(this.currentCandidateParams!);

    // 3. 运行游戏
    // 传递唯一的游戏种子
    (globalThis as any).__trainingGameSeed = Date.now() + this.gameCounter * 1000000;
    this.orchestrator.startNewMatch(this.config.ruleId);
    
    // 等待游戏结束（简化版，实际需要监听游戏状态）
    await this.waitForGameEnd();

    // 4. 提取所有4个AI玩家的指标（集体观察）
    const state = this.orchestrator.getState();
    if (!state) {
      this.logger({ type: 'error', message: 'No game state available' });
      return;
    }

    // 提取所有玩家的指标，获得更稳定的训练信号
    const allMetrics: GameMetrics[] = [];
    for (const pid of TRAINING_PLAYERS) {
      const metrics = extractMetrics(state, pid);
      allMetrics.push(metrics);
    }
    
    // 计算集体表现
    const winCount = allMetrics.filter(m => m.didWin).length;
    const avgScore = allMetrics.reduce((s, m) => s + m.finalScore, 0) / 4;
    const firstHuPlayer = allMetrics.find(m => m.isFirstHu)?.playerId || 'none';
    
    console.log(`[Training] Game #${this.gameCounter}: ${winCount}/4 AI won, avgScore=${avgScore.toFixed(0)}, firstHu=${firstHuPlayer}`);
    this.logRoundScores(state);

    // 将所有4个玩家的指标都加入批次
    this.pendingBatchMetrics.push(...allMetrics);

    // 每局产生4个样本，调整批次判断逻辑
    const effectiveBatchSize = this.config.batchSize * 4; // 每局4个样本
    if (
      this.config.batchSize <= 1 ||
      this.pendingBatchMetrics.length >= effectiveBatchSize
    ) {
      this.finishBatch();
    } else {
      console.log(
        `[Training] Batch progress: ${this.pendingBatchMetrics.length}/${effectiveBatchSize} samples`,
      );
    }
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

  private finishBatch(): void {
    if (!this.currentCandidateParams || this.pendingBatchMetrics.length === 0) {
      return;
    }

    const batchMetrics = [...this.pendingBatchMetrics];
    this.pendingBatchMetrics = [];

    // 验证日志：检查批次数据
    const winCount = batchMetrics.filter(m => m.didWin).length;
    const totalScore = batchMetrics.reduce((s, m) => s + m.finalScore, 0);
    console.log(`[Training] 📊 Batch summary: ${batchMetrics.length} samples, ${winCount} wins, totalScore=${totalScore}`);

    const updateResult = this.optimizer.update(batchMetrics, this.currentCandidateParams);
    
    // 验证日志：训练是否生效
    const currentStats = this.optimizer.getStats();
    console.log(
      `[Training] ${updateResult.accepted ? '✅ ACCEPTED' : '❌ REJECTED'} ` +
      `fitness=${updateResult.fitness.toFixed(0)} (delta=${updateResult.delta >= 0 ? '+' : ''}${updateResult.delta.toFixed(0)}) ` +
      `best=${currentStats.bestFitness.toFixed(0)} step=${currentStats.step} temp=${currentStats.temperature.toFixed(3)}`
    );
    
    // 验证日志：参数是否变化
    if (updateResult.accepted && this.currentParamDiff.length > 0) {
      console.log(`[Training] 🔧 Params changed: ${this.currentParamDiff.slice(0, 3).map(d => `${d.key}: ${d.from.toFixed(2)}→${d.to.toFixed(2)}`).join(', ')}`);
    }

    const summaryMetrics = this.buildBatchSummary(batchMetrics, updateResult.fitness);

    const paramsFile = loadParams();
    const optimizerState = this.optimizer.getState();
    paramsFile.params = optimizerState.currentParams;
    paramsFile.trainingState = {
      bestParams: optimizerState.bestParams,
      bestFitness: optimizerState.bestFitness,
      currentStep: optimizerState.step,
      rngSeed: optimizerState.rngSeed,
      acceptCount: optimizerState.acceptCount,
      rejectCount: optimizerState.rejectCount,
      lastResult: {
        fitness: updateResult.fitness,
        accepted: updateResult.accepted,
        metrics: summaryMetrics,
      },
    };
    saveParams(paramsFile);

    const stats = this.optimizer.getStats();
    this.progress.bestFitness = stats.bestFitness;
    this.progress.currentFitness = stats.currentFitness;
    this.progress.acceptRate = stats.acceptRate;
    this.progress.step = stats.step;

    this.logTrainingStep(summaryMetrics, updateResult, this.currentParamDiff, stats);

    this.currentCandidateParams = null;
    this.currentParamDiff = [];
  }

  private buildBatchSummary(batchMetrics: GameMetrics[], fitness: number): any {
    if (batchMetrics.length === 1) {
      return { ...batchMetrics[0], fitness };
    }

    const size = batchMetrics.length;
    const sum = (fn: (m: GameMetrics) => number) =>
      batchMetrics.reduce((acc, m) => acc + fn(m), 0);
    const winCount = batchMetrics.filter((m) => m.didWin).length;

    return {
      ...batchMetrics[batchMetrics.length - 1],
      result: 'BATCH',
      batchSize: size,
      fitness,
      winRate: winCount / size,
      finalScore: sum((m) => m.finalScore) / size,
      dealInCount: sum((m) => m.dealInCount) / size,
      stageBDealIn: sum((m) => m.stageBDealIn) / size,
      stageCDealIn: sum((m) => m.stageCDealIn) / size,
      avgEV: sum((m) => m.avgEV) / size,
      totalTurns: sum((m) => m.totalTurns) / size,
    };
  }

  private logRoundScores(state: GameState): void {
    const extended = state as GameState & {
      roundScores?: Record<PlayerId, number>;
      dealInStats?: Record<PlayerId, { count: number; stageB: number; stageC: number }>;
    };

    if (extended.roundScores) {
      const parts = TRAINING_PLAYERS.map(
        (pid) => `${pid}:${extended.roundScores?.[pid] ?? 0}`,
      );
      console.log(`[SCORES] ${parts.join(' | ')}`);
    } else {
      console.log('[SCORES] roundScores unavailable (rule pack may not report them).');
    }

    if (extended.dealInStats) {
      const dealInParts = TRAINING_PLAYERS.map((pid) => {
        const stat = extended.dealInStats?.[pid];
        if (!stat) return `${pid}:0`;
        return `${pid}:count=${stat.count},B=${stat.stageB},C=${stat.stageC}`;
      });
      console.log(`[DEALINS] ${dealInParts.join(' | ')}`);
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
