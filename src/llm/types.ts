/**
 * LLM系统类型定义
 */

import type { Action } from '../core/model/action';
import type { Tile } from '../core/model/tile';
import type { PlayerId } from '../core/model/types';
import type { GameState } from '../core/model/state';

// ============ LLM配置 ============

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'local' | 'custom';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  maxTokens: number;
  contextWindow?: number;
  temperature: number;
  timeout: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

export type LLMProfileKind = 'kimi_coding_anthropic' | 'openai_compatible';

export interface LLMProfile {
  id: string;
  name: string;
  kind: LLMProfileKind;
  apiKey?: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  contextWindow?: number;
  temperature: number;
  timeout: number;
}

export interface LLMProfileStore {
  profiles: LLMProfile[];
  activeProfileId?: string;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'custom',
  model: 'kimi-k2-thinking',
  baseUrl: 'https://api.kimi.com/coding/v1/messages',
  maxTokens: 1024,
  contextWindow: 262144,
  temperature: 0.4,
  timeout: 60000,
  cacheEnabled: true,
  cacheTTL: 300000, // 5分钟
};

// ============ 实时指导 ============

export interface CoachingAdvice {
  recommendedAction: Action;
  confidence: number; // 0-1
  reasoning: string;
  alternatives: Array<{
    action: Action;
    pros: string[];
    cons: string[];
  }>;
  riskAssessment: {
    dealInRisk: 'low' | 'medium' | 'high';
    riskySuits: string[];
    safeDiscards: Tile[];
  };
  strategicHints: string[];
}

export type GuidanceLevel = 'beginner' | 'learning' | 'practicing' | 'advanced';

export interface SmartGuidance {
  level: GuidanceLevel;
  content: {
    beginner?: {
      action: Action;
      simpleReason: string;
    };
    learning?: {
      options: Array<{
        action: Action;
        score: number;
        hint: string;
      }>;
      question: string;
    };
    practicing?: {
      hints: string[];
      keyFactors: string[];
    };
    advanced?: {
      available: boolean;
      requestPrompt: string;
    };
  };
}

// ============ 对局复盘 ============

export interface KeyMoment {
  turn: number;
  situation: string;
  playerAction: Action;
  optimalAction: Action;
  impact: 'critical' | 'significant' | 'minor';
  analysis: string;
  lesson: string;
}

export interface GameReview {
  gameId: string;
  timestamp: Date;
  result: 'win' | 'lose' | 'draw';
  keyMoments: KeyMoment[];
  overallAssessment: {
    strengths: string[];
    weaknesses: string[];
    score: number; // 0-100
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
  };
  statistics: {
    avgShanten: number;
    dealInCount: number;
    efficiency: number;
    defense: number;
    timing: number;
  };
  improvements: string[];
}

// ============ 用户画像 ============

export interface UserProfile {
  userId: string;
  nickname: string;
  createdAt: Date;
  lastActive: Date;
  
  skillLevel: {
    overall: number; // 0-100
    rank: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    skills: {
      handReading: number;
      efficiency: number;
      defense: number;
      riskManagement: number;
      timing: number;
      adaptation: number;
    };
  };
  
  playStyle: {
    primaryStyle: 'aggressive' | 'defensive' | 'balanced' | 'opportunistic';
    metrics: {
      aggression: number;
      caution: number;
      flexibility: number;
      consistency: number;
    };
    description: string;
    strengths: string[];
    weaknesses: string[];
  };
  
  patterns: {
    preferredMelds: string[];
    riskyTurns: number[];
    commonMistakes: string[];
    improvementAreas: string[];
  };
  
  learningProgress: {
    completedLessons: string[];
    masteredConcepts: string[];
    currentFocus: string;
    recommendations: string[];
  };
}

// ============ 历史记录 ============

export interface GameRecord {
  gameId: string;
  timestamp: Date;
  duration: number;
  result: 'win' | 'lose' | 'draw';
  score: number;
  
  replay: {
    initialState: GameState;
    events: Array<{
      turn: number;
      playerId: PlayerId;
      action: Action;
      state: GameState;
    }>;
    finalState: GameState;
  };
  
  stats: {
    winTurn: number | null;
    dealInCount: number;
    meldCount: number;
    finalShanten: number;
  };
  
  summary?: string;
  keyMoments?: KeyMoment[];
}

export interface GameHistory {
  version: string;
  userId: string;
  games: GameRecord[];
  aggregateStats: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    avgScore: number;
    bestStreak: number;
    currentStreak: number;
  };
}

// ============ AI解说 ============

export type CommentaryStyle = 'professional' | 'casual' | 'humorous' | 'educational';

export interface Commentary {
  type: 'excitement' | 'analysis' | 'prediction' | 'humor';
  text: string;
  emotion: 'excited' | 'tense' | 'surprised' | 'calm';
  timestamp: number;
}

// ============ 问答助手 ============

export type QuestionType = 'rule' | 'strategy' | 'terminology' | 'situation' | 'history' | 'general';

export interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    gameState?: GameState;
    questionType?: QuestionType;
  };
}

export interface QASession {
  sessionId: string;
  messages: QAMessage[];
  createdAt: Date;
  lastActivity: Date;
}

// ============ 对手预测 ============

export interface OpponentPrediction {
  playerId: PlayerId;
  handPrediction: {
    likelyTiles: Tile[];
    confidence: number;
    reasoning: string;
  };
  intentPrediction: {
    isAiming: boolean;
    likelyYaku: string[];
    dangerLevel: number; // 0-10
    warningTiles: Tile[];
  };
  behaviorAnalysis: {
    pattern: string;
    tendencies: string[];
    exploitableWeakness: string;
  };
}
