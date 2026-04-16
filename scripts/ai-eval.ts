/**
 * AI 评测 CLI 入口
 *
 * 用法:
 *   pnpm ai-eval --dry-run                    # 预览测试用例（不调用 API）
 *   pnpm ai-eval --count 10 --prompts advice  # 只测10例的"获取建议"
 *   pnpm ai-eval                              # 完整运行100例 × 2种prompt
 *
 * 环境变量:
 *   KIMI_API_KEY      - Kimi API 密钥（从 .env.local 自动加载）
 *   AI_EVAL_ENDPOINT  - API 端点（默认: https://api.kimi.com/coding/v1/messages）
 *   AI_EVAL_API_KEY   - API 密钥（覆盖 KIMI_API_KEY）
 *   AI_EVAL_MODEL     - 模型名（默认: kimi-k2-thinking）
 *   AI_EVAL_FORMAT    - API 格式: openai | anthropic（默认: anthropic）
 *   AI_EVAL_DELAY     - 调用间隔 ms（默认: 2000）
 *
 * CLI 参数:
 *   --phase EXCHANGE|DING_QUE|PLAYING  测试阶段（默认: EXCHANGE）
 *   --count N                          用例数量（默认: 100）
 *   --seed N                           随机种子（默认: 42）
 *   --prompts advice,analyze           要测试的 prompt 类型
 *   --dry-run                          只生成用例不调用 API
 *   --output FILE                      输出文件名
 *   --endpoint URL                     覆盖 API 端点
 *   --apiKey KEY                       覆盖 API 密钥
 *   --model NAME                       覆盖模型名
 *   --format openai|anthropic          覆盖 API 格式
 *   --delay MS                         覆盖调用间隔
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
    generateTestCases, runEvaluation, generateReport, formatReport, formatHandStr,
} from '../src/testing/ai-eval';
import type { LLMConfig, TestPhase } from '../src/testing/ai-eval/types';

// ── 加载 .env.local ─────────────────────────────────────

const envPath = resolve(import.meta.dirname ?? '.', '..', '.env.local');
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}
// ── 参数解析 ────────────────────────────────────────────

const args = process.argv.slice(2);
const flags: Record<string, string> = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        const key = args[i].slice(2);
        // 布尔标志（如 --dry-run）没有值
        if (!args[i + 1] || args[i + 1].startsWith('--')) {
            flags[key] = 'true';
        } else {
            flags[key] = args[i + 1];
            i++;
        }
    }
}

const phase = (flags.phase || 'EXCHANGE') as TestPhase;
const count = Number(flags.count || 100);
const seed = Number(flags.seed || 42);
const prompts = (flags.prompts || 'advice,analyze').split(',') as ('advice' | 'analyze')[];
const dryRun = flags['dry-run'] === 'true';
const outputFile = flags.output || `ai-eval-${phase.toLowerCase()}-${Date.now()}.json`;

const config: LLMConfig = {
    endpoint: flags.endpoint || process.env.AI_EVAL_ENDPOINT || 'https://api.kimi.com/coding/v1/messages',
    apiKey: flags.apiKey || process.env.AI_EVAL_API_KEY || process.env.KIMI_API_KEY || '',
    model: flags.model || process.env.AI_EVAL_MODEL || 'kimi-k2-thinking',
    format: (flags.format || process.env.AI_EVAL_FORMAT || 'anthropic') as 'openai' | 'anthropic',
    delayMs: Number(flags.delay || process.env.AI_EVAL_DELAY || 2000),
};

// ── 主流程 ──────────────────────────────────────────────

async function main() {
    console.log('');
    console.log('🀄 AI 评测系统 (AI Evaluation System)');
    console.log('─'.repeat(50));
    console.log(`  阶段:     ${phase}`);
    console.log(`  用例数:   ${count}`);
    console.log(`  种子:     ${seed}`);
    console.log(`  Prompt:   ${prompts.join(', ')}`);
    if (!dryRun) {
        console.log(`  端点:     ${config.endpoint}`);
        console.log(`  模型:     ${config.model}`);
        console.log(`  格式:     ${config.format}`);
        console.log(`  间隔:     ${config.delayMs}ms`);
    }
    console.log('');

    // ─ 生成测试用例 ─
    const cases = generateTestCases(phase, seed, count);
    console.log(`📋 已生成 ${cases.length} 个测试用例\n`);

    // ─ 预览模式 ─
    if (dryRun) {
        console.log('预览模式 (--dry-run)：显示测试用例，不调用 API\n');

        const catCounts: Record<string, number> = {};
        for (const tc of cases) catCounts[tc.category] = (catCounts[tc.category] || 0) + 1;

        console.log('类别分布:');
        for (const [cat, n] of Object.entries(catCounts)) {
            console.log(`  ${cat}: ${n} 例`);
        }
        console.log('');

        // 每类显示前3例
        const shown = new Set<string>();
        for (const tc of cases) {
            if (!shown.has(tc.category)) {
                shown.add(tc.category);
                const sameCat = cases.filter(c => c.category === tc.category).slice(0, 3);
                console.log(`── ${tc.category} ──`);
                for (const c of sameCat) {
                    const tags = c.tags?.length ? ` [${c.tags.join(', ')}]` : '';
                    console.log(`  ${c.id}: ${formatHandStr(c.hand)}${tags}`);
                }
                console.log('');
            }
        }

        // 保存全部用例
        writeFileSync(outputFile, JSON.stringify(cases, null, 2));
        console.log(`💾 全部用例已保存到 ${outputFile}`);
        return;
    }

    // ─ 检查 API 配置 ─
    if (!config.apiKey && !config.endpoint.includes('localhost') && !config.endpoint.includes('vercel')) {
        console.warn('⚠️  未设置 API 密钥 (AI_EVAL_API_KEY)。如果 API 需要认证，请设置后重试。\n');
    }

    // ─ 运行评测 ─
    const totalRuns = cases.length * prompts.length;
    console.log(`🚀 开始评测 (${totalRuns} 次 API 调用，预计 ${Math.ceil(totalRuns * config.delayMs / 60000)} 分钟)\n`);

    const results = await runEvaluation(cases, {
        config,
        prompts,
        onProgress(done, total, result) {
            const icon = result.error ? '❌' : result.passed ? '✅' : '⚠️';
            const typeLabel = result.promptType === 'advice' ? '建议' : '分析';
            const scoreStr = result.error ? 'ERR' : String(result.score).padStart(3);
            const timeStr = `${(result.latencyMs / 1000).toFixed(1)}s`;
            const errInfo = result.error ? ` ${result.error.slice(0, 50)}` : '';
            console.log(
                `  [${String(done).padStart(3)}/${total}] ${icon} ${result.caseId} (${typeLabel}) ` +
                `得分=${scoreStr} ${timeStr}${errInfo}`,
            );
        },
    });

    // ─ 生成报告 ─
    const report = generateReport(cases, results);
    console.log(formatReport(report));

    // ─ 保存结果 ─
    const fullOutput = {
        meta: { phase, seed, count, prompts, config: { ...config, apiKey: '***' } },
        report,
        cases: cases.map(c => ({ id: c.id, category: c.category, hand: formatHandStr(c.hand), tags: c.tags })),
        results: results.map(r => ({
            caseId: r.caseId,
            promptType: r.promptType,
            passed: r.passed,
            score: r.score,
            error: r.error,
            latencyMs: r.latencyMs,
            failedRules: r.validations.filter(v => !v.passed).map(v => ({ rule: v.rule, severity: v.severity, message: v.message })),
            // 原始响应截断保存（避免文件过大）
            responsePreview: r.rawResponse.slice(0, 500),
        })),
    };
    writeFileSync(outputFile, JSON.stringify(fullOutput, null, 2));
    console.log(`\n💾 完整结果已保存到 ${outputFile}`);
}

main().catch(err => {
    console.error('\n❌ 致命错误:', err);
    process.exit(1);
});
