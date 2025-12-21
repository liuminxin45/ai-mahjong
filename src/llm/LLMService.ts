/**
 * LLM服务核心
 * 统一管理LLM API调用、缓存和响应解析
 */

import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import type { Action } from '../core/model/action';
import type { 
  LLMConfig, 
  CoachingAdvice, 
  GameReview, 
  UserProfile,
  Commentary,
  OpponentPrediction,
  GuidanceLevel,
  CommentaryStyle,
} from './types';
import { DEFAULT_LLM_CONFIG } from './types';
import { PromptBuilder } from './PromptBuilder';

// 简单的内存缓存
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * LLM服务类
 */
export class LLMService {
  private config: LLMConfig;
  
  constructor(config: Partial<LLMConfig> = {}) {
    this.config = { ...DEFAULT_LLM_CONFIG, ...config };
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }
  
  /**
   * 核心查询方法
   */
  async query(prompt: string, options: { useCache?: boolean } = {}): Promise<string> {
    const { useCache = this.config.cacheEnabled } = options;
    
    // 检查缓存
    if (useCache) {
      const cacheKey = this.getCacheKey(prompt);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        console.log('[LLM] Cache hit');
        return cached.data;
      }
    }
    
    // 调用API
    const response = await this.callAPI(prompt);
    
    // 存入缓存
    if (useCache) {
      const cacheKey = this.getCacheKey(prompt);
      cache.set(cacheKey, { data: response, timestamp: Date.now() });
    }
    
    return response;
  }
  
  /**
   * 流式查询（用于长响应）
   */
  async streamQuery(
    prompt: string, 
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // 简化实现：非流式返回
    const response = await this.query(prompt, { useCache: false });
    onChunk(response);
    return response;
  }
  
  /**
   * 获取出牌建议
   */
  async getCoachingAdvice(
    state: GameState,
    playerId: PlayerId,
    legalActions: Action[],
    level: GuidanceLevel = 'learning'
  ): Promise<CoachingAdvice> {
    const prompt = PromptBuilder.buildCoachingPrompt(state, playerId, legalActions, level);
    const response = await this.query(prompt);
    return this.parseJSON<CoachingAdvice>(response, this.getDefaultCoachingAdvice(legalActions));
  }
  
  /**
   * 获取换三张建议
   */
  async getExchangeAdvice(
    hand: Array<{ suit: string; rank: number }>,
    level: GuidanceLevel = 'learning'
  ): Promise<{
    recommendedTiles: string[];
    selectedSuit: string;
    reasoning: string;
    afterExchangePlan: string;
  }> {
    const prompt = PromptBuilder.buildExchangePrompt(hand as any, level);
    const response = await this.query(prompt, { useCache: false });
    return this.parseJSON(response, {
      recommendedTiles: [],
      selectedSuit: '条',
      reasoning: '选择张数最少的花色',
      afterExchangePlan: '换牌后根据手牌情况定缺',
    });
  }
  
  /**
   * 获取定缺建议
   */
  async getDingQueAdvice(
    hand: Array<{ suit: string; rank: number }>,
    level: GuidanceLevel = 'learning'
  ): Promise<{
    recommendedSuit: string;
    confidence: number;
    reasoning: string;
    suitRanking: Array<{ suit: string; difficulty: string; reason: string }>;
    playPlan: string;
  }> {
    const prompt = PromptBuilder.buildDingQuePrompt(hand as any, level);
    const response = await this.query(prompt, { useCache: false });
    return this.parseJSON(response, {
      recommendedSuit: '条',
      confidence: 0.7,
      reasoning: '选择张数最少、最容易打完的花色',
      suitRanking: [],
      playPlan: '优先打掉定缺花色的牌',
    });
  }
  
  /**
   * 生成对局复盘
   */
  async generateReview(
    gameRecord: any,
    keyDecisions: Array<{ turn: number; action: Action; state: GameState }>
  ): Promise<GameReview> {
    const prompt = PromptBuilder.buildReviewPrompt(gameRecord, keyDecisions);
    const response = await this.query(prompt, { useCache: false });
    return this.parseJSON<GameReview>(response, this.getDefaultReview(gameRecord));
  }
  
  /**
   * 分析用户画像
   */
  async analyzeProfile(stats: {
    totalGames: number;
    winRate: number;
    avgDealIn: number;
    avgShanten: number;
    meldFrequency: number;
    commonMistakes: string[];
  }): Promise<Partial<UserProfile>> {
    const prompt = PromptBuilder.buildProfilePrompt(stats);
    const response = await this.query(prompt);
    return this.parseJSON<Partial<UserProfile>>(response, {});
  }
  
  /**
   * 问答助手
   */
  async answerQuestion(
    question: string,
    context?: { gameState?: GameState; history?: string[] }
  ): Promise<string> {
    const prompt = PromptBuilder.buildQAPrompt(question, context);
    return await this.query(prompt, { useCache: false });
  }
  
  /**
   * 生成解说
   */
  async generateCommentary(
    event: { type: string; playerId?: PlayerId; tile?: any; state: GameState },
    style: CommentaryStyle = 'professional'
  ): Promise<Commentary> {
    const prompt = PromptBuilder.buildCommentaryPrompt(event, style);
    const response = await this.query(prompt);
    return this.parseJSON<Commentary>(response, {
      type: 'analysis',
      text: `${event.playerId || '玩家'}进行了${event.type}操作`,
      emotion: 'calm',
      timestamp: Date.now(),
    });
  }
  
  /**
   * 预测对手
   */
  async predictOpponent(
    state: GameState,
    targetPlayer: PlayerId
  ): Promise<OpponentPrediction> {
    const prompt = PromptBuilder.buildOpponentPredictionPrompt(state, targetPlayer);
    const response = await this.query(prompt);
    return this.parseJSON<OpponentPrediction>(response, this.getDefaultOpponentPrediction(targetPlayer));
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    cache.clear();
  }
  
  // ============ 私有方法 ============
  
  private getCacheKey(prompt: string): string {
    // 简单的hash
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `llm_${hash}`;
  }
  
  private async callAPI(prompt: string): Promise<string> {
    const { provider, apiKey, model, baseUrl, maxTokens, temperature, timeout } = this.config;
    
    // 如果没有API Key，返回模拟响应
    if (!apiKey) {
      console.warn('[LLM] No API key configured, using mock response');
      return this.getMockResponse(prompt);
    }
    
    let url: string;
    let headers: Record<string, string>;
    let body: any;
    
    switch (provider) {
      case 'openai':
        url = baseUrl || 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        body = {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        };
        break;
        
      case 'anthropic':
        url = baseUrl || 'https://api.anthropic.com/v1/messages';
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        };
        body = {
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        };
        break;
        
      case 'deepseek':
        url = baseUrl || 'https://api.deepseek.com/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        body = {
          model: model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        };
        break;
        
      case 'custom':
        if (!baseUrl) throw new Error('Custom provider requires baseUrl');
        url = baseUrl;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        body = {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        };
        break;
        
      default:
        return this.getMockResponse(prompt);
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // 解析不同提供商的响应格式
      if (provider === 'anthropic') {
        return data.content?.[0]?.text || '';
      } else {
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('[LLM] API call failed:', error);
      return this.getMockResponse(prompt);
    }
  }
  
  private getMockResponse(prompt: string): string {
    // 根据prompt类型返回模拟响应
    if (prompt.includes('出牌建议') || prompt.includes('麻将教练')) {
      return JSON.stringify({
        recommendedAction: '打3万',
        confidence: 0.8,
        reasoning: '这张牌是安全牌，不会放炮',
        alternatives: [
          { action: '打5条', pros: ['进攻性强'], cons: ['有放炮风险'] }
        ],
        riskAssessment: {
          dealInRisk: 'low',
          riskySuits: ['条'],
          safeDiscards: ['3万', '9筒']
        },
        strategicHints: ['保持防守姿态', '观察对手动向']
      });
    }
    
    if (prompt.includes('复盘') || prompt.includes('分析这局')) {
      return JSON.stringify({
        keyMoments: [],
        overallAssessment: {
          strengths: ['防守意识不错'],
          weaknesses: ['进攻时机把握不够'],
          score: 70,
          grade: 'B'
        },
        improvements: ['多关注对手的弃牌', '提高听牌效率']
      });
    }
    
    if (prompt.includes('画像') || prompt.includes('统计数据')) {
      return JSON.stringify({
        skillLevel: {
          overall: 65,
          rank: 'intermediate',
          skills: {
            handReading: 60,
            efficiency: 70,
            defense: 75,
            riskManagement: 65,
            timing: 60,
            adaptation: 70
          }
        },
        playStyle: {
          primaryStyle: 'balanced',
          metrics: { aggression: 0.5, caution: 0.6, flexibility: 0.7, consistency: 0.6 },
          description: '平衡型玩家，攻守兼备',
          strengths: ['防守稳健'],
          weaknesses: ['进攻不够果断']
        },
        recommendations: ['练习听牌判断', '提高进攻意识']
      });
    }
    
    // 默认问答响应
    return '这是一个好问题！在麻将中，最重要的是保持冷静，根据场上情况灵活调整策略。建议多观察对手的出牌规律，这样可以更好地判断危险牌和安全牌。';
  }
  
  private parseJSON<T>(response: string, defaultValue: T): T {
    try {
      // 尝试提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return defaultValue;
    } catch (e) {
      console.warn('[LLM] Failed to parse JSON response:', e);
      return defaultValue;
    }
  }
  
  private getDefaultCoachingAdvice(legalActions: Action[]): CoachingAdvice {
    const discardAction = legalActions.find(a => a.type === 'DISCARD');
    return {
      recommendedAction: discardAction || { type: 'PASS' },
      confidence: 0.5,
      reasoning: '基于基本策略的建议',
      alternatives: [],
      riskAssessment: {
        dealInRisk: 'medium',
        riskySuits: [],
        safeDiscards: [],
      },
      strategicHints: ['保持冷静', '观察对手'],
    };
  }
  
  private getDefaultReview(gameRecord: any): GameReview {
    return {
      gameId: gameRecord.gameId || 'unknown',
      timestamp: new Date(),
      result: gameRecord.result || 'draw',
      keyMoments: [],
      overallAssessment: {
        strengths: [],
        weaknesses: [],
        score: 50,
        grade: 'C',
      },
      statistics: {
        avgShanten: 3,
        dealInCount: 0,
        efficiency: 0.5,
        defense: 0.5,
        timing: 0.5,
      },
      improvements: ['继续练习基本功'],
    };
  }
  
  private getDefaultOpponentPrediction(playerId: PlayerId): OpponentPrediction {
    return {
      playerId,
      handPrediction: {
        likelyTiles: [],
        confidence: 0.3,
        reasoning: '信息不足',
      },
      intentPrediction: {
        isAiming: false,
        likelyYaku: [],
        dangerLevel: 5,
        warningTiles: [],
      },
      behaviorAnalysis: {
        pattern: '常规打法',
        tendencies: [],
        exploitableWeakness: '无明显弱点',
      },
    };
  }
}

// 导出单例
export const llmService = new LLMService();
