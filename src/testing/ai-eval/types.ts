/**
 * AI 评测系统 - 类型定义
 *
 * 设计目标：
 * - 支持多阶段（换三张、定缺、出牌）AI 测试
 * - 硬约束（规则正确性）与软约束（策略合理性）分离
 * - 可扩展的验证器注册机制
 */

export type Suit = 'W' | 'B' | 'T';

export const SUIT_NAMES: Record<Suit, string> = { W: '万', B: '条', T: '筒' };
export const NAME_TO_SUIT: Record<string, Suit> = { '万': 'W', '条': 'B', '筒': 'T' };

export interface TestTile {
    suit: Suit;
    rank: number;
}

export type TestPhase = 'EXCHANGE' | 'DING_QUE' | 'PLAYING';

/** 单个测试用例 */
export interface AITestCase {
    id: string;
    category: string;
    phase: TestPhase;
    hand: TestTile[];
    /** 阶段特定的上下文（出牌阶段需要定缺、副露等信息） */
    context?: {
        dingQue?: Suit;
        melds?: Array<{ type: 'PENG' | 'GANG'; tile: TestTile; from: string }>;
        discards?: TestTile[];
        turn?: number;
        wallLength?: number;
    };
    tags?: string[];
}

export type Severity = 'hard' | 'soft';

/** 单条验证结果 */
export interface ValidationRule {
    rule: string;
    passed: boolean;
    severity: Severity;
    message: string;
}

/** 单次测试运行结果 */
export interface TestResult {
    caseId: string;
    promptType: 'advice' | 'analyze';
    rawResponse: string;
    parsedResponse?: Record<string, unknown>;
    validations: ValidationRule[];
    passed: boolean;
    score: number;
    error?: string;
    latencyMs: number;
}

/** 按类别/Prompt类型的统计 */
export interface CategoryStats {
    total: number;
    hardPass: number;
    hardPassRate: number;
    avgScore: number;
}

/** 失败条目 */
export interface FailureEntry {
    caseId: string;
    promptType: string;
    failedRules: string[];
    hand: string;
}

/** 完整评测报告 */
export interface EvalReport {
    timestamp: string;
    totalCases: number;
    totalRuns: number;
    hardPassRate: number;
    avgScore: number;
    byCategory: Record<string, CategoryStats>;
    byPrompt: Record<string, CategoryStats>;
    failures: FailureEntry[];
}

/** LLM 调用配置 */
export interface LLMConfig {
    /** API 端点 */
    endpoint: string;
    /** API 密钥 */
    apiKey: string;
    /** 模型名 */
    model: string;
    /** API 格式: 'openai' (OpenAI/Kimi) 或 'anthropic' */
    format: 'openai' | 'anthropic';
    /** 调用间隔 (ms) */
    delayMs: number;
}

/** 阶段验证器接口 — 实现此接口以支持新阶段 */
export interface PhaseValidator {
    phase: TestPhase;
    validateAdvice(tc: AITestCase, raw: string, parsed?: Record<string, unknown>): ValidationRule[];
    validateAnalysis(tc: AITestCase, raw: string): ValidationRule[];
}
