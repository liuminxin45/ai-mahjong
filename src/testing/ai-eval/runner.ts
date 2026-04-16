/**
 * AI 评测 - 运行器
 *
 * 职责：
 * 1. 构建 prompt（直接构建，不依赖 PromptBuilder 避免 ?raw 问题）
 * 2. 调用 LLM API（支持 OpenAI 和 Anthropic 格式）
 * 3. 收集验证结果并计算分数
 */

import type { AITestCase, LLMConfig, TestResult, ValidationRule, Suit } from './types';
import { SUIT_NAMES } from './types';
import { getValidator, formatHandStr } from './validators';

// ── Prompt 构建（独立于 PromptBuilder，避免 ?raw 依赖）──

function formatHand(tiles: Array<{ suit: string; rank: number }>): string {
    return formatHandStr(tiles as any);
}

function analyzeSuit(tiles: Array<{ suit: string; rank: number }>, suit: string): string[] {
    const suitTiles = tiles.filter(t => t.suit === suit);
    const suitName = SUIT_NAMES[suit as Suit];
    if (suitTiles.length === 0) return [`${suitName}: 0张`];

    const lines: string[] = [`${suitName}: ${suitTiles.length}张`];

    const rankCounts: Record<number, number> = {};
    for (const t of suitTiles) rankCounts[t.rank] = (rankCounts[t.rank] || 0) + 1;

    const pairs = Object.entries(rankCounts).filter(([, c]) => c === 2);
    const triplets = Object.entries(rankCounts).filter(([, c]) => c >= 3);
    if (triplets.length > 0) lines.push(`  刻子: ${triplets.map(([r]) => r + suitName).join(', ')}`);
    if (pairs.length > 0) lines.push(`  对子: ${pairs.map(([r]) => r + suitName).join(', ')}`);

    const ranks = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
    const sequences: string[] = [];
    const seqRanks = new Set<number>();
    for (let i = 0; i < ranks.length - 2; i++) {
        if (ranks[i + 1] === ranks[i] + 1 && ranks[i + 2] === ranks[i] + 2) {
            sequences.push(`${ranks[i]}${ranks[i + 1]}${ranks[i + 2]}${suitName}`);
            seqRanks.add(ranks[i]); seqRanks.add(ranks[i] + 1); seqRanks.add(ranks[i] + 2);
        }
    }
    if (sequences.length > 0) lines.push(`  顺子: ${sequences.join(', ')}`);

    // 共用牌警告
    if (sequences.length > 0) {
        for (const [rankStr, count] of [...pairs, ...triplets]) {
            const rank = Number(rankStr);
            if (seqRanks.has(rank)) {
                if (count === 2) {
                    lines.push(`  ⚠️ ${rank}${suitName}(${count}张)同时被顺子占用1张，保留顺子则无法成对；拆掉顺子才能保住对子`);
                } else {
                    lines.push(`  ⚠️ ${rank}${suitName}(${count}张)同时参与顺子，但因有${count}张影响较小`);
                }
            }
        }
    }

    return lines;
}

/** 枚举 3 张换出组合 */
function enumerateOptions(tiles: Array<{ suit: string; rank: number }>): Array<{ exchange: number[]; remaining: number[] }> {
    const seen = new Set<string>();
    const results: Array<{ exchange: number[]; remaining: number[] }> = [];
    for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            for (let k = j + 1; k < tiles.length; k++) {
                const exchange = [tiles[i].rank, tiles[j].rank, tiles[k].rank].sort((a, b) => a - b);
                const key = exchange.join(',');
                if (!seen.has(key)) {
                    seen.add(key);
                    const remaining = tiles.filter((_, idx) => idx !== i && idx !== j && idx !== k)
                        .map(t => t.rank).sort((a, b) => a - b);
                    results.push({ exchange, remaining });
                }
            }
        }
    }
    return results;
}

/** 构建"获取建议"prompt（换三张阶段） */
function buildExchangeAdvicePrompt(hand: Array<{ suit: string; rank: number }>): string {
    const counts = { W: 0, B: 0, T: 0 };
    for (const t of hand) counts[t.suit as Suit]++;

    const analysis = ['W', 'B', 'T'].map(s => analyzeSuit(hand, s).join('\n')).join('\n');

    // 枚举方案
    const optionLines: string[] = [];
    const eligibleSuits: string[] = [];
    const ineligibleSuits: string[] = [];
    for (const suit of ['W', 'B', 'T'] as Suit[]) {
        const suitTiles = hand.filter(t => t.suit === suit);
        const sn = SUIT_NAMES[suit];
        if (suitTiles.length < 3) {
            ineligibleSuits.push(`${sn}(${suitTiles.length}张，不足3张，不能换出)`);
            continue;
        }
        eligibleSuits.push(sn);
        const options = enumerateOptions(suitTiles).slice(0, 10);
        const lines = options.map((opt, i) => {
            const rem = opt.remaining.length > 0 ? opt.remaining.join('') + sn : '(清空)';
            return `  方案${i + 1}: 换出 ${opt.exchange.join('')}${sn} → 剩余 ${rem}`;
        });
        optionLines.push(`${sn} (${suitTiles.length}张):\n${lines.join('\n')}`);
    }

    return `你是一位精通成都麻将（血战到底）的专业教练，现在是**换三张阶段**。

**换三张阶段规则:**
- 必须选择3张**同花色**的牌进行交换
- 交换方向固定顺时针

【我的手牌】
${formatHand(hand)}

【手牌分析】
${analysis}

【花色统计】
- 万: ${counts.W}张
- 条: ${counts.B}张
- 筒: ${counts.T}张

【各花色可选换牌方案】
${ineligibleSuits.length > 0 ? `⛔ 不可换出: ${ineligibleSuits.join('、')}\n` : ''}✅ 只能从以下花色中选择换出: ${eligibleSuits.join('、')}

${optionLines.join('\n\n')}

【任务】
请分析我的手牌，推荐换出哪3张牌，并解释为什么。

**⛔ 绝对禁止（违反任何一条即为错误答案）**:
1. 推荐的3张牌必须是**完全相同的花色**，绝对不能混合不同花色
2. 只能从上面标记为"✅ 可换出"的花色中选择
3. 不足3张的花色**无法换出**，连1张都不能从这个花色选

**分析步骤**:
1. 确认可换出的花色（≥3张的花色）
2. 从可换出花色中，选择换出后对保留门结构最有利的方案
3. 换出门剩余牌越少越好（反正后续大概率要定缺这个花色，全是废牌）
4. 保留门的结构质量才有意义（对子、搭子、顺子越多越好）
5. 注意：同一张牌可能同时被统计为对子和顺子成员，拆顺子可能连带破坏对子

**关于定缺**: 换三张后你会收到3张未知花色的牌，所以现在不要预判定缺。只需专注于：从哪个花色换出哪3张。

请以JSON格式返回：
{
  "recommendedTiles": ["X万/条/筒", "X万/条/筒", "X万/条/筒"],
  "selectedSuit": "万/条/筒（换出花色，必须是同一花色）",
  "reasoning": "为什么选这个花色、选这3张牌",
  "alternatives": [
    {"tiles": ["X万/条/筒", "X万/条/筒", "X万/条/筒"], "reasoning": "方案对比说明"}
  ],
  "tileAnalysis": {
    "万": {"count": 数量, "value": "高/中/低", "reason": "原因"},
    "条": {"count": 数量, "value": "高/中/低", "reason": "原因"},
    "筒": {"count": 数量, "value": "高/中/低", "reason": "原因"}
  }
}`;
}

/** 构建"分析手牌"prompt（换三张阶段） */
function buildExchangeAnalysisPrompt(hand: Array<{ suit: string; rank: number }>): string {
    const counts = { W: 0, B: 0, T: 0 };
    for (const t of hand) counts[t.suit as Suit]++;

    return `你是一位精通成都麻将（血战到底）的专业助手，帮助玩家解答麻将相关问题。

**成都麻将关键规则:**
- 换三张（固定顺时针）→ 定缺 → 出牌
- 换三张: 必须选3张**同花色**的牌换出，不足3张的花色不能换
- 定缺: 必须选一门花色，先打完才能胡，定缺花色不能碰杠，不能做将
- 血战到底: 一家胡后继续，直到3家胡或牌尽
- 番型: 平胡1, 自摸1, 对对胡2, 清一色2, 七对2

【当前阶段: 换三张】

【你的手牌】
${formatHand(hand)}

【花色统计】
- 万: ${counts.W}张${counts.W < 3 ? '（不足3张，不能换出）' : ''}
- 条: ${counts.B}张${counts.B < 3 ? '（不足3张，不能换出）' : ''}
- 筒: ${counts.T}张${counts.T < 3 ? '（不足3张，不能换出）' : ''}

【用户问题】
分析我的手牌

【要求】
1. 用通俗易懂的语言回答
2. 换三张建议必须是同花色3张牌，不足3张的花色不能换出
3. 换三张后会收到3张未知牌，所以不要预判定缺，专注于换出选择
4. 回答要简洁但完整
5. 不要使用 Markdown 语法
6. 如果需要结构化表达，请只用分段、空行和序号列表

请直接用中文回答，不需要JSON格式。`;
}

// ── LLM API 调用 ────────────────────────────────────────

async function callLLM(prompt: string, config: LLMConfig): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: string;

    if (config.format === 'anthropic') {
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = JSON.stringify({
            model: config.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });
    } else {
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        body = JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096,
            temperature: 0,
        });
    }

    const res = await fetch(config.endpoint, { method: 'POST', headers, body });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as any;

    // OpenAI 格式
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    // Anthropic 格式
    if (data.content?.[0]?.text) return data.content[0].text;
    // 直接内容
    if (typeof data.content === 'string') return data.content;

    throw new Error(`无法解析API响应: ${JSON.stringify(data).slice(0, 200)}`);
}

// ── 评分 ────────────────────────────────────────────────

function computeScore(rules: ValidationRule[]): { passed: boolean; score: number } {
    const hard = rules.filter(r => r.severity === 'hard');
    const soft = rules.filter(r => r.severity === 'soft');
    const hardPass = hard.every(r => r.passed);
    if (!hardPass) return { passed: false, score: 0 };

    const base = 60;
    const softMax = 40;
    const softPassed = soft.filter(r => r.passed).length;
    const softTotal = soft.length || 1;
    return { passed: true, score: base + Math.round((softPassed / softTotal) * softMax) };
}

// ── 单例执行 ────────────────────────────────────────────

function buildPrompt(tc: AITestCase, promptType: 'advice' | 'analyze'): string {
    if (tc.phase === 'EXCHANGE') {
        return promptType === 'advice'
            ? buildExchangeAdvicePrompt(tc.hand)
            : buildExchangeAnalysisPrompt(tc.hand);
    }
    throw new Error(`阶段 ${tc.phase} 的 prompt 构建尚未实现`);
}

async function runOne(
    tc: AITestCase, promptType: 'advice' | 'analyze', config: LLMConfig,
): Promise<TestResult> {
    const start = Date.now();
    try {
        const prompt = buildPrompt(tc, promptType);
        const raw = await callLLM(prompt, config);
        const latencyMs = Date.now() - start;

        let parsed: Record<string, unknown> | undefined;
        try {
            const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
            if (m) parsed = JSON.parse(m[1]);
        } catch { /* ignore */ }

        const validator = getValidator(tc.phase);
        const validations = validator
            ? (promptType === 'advice'
                ? validator.validateAdvice(tc, raw, parsed)
                : validator.validateAnalysis(tc, raw))
            : [];

        const { passed, score } = computeScore(validations);
        return { caseId: tc.id, promptType, rawResponse: raw, parsedResponse: parsed, validations, passed, score, latencyMs };
    } catch (err: any) {
        return {
            caseId: tc.id, promptType, rawResponse: '', validations: [],
            passed: false, score: 0, error: err.message, latencyMs: Date.now() - start,
        };
    }
}

// ── 批量执行 ────────────────────────────────────────────

export interface RunOptions {
    config: LLMConfig;
    prompts?: ('advice' | 'analyze')[];
    onProgress?: (done: number, total: number, result: TestResult) => void;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runEvaluation(
    cases: AITestCase[], options: RunOptions,
): Promise<TestResult[]> {
    const { config, prompts = ['advice', 'analyze'], onProgress } = options;
    const results: TestResult[] = [];
    const total = cases.length * prompts.length;

    for (const tc of cases) {
        for (const pt of prompts) {
            const result = await runOne(tc, pt, config);
            results.push(result);
            onProgress?.(results.length, total, result);
            if (config.delayMs > 0) await sleep(config.delayMs);
        }
    }
    return results;
}
