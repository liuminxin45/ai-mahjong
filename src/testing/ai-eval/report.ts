/**
 * AI 评测 - 报告生成
 */

import type { AITestCase, EvalReport, TestResult, CategoryStats, FailureEntry } from './types';
import { formatHandStr } from './validators';

function calcStats(results: TestResult[]): CategoryStats {
    const total = results.length;
    const hardPass = results.filter(r => r.passed).length;
    const avgScore = total > 0
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / total)
        : 0;
    return { total, hardPass, hardPassRate: total > 0 ? hardPass / total : 0, avgScore };
}

export function generateReport(cases: AITestCase[], results: TestResult[]): EvalReport {
    const catMap = new Map(cases.map(c => [c.id, c]));

    // 按类别统计
    const catResults: Record<string, TestResult[]> = {};
    for (const r of results) {
        const cat = catMap.get(r.caseId)?.category || 'unknown';
        (catResults[cat] ??= []).push(r);
    }
    const byCategory: Record<string, CategoryStats> = {};
    for (const [cat, rs] of Object.entries(catResults)) {
        byCategory[cat] = calcStats(rs);
    }

    // 按 prompt 类型统计
    const promptResults: Record<string, TestResult[]> = {};
    for (const r of results) {
        (promptResults[r.promptType] ??= []).push(r);
    }
    const byPrompt: Record<string, CategoryStats> = {};
    for (const [pt, rs] of Object.entries(promptResults)) {
        byPrompt[pt] = calcStats(rs);
    }

    // 收集失败
    const failures: FailureEntry[] = [];
    for (const r of results) {
        if (!r.passed || r.error) {
            const tc = catMap.get(r.caseId);
            const hand = tc ? formatHandStr(tc.hand) : '?';
            const failedRules = r.error
                ? [`ERROR: ${r.error}`]
                : r.validations.filter(v => !v.passed && v.severity === 'hard').map(v => `${v.rule}: ${v.message}`);
            failures.push({ caseId: r.caseId, promptType: r.promptType, failedRules, hand });
        }
    }

    const overall = calcStats(results);

    return {
        timestamp: new Date().toISOString(),
        totalCases: cases.length,
        totalRuns: results.length,
        hardPassRate: overall.hardPassRate,
        avgScore: overall.avgScore,
        byCategory,
        byPrompt,
        failures,
    };
}

export function formatReport(report: EvalReport): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════╗');
    lines.push('║           AI 评测报告 (AI Eval Report)           ║');
    lines.push('╚══════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`  时间:         ${report.timestamp}`);
    lines.push(`  测试用例:     ${report.totalCases}`);
    lines.push(`  总运行次数:   ${report.totalRuns}`);
    lines.push(`  硬约束通过率: ${(report.hardPassRate * 100).toFixed(1)}%`);
    lines.push(`  平均得分:     ${report.avgScore}/100`);

    lines.push('');
    lines.push('── 按类别 ──────────────────────────────────────────');
    const catOrder = ['clear_que', 'moderate', 'balanced', 'pair_trap', 'high_fan'];
    const catLabels: Record<string, string> = {
        clear_que: '明确缺门(0-2张)',
        moderate: '标准(3-4张)',
        balanced: '均衡(4-5-5)',
        pair_trap: '对子陷阱',
        high_fan: '高番潜力(7+张)',
    };
    for (const cat of catOrder) {
        const stats = report.byCategory[cat];
        if (!stats) continue;
        const label = (catLabels[cat] || cat).padEnd(18);
        lines.push(
            `  ${label} | 通过 ${String(stats.hardPass).padStart(3)}/${String(stats.total).padStart(3)} ` +
            `(${(stats.hardPassRate * 100).toFixed(0).padStart(3)}%) | 均分 ${stats.avgScore}`,
        );
    }

    lines.push('');
    lines.push('── 按 Prompt 类型 ──────────────────────────────────');
    const promptLabels: Record<string, string> = { advice: '获取建议', analyze: '分析手牌' };
    for (const [pt, stats] of Object.entries(report.byPrompt)) {
        const label = (promptLabels[pt] || pt).padEnd(10);
        lines.push(
            `  ${label} | 通过 ${String(stats.hardPass).padStart(3)}/${String(stats.total).padStart(3)} ` +
            `(${(stats.hardPassRate * 100).toFixed(0).padStart(3)}%) | 均分 ${stats.avgScore}`,
        );
    }

    if (report.failures.length > 0) {
        lines.push('');
        lines.push('── 失败详情 ────────────────────────────────────────');
        const shown = report.failures.slice(0, 30);
        for (const f of shown) {
            const typeLabel = f.promptType === 'advice' ? '建议' : '分析';
            lines.push(`  ${f.caseId} [${typeLabel}] ${f.hand}`);
            for (const rule of f.failedRules.slice(0, 3)) {
                lines.push(`    ❌ ${rule}`);
            }
        }
        if (report.failures.length > 30) {
            lines.push(`  ... 还有 ${report.failures.length - 30} 个失败`);
        }
    }

    lines.push('');
    lines.push('══════════════════════════════════════════════════');
    return lines.join('\n');
}
