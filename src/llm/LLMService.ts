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

function isLocalBrowserDev(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, protocol } = window.location;
  return protocol.startsWith('http') && (hostname === 'localhost' || hostname === '127.0.0.1');
}

function mapToDevProxyUrl(provider: LLMConfig['provider'], baseUrl?: string): string | undefined {
  if (!isLocalBrowserDev() || !baseUrl) return baseUrl;
  if (baseUrl.startsWith('/')) return baseUrl;

  try {
    const parsed = new URL(baseUrl);
    const origin = window.location.origin;

    if (
      (provider === 'custom' || provider === 'anthropic')
      && parsed.hostname === 'api.kimi.com'
      && parsed.pathname.startsWith('/coding/v1')
    ) {
      return `${origin}/api/llm/kimi/messages`;
    }
    if (provider === 'openai' && parsed.hostname === 'api.openai.com') {
      return `${origin}/api/llm/openai`;
    }
    if (provider === 'deepseek' && parsed.hostname === 'api.deepseek.com') {
      return `${origin}/api/llm/deepseek`;
    }
    if (provider === 'anthropic' && parsed.hostname === 'api.anthropic.com') {
      return `${origin}/api/llm/anthropic`;
    }
  } catch {
    return baseUrl;
  }

  return baseUrl;
}

function normalizeOpenAICompatibleUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function normalizeAnthropicUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/messages')) return trimmed;
  return `${trimmed}/messages`;
}

function isManagedLLMUrl(url?: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname.startsWith('/api/llm/');
  } catch {
    return false;
  }
}

function isKimiCodingUrl(url?: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url, 'http://localhost');
    return (
      (parsed.hostname === 'api.kimi.com' && parsed.pathname.startsWith('/coding/v1'))
      || parsed.pathname.startsWith('/api/llm/kimi')
    );
  } catch {
    return false;
  }
}

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
    const response = await this.query(prompt, { useCache: false });
    return this.parseJSONStrict<CoachingAdvice>(response);
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
    return this.parseJSONStrict(response);
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
    return this.parseJSONStrict(response);
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
    
    if (!apiKey && !isManagedLLMUrl(baseUrl)) {
      throw new Error('LLM API key is not configured');
    }
    
    let url: string;
    let headers: Record<string, string>;
    let body: any;
    
    switch (provider) {
      case 'openai':
        url = normalizeOpenAICompatibleUrl(
          mapToDevProxyUrl(provider, baseUrl || 'https://api.openai.com/v1/chat/completions')
          || 'https://api.openai.com/v1/chat/completions',
        );
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
        url = normalizeAnthropicUrl(
          mapToDevProxyUrl(provider, baseUrl || 'https://api.anthropic.com/v1/messages')
          || 'https://api.anthropic.com/v1/messages',
        );
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
        url = normalizeOpenAICompatibleUrl(
          mapToDevProxyUrl(provider, baseUrl || 'https://api.deepseek.com/v1/chat/completions')
          || 'https://api.deepseek.com/v1/chat/completions',
        );
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
        if (isKimiCodingUrl(baseUrl)) {
          url = normalizeAnthropicUrl(mapToDevProxyUrl(provider, baseUrl) || baseUrl);
          headers = {
            'Content-Type': 'application/json',
          };
          if (!isManagedLLMUrl(url)) {
            headers['x-api-key'] = apiKey!;
            headers['anthropic-version'] = '2023-06-01';
          }
          body = {
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          };
        } else {
          url = normalizeOpenAICompatibleUrl(mapToDevProxyUrl(provider, baseUrl) || baseUrl);
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
        }
        break;
        
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    try {
      console.log('[LLM] Calling API:', { provider, model, url: url.substring(0, 50) + '...' });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[LLM] Request timeout after', timeout, 'ms');
        controller.abort();
      }, timeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LLM] API error response:', response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[LLM] API response received successfully');
      
      // 解析不同提供商的响应格式
      if (provider === 'anthropic' || (provider === 'custom' && isKimiCodingUrl(baseUrl))) {
        return data.content?.[0]?.text || '';
      } else {
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[LLM] Request aborted (timeout)');
      } else {
        console.error('[LLM] API call failed:', error.message || error);
      }
      throw error;
    }
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

  private parseJSONStrict<T>(response: string): T {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM response did not contain JSON');
    }
    return JSON.parse(jsonMatch[0]) as T;
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
