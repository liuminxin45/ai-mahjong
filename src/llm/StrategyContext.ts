/**
 * 策略知识上下文
 * 按游戏阶段和决策场景提供分层策略参考，减少 token 消耗
 *
 * 加载策略:
 *   - 始终加载: 对应阶段的主模块 (500-800 tokens)
 *   - 按需联合: probability.md 仅在 advanced 级别或教学场景时加载
 *   - 组合加载: PLAYING 阶段根据 situation 选择 1-2 个子模块
 */

// Vite ?raw imports — 构建时内联，零运行时开销
import exchangeMd from '../../docs/strategy/exchange.md?raw';
import dingqueMd from '../../docs/strategy/dingque.md?raw';
import discardQuemenMd from '../../docs/strategy/discard_quemen.md?raw';
import discardOffenseMd from '../../docs/strategy/discard_offense.md?raw';
import discardBaotingMd from '../../docs/strategy/discard_baoting.md?raw';
import listenMd from '../../docs/strategy/listen.md?raw';
import gangMd from '../../docs/strategy/gang.md?raw';
import defenseMd from '../../docs/strategy/defense.md?raw';
import endgameMd from '../../docs/strategy/endgame.md?raw';
import probabilityMd from '../../docs/strategy/probability.md?raw';

export type StrategySituation =
    | 'quemen'    // 缺门清理
    | 'offense'   // 中盘进攻
    | 'baoting'   // 保听策略
    | 'listen'    // 听牌选择
    | 'gang'      // 杠决策
    | 'defense'   // 防守切换
    | 'endgame';  // 尾局

const MODULE_MAP: Record<string, string> = {
    exchange: exchangeMd,
    dingque: dingqueMd,
    discard_quemen: discardQuemenMd,
    discard_offense: discardOffenseMd,
    discard_baoting: discardBaotingMd,
    listen: listenMd,
    gang: gangMd,
    defense: defenseMd,
    endgame: endgameMd,
    probability: probabilityMd,
};

/**
 * 根据游戏阶段和局面状态，返回相关策略模块的文本内容。
 *
 * @param phase        游戏阶段: EXCHANGE / DING_QUE / PLAYING / END
 * @param situation    PLAYING 阶段的细分场景
 * @param withProbability 是否联合加载概率公式模块 (advanced / 教学场景)
 */
export function getStrategyContext(
    phase: string,
    situation?: StrategySituation,
    withProbability = false,
): string {
    const parts: string[] = [];

    switch (phase) {
        case 'EXCHANGE':
            parts.push(MODULE_MAP.exchange);
            break;

        case 'DING_QUE':
            parts.push(MODULE_MAP.dingque);
            break;

        case 'PLAYING': {
            // 根据 situation 选择 1-2 个子模块
            if (situation === 'quemen') {
                parts.push(MODULE_MAP.discard_quemen);
            } else if (situation === 'offense') {
                parts.push(MODULE_MAP.discard_offense);
            } else if (situation === 'baoting') {
                parts.push(MODULE_MAP.discard_baoting);
            } else if (situation === 'listen') {
                parts.push(MODULE_MAP.listen);
            } else if (situation === 'gang') {
                parts.push(MODULE_MAP.gang);
            } else if (situation === 'defense') {
                parts.push(MODULE_MAP.defense);
            } else if (situation === 'endgame') {
                parts.push(MODULE_MAP.endgame);
            } else {
                // 未指定 situation — 加载通用进攻模块
                parts.push(MODULE_MAP.discard_offense);
            }
            break;
        }

        case 'END':
            parts.push(MODULE_MAP.endgame);
            break;

        default:
            break;
    }

    // 按需联合加载概率公式
    if (withProbability) {
        parts.push(MODULE_MAP.probability);
    }

    return parts.join('\n\n---\n\n');
}

/**
 * 根据游戏状态自动推断当前 situation。
 * 用于 PromptBuilder 无需手动指定 situation 的场景。
 */
export function inferSituation(state: {
    phase: string;
    hands: Record<string, { suit: string }[]>;
    wall: unknown[];
    melds: Record<string, unknown[]>;
    declaredHu: Record<string, boolean>;
    [key: string]: unknown;
}, playerId: string): StrategySituation | undefined {
    if (state.phase !== 'PLAYING') return undefined;

    const hand = state.hands[playerId] || [];
    const dingQue = (state as Record<string, unknown>).dingQueSelection as Record<string, string> | undefined;
    const queSuit = dingQue?.[playerId];
    const wallSize = state.wall.length;

    // 1. 花猪/缺门未清完
    if (queSuit && hand.some(t => t.suit === queSuit)) {
        return 'quemen';
    }

    // 2. 尾局
    if (wallSize < 20) {
        return 'endgame';
    }

    // 3. 对手威胁高 → 防守
    const opponents = (['P0', 'P1', 'P2', 'P3'] as string[]).filter(p => p !== playerId);
    const highThreat = opponents.some(p => {
        if (state.declaredHu[p]) return false; // 已胡不算威胁
        return (state.melds[p]?.length ?? 0) >= 2;
    });
    if (highThreat && wallSize < 40) {
        return 'defense';
    }

    // 4. 默认进攻
    return 'offense';
}

/**
 * 获取所有策略模块的 key→内容映射（用于测试或全量导出）
 */
export function getAllModules(): Record<string, string> {
    return { ...MODULE_MAP };
}
