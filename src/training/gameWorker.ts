/**
 * 游戏Worker - 在独立线程中运行麻将游戏
 * 用于并行训练
 */

import { parentPort, workerData } from 'worker_threads';
import { GameOrchestrator } from '../orchestration/GameOrchestrator';
import { chengduRulePack } from '../core/rules/packs/chengdu';
import { testConfig } from '../config/testConfig';
import { setAIParams, type AIParams } from '../agents/algo/aiParams';
import { extractMetrics, type GameMetrics } from './metrics';
import type { PlayerId } from '../core/model/types';
import type { GameState } from '../core/model/state';
import { settingsStore } from '../store/settingsStore';

export interface WorkerInput {
  gameId: number;
  params: AIParams;
  seed: number;
}

export interface WorkerOutput {
  success: boolean;
  gameId: number;
  metrics?: GameMetrics[];
  winnerIds?: PlayerId[];
  scores?: Record<PlayerId, number>;
  duration?: number;
  error?: string;
}

async function runGame(): Promise<WorkerOutput> {
  const input = workerData as WorkerInput;
  const startTime = Date.now();
  
  try {
    // 设置训练模式
    testConfig.trainingMode = true;
    setAIParams(input.params);
    settingsStore.difficulty = 'high';
    
    // 设置游戏种子
    (globalThis as any).__trainingGameSeed = input.seed;
    
    // 创建游戏
    const orchestrator = new GameOrchestrator(chengduRulePack);
    orchestrator.startNewMatch('chengdu');
    
    // 等待游戏结束
    await waitForGameEnd(orchestrator);
    
    const state = orchestrator.getState();
    if (!state) {
      return {
        success: false,
        gameId: input.gameId,
        error: 'Game state is null',
      };
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
      success: true,
      gameId: input.gameId,
      metrics,
      winnerIds,
      scores,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      gameId: input.gameId,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startTime,
    };
  }
}

async function waitForGameEnd(orchestrator: GameOrchestrator): Promise<void> {
  return new Promise((resolve) => {
    const maxWait = 60000; // 60秒超时
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      const state = orchestrator.getState();
      if (!state || state.phase === 'END' || !orchestrator.isRunning()) {
        clearInterval(checkInterval);
        resolve();
        return;
      }
      
      if (Date.now() - startTime > maxWait) {
        clearInterval(checkInterval);
        orchestrator.stop();
        resolve();
      }
    }, 50);
  });
}

// Worker入口
if (parentPort) {
  runGame()
    .then(result => parentPort!.postMessage(result))
    .catch(err => parentPort!.postMessage({
      success: false,
      gameId: (workerData as WorkerInput).gameId,
      error: err.message,
    }));
}
