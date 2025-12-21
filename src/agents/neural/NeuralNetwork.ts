/**
 * 神经网络基础架构
 * 用于麻将AI的深度学习决策系统
 */

export interface LayerConfig {
  inputSize: number;
  outputSize: number;
  activation: 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'linear';
}

export interface NetworkConfig {
  inputSize: number;
  hiddenLayers: number[];
  outputSize: number;
  learningRate: number;
}

/**
 * 简单的神经网络层
 */
export class DenseLayer {
  weights: number[][];
  biases: number[];
  activation: string;
  
  constructor(inputSize: number, outputSize: number, activation: string = 'relu') {
    this.activation = activation;
    this.weights = this.initWeights(inputSize, outputSize);
    this.biases = new Array(outputSize).fill(0);
  }
  
  private initWeights(inputSize: number, outputSize: number): number[][] {
    // Xavier初始化
    const scale = Math.sqrt(2.0 / (inputSize + outputSize));
    return Array.from({ length: outputSize }, () =>
      Array.from({ length: inputSize }, () => (Math.random() * 2 - 1) * scale)
    );
  }
  
  forward(input: number[]): number[] {
    const output = new Array(this.weights.length).fill(0);
    
    for (let i = 0; i < this.weights.length; i++) {
      let sum = this.biases[i];
      for (let j = 0; j < input.length; j++) {
        sum += this.weights[i][j] * input[j];
      }
      output[i] = this.applyActivation(sum);
    }
    
    return output;
  }
  
  private applyActivation(x: number): number {
    switch (this.activation) {
      case 'relu':
        return Math.max(0, x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'tanh':
        return Math.tanh(x);
      case 'linear':
        return x;
      default:
        return x;
    }
  }
}

/**
 * 麻将策略神经网络
 */
export class MahjongPolicyNetwork {
  private layers: DenseLayer[] = [];
  private config: NetworkConfig;
  
  constructor(config: NetworkConfig) {
    this.config = config;
    this.buildNetwork();
  }
  
  private buildNetwork(): void {
    let prevSize = this.config.inputSize;
    
    // 隐藏层
    for (const hiddenSize of this.config.hiddenLayers) {
      this.layers.push(new DenseLayer(prevSize, hiddenSize, 'relu'));
      prevSize = hiddenSize;
    }
    
    // 输出层
    this.layers.push(new DenseLayer(prevSize, this.config.outputSize, 'linear'));
  }
  
  /**
   * 前向传播
   */
  forward(input: number[]): number[] {
    let current = input;
    for (const layer of this.layers) {
      current = layer.forward(current);
    }
    return current;
  }
  
  /**
   * 预测最佳动作
   */
  predict(features: number[]): number {
    const output = this.forward(features);
    let maxIdx = 0;
    let maxVal = output[0];
    for (let i = 1; i < output.length; i++) {
      if (output[i] > maxVal) {
        maxVal = output[i];
        maxIdx = i;
      }
    }
    return maxIdx;
  }
  
  /**
   * 获取动作概率分布（softmax）
   */
  getActionProbabilities(features: number[]): number[] {
    const output = this.forward(features);
    return this.softmax(output);
  }
  
  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }
  
  /**
   * 获取网络参数数量
   */
  getParameterCount(): number {
    let count = 0;
    for (const layer of this.layers) {
      count += layer.weights.length * layer.weights[0].length;
      count += layer.biases.length;
    }
    return count;
  }
  
  /**
   * 导出网络权重
   */
  exportWeights(): { weights: number[][][]; biases: number[][] } {
    return {
      weights: this.layers.map(l => l.weights),
      biases: this.layers.map(l => l.biases),
    };
  }
  
  /**
   * 导入网络权重
   */
  importWeights(data: { weights: number[][][]; biases: number[][] }): void {
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].weights = data.weights[i];
      this.layers[i].biases = data.biases[i];
    }
  }
}

/**
 * 麻将特征提取器
 * 将游戏状态转换为神经网络输入
 */
export class MahjongFeatureExtractor {
  // 特征维度：
  // - 手牌编码: 27维 (每种牌的数量)
  // - 副露编码: 27维
  // - 弃牌编码: 27*4=108维 (4个玩家)
  // - 剩余牌墙: 1维
  // - 当前向听: 1维
  // - 游戏阶段: 3维 (A/B/C)
  static readonly FEATURE_SIZE = 27 + 27 + 108 + 1 + 1 + 3; // = 167
  
  /**
   * 从游戏状态提取特征
   */
  static extract(state: any, playerId: string): number[] {
    const features: number[] = [];
    
    // 手牌编码 (27维)
    const handCounts = new Array(27).fill(0);
    const hand = state.hands[playerId] || [];
    for (const tile of hand) {
      const idx = this.tileToIndex(tile);
      if (idx >= 0 && idx < 27) handCounts[idx]++;
    }
    features.push(...handCounts);
    
    // 副露编码 (27维)
    const meldCounts = new Array(27).fill(0);
    const melds = state.melds[playerId] || [];
    for (const meld of melds) {
      const idx = this.tileToIndex(meld.tile);
      if (idx >= 0 && idx < 27) {
        meldCounts[idx] += meld.type === 'GANG' ? 4 : 3;
      }
    }
    features.push(...meldCounts);
    
    // 各玩家弃牌编码 (108维)
    const playerIds = ['P0', 'P1', 'P2', 'P3'];
    for (const pid of playerIds) {
      const discardCounts = new Array(27).fill(0);
      const discards = state.discards[pid] || [];
      for (const tile of discards) {
        const idx = this.tileToIndex(tile);
        if (idx >= 0 && idx < 27) discardCounts[idx]++;
      }
      features.push(...discardCounts);
    }
    
    // 剩余牌墙 (1维, 归一化到0-1)
    const wallRemaining = (state.wall?.length || 0) / 108;
    features.push(wallRemaining);
    
    // 当前向听 (1维, 归一化)
    // TODO: 实际计算向听数
    features.push(0.5);
    
    // 游戏阶段 (3维 one-hot)
    const wallLen = state.wall?.length || 0;
    const stageA = wallLen > 30 ? 1 : 0;
    const stageB = wallLen <= 30 && wallLen > 10 ? 1 : 0;
    const stageC = wallLen <= 10 ? 1 : 0;
    features.push(stageA, stageB, stageC);
    
    return features;
  }
  
  private static tileToIndex(tile: any): number {
    if (!tile || !tile.suit || !tile.rank) return -1;
    const suitOffset = tile.suit === 'W' ? 0 : tile.suit === 'B' ? 9 : 18;
    return suitOffset + (tile.rank - 1);
  }
}

/**
 * 创建默认的麻将策略网络
 */
export function createDefaultPolicyNetwork(): MahjongPolicyNetwork {
  return new MahjongPolicyNetwork({
    inputSize: MahjongFeatureExtractor.FEATURE_SIZE,
    hiddenLayers: [128, 64, 32],
    outputSize: 34, // 27种牌 + 碰/杠/胡/过等动作
    learningRate: 0.001,
  });
}
