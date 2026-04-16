/**
 * AI 评测 - 验证规则
 *
 * 换三张阶段验证器：
 *   硬约束 — 违反则判定失败（规则错误）
 *   软约束 — 不影响通过但影响评分（策略质量）
 *
 * 扩展方式：实现 PhaseValidator 接口，调用 registerValidator 注册。
 */

import type {
    AITestCase, PhaseValidator, Suit, TestTile,
    ValidationRule,
} from './types';
import { SUIT_NAMES, NAME_TO_SUIT } from './types';

// ── 解析工具 ────────────────────────────────────────────

/** 解析 "3万" → TestTile */
export function parseTileStr(s: string): TestTile | null {
    const m = s.match(/(\d)\s*([万条筒])/);
    if (!m) return null;
    const suit = NAME_TO_SUIT[m[2]];
    if (!suit) return null;
    return { suit, rank: Number(m[1]) };
}

/** 解析花色名 "万"/"万子" → Suit */
export function parseSuitStr(s: string): Suit | null {
    for (const [name, suit] of Object.entries(NAME_TO_SUIT)) {
        if (s.includes(name)) return suit;
    }
    return null;
}

/** 各花色张数 */
export function suitCounts(tiles: TestTile[]): Record<Suit, number> {
    const counts: Record<Suit, number> = { W: 0, B: 0, T: 0 };
    for (const t of tiles) counts[t.suit]++;
    return counts;
}

/** 格式化手牌 */
export function formatHandStr(tiles: TestTile[]): string {
    const grouped: Record<string, number[]> = { W: [], B: [], T: [] };
    for (const t of tiles) grouped[t.suit].push(t.rank);
    let result = '';
    for (const [suit, ranks] of Object.entries(grouped)) {
        if (ranks.length > 0) {
            result += ranks.sort((a, b) => a - b).join('') + SUIT_NAMES[suit as Suit] + ' ';
        }
    }
    return result.trim();
}

// ── 缺门使用违规检测 ───────────────────────────────────

/**
 * 检查文本是否错误地建议对缺门花色进行碰/做将
 * 返回违规描述，无违规返回 null
 */
function detectQueUsageViolation(text: string, queSuitName: string): string | null {
    const sentences = text.split(/[。！？\n;；]/);
    for (const seg of sentences) {
        if (!seg.includes(queSuitName)) continue;

        // 碰出/碰掉（但排除 "不能碰"/"无法碰"/"不可碰"）
        if (/碰出|碰掉|可以碰|碰了|去碰/.test(seg) &&
            !/(不能|无法|不可|禁止|不要|不宜|避免).*碰/.test(seg)) {
            return `建议碰${queSuitName}: "${seg.trim().slice(0, 60)}"`;
        }

        // 做将/作将/留做将（但排除 "不能做将"）
        if (/(做将|作将|作为将|当将|留将|留作将|做雀头)/.test(seg) &&
            !/(不能|无法|不可|禁止|不要).*(做将|作将|将)/.test(seg)) {
            return `建议${queSuitName}做将: "${seg.trim().slice(0, 60)}"`;
        }

        // "保留…对子…碰" 在缺门上下文中
        if (/保留.*对子/.test(seg) && /碰|将/.test(seg) &&
            !/(不|无法|不可).*保留/.test(seg)) {
            return `建议保留缺门对子: "${seg.trim().slice(0, 60)}"`;
        }
    }
    return null;
}

// ── 换三张 "获取建议" 验证 ──────────────────────────────

function validateExchangeAdvice(
    tc: AITestCase, raw: string, parsed?: Record<string, unknown>,
): ValidationRule[] {
    const rules: ValidationRule[] = [];

    // 尝试从原始文本提取 JSON
    if (!parsed) {
        try {
            const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
            if (m) parsed = JSON.parse(m[1]);
        } catch { /* ignore */ }
    }

    // H1: 有效响应
    rules.push({
        rule: 'valid_response',
        passed: !!parsed,
        severity: 'hard',
        message: parsed ? 'OK' : '无法解析JSON响应',
    });
    if (!parsed) return rules;

    // H2: 推荐3张牌
    const recRaw = parsed.recommendedTiles as string[] | undefined;
    const has3 = Array.isArray(recRaw) && recRaw.length === 3;
    rules.push({
        rule: 'exactly_3_tiles',
        passed: has3,
        severity: 'hard',
        message: has3 ? 'OK' : `需要3张，得到 ${Array.isArray(recRaw) ? recRaw.length : 'null'}`,
    });
    if (!has3) return rules;

    // 解析牌面
    const recTiles = recRaw!.map(parseTileStr);
    const allParsed = recTiles.every(t => t !== null);
    rules.push({
        rule: 'tiles_parseable',
        passed: allParsed,
        severity: 'hard',
        message: allParsed ? 'OK' : `无法解析: ${recRaw!.filter((_, i) => !recTiles[i]).join(', ')}`,
    });
    if (!allParsed) return rules;
    const tiles = recTiles as TestTile[];

    // H3: 同花色
    const suits = new Set(tiles.map(t => t.suit));
    rules.push({
        rule: 'same_suit',
        passed: suits.size === 1,
        severity: 'hard',
        message: suits.size === 1 ? 'OK' : `花色不一致: ${[...suits].map(s => SUIT_NAMES[s]).join(',')}`,
    });

    // H4: 牌存在于手牌中（含重复张）
    const handCopy = [...tc.hand];
    let allExist = true;
    const missing: string[] = [];
    for (const t of tiles) {
        const idx = handCopy.findIndex(h => h.suit === t.suit && h.rank === t.rank);
        if (idx === -1) {
            allExist = false;
            missing.push(`${t.rank}${SUIT_NAMES[t.suit]}`);
        } else {
            handCopy.splice(idx, 1);
        }
    }
    rules.push({
        rule: 'tiles_in_hand',
        passed: allExist,
        severity: 'hard',
        message: allExist ? 'OK' : `手牌中不存在: ${missing.join(', ')}`,
    });

    // H5: 换出花色手牌≥3张
    if (suits.size === 1) {
        const exSuit = tiles[0].suit;
        const cnt = tc.hand.filter(t => t.suit === exSuit).length;
        rules.push({
            rule: 'suit_has_enough',
            passed: cnt >= 3,
            severity: 'hard',
            message: cnt >= 3 ? 'OK' : `${SUIT_NAMES[exSuit]}只有${cnt}张，不够换`,
        });
    }

    // H6: 换出花色必须是 eligible（手牌≥3张）
    if (suits.size === 1) {
        const exSuit = tiles[0].suit;
        const handCount = tc.hand.filter(t => t.suit === exSuit).length;
        const isEligible = handCount >= 3;
        rules.push({
            rule: 'selected_suit_eligible',
            passed: isEligible,
            severity: 'hard',
            message: isEligible ? 'OK' : `${SUIT_NAMES[exSuit]}只有${handCount}张，不足3张不能换出`,
        });
    }

    // H7: 不建议缺门碰/做将
    const reasoning = String(parsed.reasoning || '');
    const fullText = reasoning;

    // 推断：换出花色通常就是缺门
    const exSuit = suits.size === 1 ? tiles[0].suit : null;
    const queSuit = exSuit;

    if (queSuit) {
        const queName = SUIT_NAMES[queSuit];
        const violation = detectQueUsageViolation(fullText, queName);
        rules.push({
            rule: 'no_que_peng_jiang',
            passed: !violation,
            severity: 'hard',
            message: violation || 'OK',
        });
    }

    // S1: 缺门残余最少
    if (queSuit && suits.size === 1) {
        const counts = suitCounts(tc.hand);
        const afterCounts = { ...counts };
        afterCounts[tiles[0].suit] -= 3;

        const queRemaining = afterCounts[queSuit];
        const otherRemaining = (['W', 'B', 'T'] as Suit[])
            .filter(s => s !== queSuit)
            .map(s => afterCounts[s]);
        const queIsMin = otherRemaining.every(c => c >= queRemaining);
        rules.push({
            rule: 'que_is_minimal',
            passed: queIsMin,
            severity: 'soft',
            message: queIsMin ? 'OK' : `缺门${SUIT_NAMES[queSuit]}换后剩${queRemaining}张，不是最少`,
        });
    }

    // S2: 有推理说明
    rules.push({
        rule: 'has_reasoning',
        passed: reasoning.length > 20,
        severity: 'soft',
        message: reasoning.length > 20 ? 'OK' : '推理说明过短',
    });

    // S3: selectedSuit 字段与实际牌花色一致
    const selectedSuitStr = parsed.selectedSuit ? String(parsed.selectedSuit) : '';
    const selectedSuitParsed = parseSuitStr(selectedSuitStr);
    const actualSuit = suits.size === 1 ? tiles[0].suit : null;
    const suitFieldMatch = selectedSuitParsed !== null && selectedSuitParsed === actualSuit;
    rules.push({
        rule: 'selected_suit_consistent',
        passed: suitFieldMatch,
        severity: 'soft',
        message: suitFieldMatch ? 'OK' : 'selectedSuit字段与推荐牌花色不一致',
    });

    return rules;
}

// ── 换三张 "分析手牌" 验证 ──────────────────────────────

function validateExchangeAnalysis(tc: AITestCase, raw: string): ValidationRule[] {
    const rules: ValidationRule[] = [];

    // H1: 非空响应
    rules.push({
        rule: 'non_empty',
        passed: raw.length > 50,
        severity: 'hard',
        message: raw.length > 50 ? 'OK' : '回复过短',
    });
    if (raw.length <= 50) return rules;

    // S1: 正确识别花色张数
    const counts = suitCounts(tc.hand);
    for (const suit of ['W', 'B', 'T'] as Suit[]) {
        const name = SUIT_NAMES[suit];
        // 匹配 "万6张" 或 "万子6张" 或 "万: 6张" 等
        const patterns = [
            new RegExp(`${name}[子]?[^\\d]{0,5}(\\d+)\\s*张`),
            new RegExp(`(\\d+)\\s*张\\s*${name}`),
        ];
        let mentioned: number | null = null;
        for (const pat of patterns) {
            const m = raw.match(pat);
            if (m) { mentioned = Number(m[1]); break; }
        }
        if (mentioned !== null) {
            rules.push({
                rule: `correct_count_${suit}`,
                passed: mentioned === counts[suit],
                severity: 'soft',
                message: mentioned === counts[suit]
                    ? `${name}${counts[suit]}张 ✓`
                    : `${name}实际${counts[suit]}张，回复说${mentioned}张`,
            });
        }
    }

    // H2: 不建议缺门碰/做将
    const queMatch = raw.match(/定缺[^万条筒]{0,5}([万条筒])/);
    if (queMatch) {
        const queName = queMatch[1];
        const violation = detectQueUsageViolation(raw, queName);
        rules.push({
            rule: 'no_que_peng_jiang',
            passed: !violation,
            severity: 'hard',
            message: violation || 'OK',
        });
    }

    // H3: 推荐的换牌花色一致
    // 匹配 "换出X万/条/筒" 或 "换 1万 2万 3万"
    const exchangeMatches = raw.match(/换[出]?\s*[^。]*?(\d[万条筒])[^。]*?(\d[万条筒])[^。]*?(\d[万条筒])/);
    if (exchangeMatches) {
        const t1 = parseTileStr(exchangeMatches[1]);
        const t2 = parseTileStr(exchangeMatches[2]);
        const t3 = parseTileStr(exchangeMatches[3]);
        if (t1 && t2 && t3) {
            const sameSuit = t1.suit === t2.suit && t2.suit === t3.suit;
            rules.push({
                rule: 'analysis_same_suit',
                passed: sameSuit,
                severity: 'hard',
                message: sameSuit ? 'OK' : '建议的换牌花色不一致',
            });

            // 检查牌是否存在于手牌
            const handCopy = [...tc.hand];
            let allExist = true;
            for (const t of [t1, t2, t3]) {
                const idx = handCopy.findIndex(h => h.suit === t.suit && h.rank === t.rank);
                if (idx === -1) { allExist = false; break; }
                handCopy.splice(idx, 1);
            }
            rules.push({
                rule: 'analysis_tiles_exist',
                passed: allExist,
                severity: 'hard',
                message: allExist ? 'OK' : '建议的牌不存在于手牌中',
            });
        }
    }

    // S2: 包含策略分析（提到对子/顺子/搭子等结构）
    const hasStructure = /对子|顺子|搭子|刻子|孤张/.test(raw);
    rules.push({
        rule: 'has_structure_analysis',
        passed: hasStructure,
        severity: 'soft',
        message: hasStructure ? 'OK' : '缺少牌型结构分析',
    });

    // S3: 推荐的换牌花色须是可换出花色（≥3张）
    if (exchangeMatches) {
        const t1 = parseTileStr(exchangeMatches[1]);
        if (t1) {
            const cnt = tc.hand.filter(h => h.suit === t1.suit).length;
            rules.push({
                rule: 'analysis_suit_eligible',
                passed: cnt >= 3,
                severity: 'hard',
                message: cnt >= 3 ? 'OK' : `建议换出${SUIT_NAMES[t1.suit]}只有${cnt}张，不足3张`,
            });
        }
    }

    return rules;
}

// ── 验证器注册 ──────────────────────────────────────────

export const exchangeValidator: PhaseValidator = {
    phase: 'EXCHANGE',
    validateAdvice: validateExchangeAdvice,
    validateAnalysis: validateExchangeAnalysis,
};

const registry = new Map<string, PhaseValidator>();
registry.set('EXCHANGE', exchangeValidator);

/** 注册新阶段的验证器 */
export function registerValidator(v: PhaseValidator): void {
    registry.set(v.phase, v);
}

/** 获取阶段验证器 */
export function getValidator(phase: string): PhaseValidator | undefined {
    return registry.get(phase);
}
