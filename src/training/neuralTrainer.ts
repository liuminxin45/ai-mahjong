/**
 * 神经网络训练器
 * 使用强化学习训练麻将AI策略网络
 */

import { MahjongPolicyNetwork, MahjongFeatureExtractor, createDefaultPolicyNetwork } from '../agents/neural/NeuralNetwork';
import { GameOrchestrator } from '../orchestration/GameOrchestrator';
import { chengduRulePack } from '../core/rules/packs/chengdu';
import { testConfig } from '../config/testConfig';
import { settingsStore } from '../store/settingsStore';
import type { PlayerId } from '../core/model/types';
import type { GameState } from '../core/model/state';
import * as fs from 'fs';

export interface NeuralTrainingConfig {
  totalEpisodes: number;
  batchSize: number;
  learningRate: number;
  discountFactor: number;
  explorationRate: number;
  explorationDecay: number;
  minExploration: number;
  saveInterval: number;
  modelPath: string;
}

const DEFAULT_CONFIG: NeuralTrainingConfig = {
  totalEpisodes: 10000,
  batchSize: 32,
  learningRate: 0.001,
  discountFactor: 0.99,
  explorationRate: 1.0,
  explorationDecay: 0.995,
  minExploration: 0.01,
  saveInterval: 100,
  modelPath: './neural-model.json',
};

export interface Experience {
  state: number[];
  action: number;
  reward: number;
  nextState: number[];
  done: boolean;
}

/**
 * 神经网络训练器
 */
export class NeuralTrainer {
  private network: MahjongPolicyNetwork;
  private config: NeuralTrainingConfig;
  private replayBuffer: Experience[] = [];
  private maxBufferSize = 10000;
  private episodeCounter = 0;
  private totalReward = 0;
  private winCount = 0;
  
  constructor(config: Partial<NeuralTrainingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.network = createDefaultPolicyNetwork();
    
    // 尝试加载已有模型
    this.loadModel();
  }
  
  /**
   * 运行训练
   */
  async run(): Promise<void> {
    testConfig.trainingMode = true;
    const startTime = Date.now();
    
    console.log('\n🧠 Neural Network Training Started');
    console.log(`   Episodes: ${this.config.totalEpisodes}`);
    console.log(`   Network Parameters: ${this.network.getParameterCount()}`);
    console.log('');
    
    let exploration = this.config.explorationRate;
    
    for (let ep = 0; ep < this.config.totalEpisodes; ep++) {
      this.episodeCounter++;
      
      // 运行一局游戏并收集经验
      const episodeReward = await this.runEpisode(exploration);
      this.totalReward += episodeReward;
      
      // 从经验回放中学习
      if (this.replayBuffer.length >= this.config.batchSize) {
        this.trainOnBatch();
      }
      
      // 衰减探索率
      exploration = Math.max(
        this.config.minExploration,
        exploration * this.config.explorationDecay
      );
      
      // 输出进度
      if ((ep + 1) % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const eps = (ep + 1) / elapsed;
        const avgReward = this.totalReward / (ep + 1);
        const winRate = (this.winCount / (ep + 1) * 100).toFixed(1);
        
        console.log(
          `[${ep + 1}/${this.config.totalEpisodes}] ` +
          `Reward: ${avgReward.toFixed(1)} | Win: ${winRate}% | ` +
          `Explore: ${(exploration * 100).toFixed(1)}% | Speed: ${eps.toFixed(2)}/s`
        );
      }
      
      // 定期保存模型
      if ((ep + 1) % this.config.saveInterval === 0) {
        this.saveModel();
      }
    }
    
    testConfig.trainingMode = false;
    this.saveModel();
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log('\n✅ Neural Training Complete!');
    console.log(`   Duration: ${totalTime.toFixed(1)}s`);
    console.log(`   Episodes/sec: ${(this.config.totalEpisodes / totalTime).toFixed(2)}`);
    console.log(`   Final Win Rate: ${(this.winCount / this.config.totalEpisodes * 100).toFixed(1)}%`);
  }
  
  /**
   * 运行一局游戏
   */
  private async runEpisode(exploration: number): Promise<number> {
    const orchestrator = new GameOrchestrator(chengduRulePack);
    settingsStore.difficulty = 'high';
    
    (globalThis as any).__trainingGameSeed = Date.now() + this.episodeCounter * 1000000;
    orchestrator.startNewMatch('chengdu');
    
    // 等待游戏结束
    await this.waitForGameEnd(orchestrator);
    
    const state = orchestrator.getState();
    if (!state) return 0;
    
    // 计算奖励
    let reward = 0;
    const playerIds: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
    
    for (const pid of playerIds) {
      if (state.declaredHu[pid]) {
        reward += 100;
        this.winCount++;
        break;
      }
    }
    
    // 获取分数
    const roundScores = (state as GameState & { roundScores?: Record<PlayerId, number> }).roundScores;
    if (roundScores) {
      reward += (roundScores.P0 || 0) / 10;
    }
    
    return reward;
  }
  
  /**
   * 从批次中学习
   */
  private trainOnBatch(): void {
    // 随机采样批次
    const batch: Experience[] = [];
    for (let i = 0; i < this.config.batchSize; i++) {
      const idx = Math.floor(Math.random() * this.replayBuffer.length);
      batch.push(this.replayBuffer[idx]);
    }
    
    // 简化的策略梯度更新（实际应使用更复杂的算法）
    for (const exp of batch) {
      const output = this.network.forward(exp.state);
      const actionProbs = this.softmax(output);
      
      // 计算优势
      const advantage = exp.reward;
      
      // 更新网络权重（简化版本）
      // 实际应该使用反向传播，这里只是示意
      this.updateWeights(exp.state, exp.action, advantage);
    }
  }
  
  /**
   * 更新网络权重（简化版）
   */
  private updateWeights(state: number[], action: number, advantage: number): void {
    // 这是一个简化的权重更新
    // 实际的神经网络训练需要完整的反向传播实现
    const lr = this.config.learningRate;
    const weights = this.network.exportWeights();
    
    // 简单的权重扰动（实际应使用梯度下降）
    for (let l = 0; l < weights.weights.length; l++) {
      for (let i = 0; i < weights.weights[l].length; i++) {
        for (let j = 0; j < weights.weights[l][i].length; j++) {
          weights.weights[l][i][j] += lr * advantage * (Math.random() - 0.5) * 0.01;
        }
      }
    }
    
    this.network.importWeights(weights);
  }
  
  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }
  
  /**
   * 添加经验到回放缓冲区
   */
  addExperience(exp: Experience): void {
    this.replayBuffer.push(exp);
    if (this.replayBuffer.length > this.maxBufferSize) {
      this.replayBuffer.shift();
    }
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
      }, 50);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        orchestrator.stop();
        resolve();
      }, 30000);
    });
  }
  
  /**
   * 保存模型
   */
  saveModel(): void {
    try {
      const data = {
        weights: this.network.exportWeights(),
        config: this.config,
        stats: {
          episodes: this.episodeCounter,
          winCount: this.winCount,
          totalReward: this.totalReward,
        },
      };
      fs.writeFileSync(this.config.modelPath, JSON.stringify(data, null, 2));
      console.log(`[NeuralTrainer] Model saved to ${this.config.modelPath}`);
    } catch (err) {
      console.error('[NeuralTrainer] Failed to save model:', err);
    }
  }
  
  /**
   * 加载模型
   */
  loadModel(): boolean {
    try {
      if (fs.existsSync(this.config.modelPath)) {
        const content = fs.readFileSync(this.config.modelPath, 'utf-8');
        const data = JSON.parse(content);
        this.network.importWeights(data.weights);
        this.episodeCounter = data.stats?.episodes || 0;
        this.winCount = data.stats?.winCount || 0;
        this.totalReward = data.stats?.totalReward || 0;
        console.log(`[NeuralTrainer] Model loaded from ${this.config.modelPath}`);
        return true;
      }
    } catch (err) {
      console.warn('[NeuralTrainer] Failed to load model:', err);
    }
    return false;
  }
  
  /**
   * 获取网络
   */
  getNetwork(): MahjongPolicyNetwork {
    return this.network;
  }
}

/**
 * 运行神经网络训练
 */
export async function runNeuralTraining(config: Partial<NeuralTrainingConfig> = {}): Promise<void> {
  const trainer = new NeuralTrainer(config);
  await trainer.run();
}
