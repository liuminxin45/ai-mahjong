/**
 * Worker线程池 - 管理并行游戏执行
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { AIParams } from '../agents/algo/aiParams';
import type { GameMetrics } from './metrics';
import type { PlayerId } from '../core/model/types';
import type { WorkerInput, WorkerOutput } from './gameWorker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PoolConfig {
  maxWorkers: number;
  workerTimeout: number;
}

const DEFAULT_POOL_CONFIG: PoolConfig = {
  maxWorkers: 4,
  workerTimeout: 60000,
};

export interface GameResult {
  gameId: number;
  success: boolean;
  metrics?: GameMetrics[];
  winnerIds?: PlayerId[];
  scores?: Record<PlayerId, number>;
  duration?: number;
  error?: string;
}

/**
 * Worker线程池
 */
export class WorkerPool {
  private config: PoolConfig;
  private activeWorkers: Map<number, Worker> = new Map();
  private pendingTasks: Array<{
    input: WorkerInput;
    resolve: (result: GameResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private gameCounter = 0;
  
  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }
  
  /**
   * 运行单个游戏
   */
  async runGame(params: AIParams): Promise<GameResult> {
    const gameId = ++this.gameCounter;
    const seed = Date.now() + gameId * 1000000;
    
    const input: WorkerInput = { gameId, params, seed };
    
    return new Promise((resolve, reject) => {
      if (this.activeWorkers.size < this.config.maxWorkers) {
        this.startWorker(input, resolve, reject);
      } else {
        this.pendingTasks.push({ input, resolve, reject });
      }
    });
  }
  
  /**
   * 批量运行游戏
   */
  async runBatch(params: AIParams, count: number, onProgress?: (completed: number) => void): Promise<GameResult[]> {
    const results: GameResult[] = [];
    const promises: Promise<GameResult>[] = [];
    
    for (let i = 0; i < count; i++) {
      const promise = this.runGame(params).then(result => {
        results.push(result);
        if (onProgress) {
          onProgress(results.length);
        }
        return result;
      });
      promises.push(promise);
    }
    
    await Promise.all(promises);
    return results.sort((a, b) => a.gameId - b.gameId);
  }
  
  /**
   * 启动Worker
   */
  private startWorker(
    input: WorkerInput,
    resolve: (result: GameResult) => void,
    _reject: (error: Error) => void
  ): void {
    const workerPath = join(__dirname, 'gameWorker.ts');
    
    try {
      const worker = new Worker(workerPath, {
        workerData: input,
        execArgv: ['--loader', 'tsx'],
      });
      
      this.activeWorkers.set(input.gameId, worker);
      
      const timeout = setTimeout(() => {
        worker.terminate();
        this.activeWorkers.delete(input.gameId);
        resolve({
          gameId: input.gameId,
          success: false,
          error: 'Worker timeout',
        });
        this.processNextTask();
      }, this.config.workerTimeout);
      
      worker.on('message', (result: WorkerOutput) => {
        clearTimeout(timeout);
        this.activeWorkers.delete(input.gameId);
        resolve({
          gameId: result.gameId,
          success: result.success,
          metrics: result.metrics,
          winnerIds: result.winnerIds,
          scores: result.scores,
          duration: result.duration,
          error: result.error,
        });
        this.processNextTask();
      });
      
      worker.on('error', (err: Error) => {
        clearTimeout(timeout);
        this.activeWorkers.delete(input.gameId);
        resolve({
          gameId: input.gameId,
          success: false,
          error: err.message,
        });
        this.processNextTask();
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          this.activeWorkers.delete(input.gameId);
        }
      });
    } catch (e) {
      const err = e as Error;
      resolve({
        gameId: input.gameId,
        success: false,
        error: err.message || String(e),
      });
      this.processNextTask();
    }
  }
  
  /**
   * 处理下一个待处理任务
   */
  private processNextTask(): void {
    if (this.pendingTasks.length > 0 && this.activeWorkers.size < this.config.maxWorkers) {
      const task = this.pendingTasks.shift()!;
      this.startWorker(task.input, task.resolve, task.reject);
    }
  }
  
  /**
   * 关闭所有Worker
   */
  async shutdown(): Promise<void> {
    for (const worker of this.activeWorkers.values()) {
      worker.terminate();
    }
    this.activeWorkers.clear();
    this.pendingTasks = [];
  }
  
  /**
   * 获取当前状态
   */
  getStatus(): { activeWorkers: number; pendingTasks: number; totalGames: number } {
    return {
      activeWorkers: this.activeWorkers.size,
      pendingTasks: this.pendingTasks.length,
      totalGames: this.gameCounter,
    };
  }
}
