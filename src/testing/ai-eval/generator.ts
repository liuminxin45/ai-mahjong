/**
 * AI 评测 - 测试用例生成器
 *
 * 使用确定性 PRNG 生成可复现的测试用例。
 * 换三张阶段：5 个类别 × 20 = 100 个用例。
 *
 * 扩展方式：添加新阶段的生成函数，在 generateTestCases 中注册。
 */

import type { AITestCase, Suit, TestTile, TestPhase } from './types';

// ── 确定性 PRNG (Park-Miller) ──────────────────────────

class SeededRNG {
    private s: number;
    constructor(seed: number) {
        this.s = seed % 2147483647;
        if (this.s <= 0) this.s += 2147483646;
    }
    next(): number {
        this.s = (this.s * 16807) % 2147483647;
        return (this.s - 1) / 2147483646;
    }
    int(min: number, max: number): number {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    pick<T>(arr: readonly T[]): T {
        return arr[this.int(0, arr.length - 1)];
    }
    shuffle<T>(arr: readonly T[]): T[] {
        const r = [...arr];
        for (let i = r.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [r[i], r[j]] = [r[j], r[i]];
        }
        return r;
    }
}

// ── 工具函数 ────────────────────────────────────────────

const SUITS: readonly Suit[] = ['W', 'B', 'T'];

/** 创建单花色的 36 张牌池 (rank 1-9 × 4 张) */
function suitPool(suit: Suit): TestTile[] {
    const pool: TestTile[] = [];
    for (let rank = 1; rank <= 9; rank++) {
        for (let copy = 0; copy < 4; copy++) {
            pool.push({ suit, rank });
        }
    }
    return pool;
}

/** 从指定花色随机抽 n 张 */
function drawFromSuit(rng: SeededRNG, suit: Suit, n: number): TestTile[] {
    if (n <= 0) return [];
    return rng.shuffle(suitPool(suit)).slice(0, n);
}

/** 按花色分配数量生成手牌 */
function makeHand(rng: SeededRNG, counts: Record<Suit, number>): TestTile[] {
    const hand: TestTile[] = [];
    for (const suit of SUITS) {
        hand.push(...drawFromSuit(rng, suit, counts[suit]));
    }
    return hand;
}

/** 确保手牌中指定花色至少有一个对子 */
function ensurePairInSuit(rng: SeededRNG, hand: TestTile[], suit: Suit): TestTile[] {
    const suitTiles = hand.filter(t => t.suit === suit);
    const otherTiles = hand.filter(t => t.suit !== suit);

    // 检查是否已有对子
    const rankCounts: Record<number, number> = {};
    for (const t of suitTiles) rankCounts[t.rank] = (rankCounts[t.rank] || 0) + 1;
    if (Object.values(rankCounts).some(c => c >= 2)) return hand;

    // 强制创建对子：把前两张改成同 rank
    if (suitTiles.length >= 2) {
        const rank = rng.int(1, 9);
        suitTiles[0] = { suit, rank };
        suitTiles[1] = { suit, rank };
    }
    return [...suitTiles, ...otherTiles];
}

/** 分配 remaining 张到两个花色，各 ≥ minEach */
function splitTwo(rng: SeededRNG, remaining: number, minEach: number = 3): [number, number] {
    const lo = Math.max(minEach, remaining - 9);
    const hi = Math.min(9, remaining - minEach);
    if (lo > hi) return [Math.floor(remaining / 2), Math.ceil(remaining / 2)];
    const s1 = rng.int(lo, hi);
    return [s1, remaining - s1];
}

// ── 类别生成器 ──────────────────────────────────────────

/**
 * 类别1: clear_que (20例)
 * 最弱花色 0-2 张，天然缺门，只能从另两门选一门换出
 */
function genClearQue(rng: SeededRNG, idx: number): AITestCase {
    const weakSuit = rng.pick(SUITS);
    const weakCount = rng.int(0, 2);
    const others = SUITS.filter(s => s !== weakSuit);
    const [s1, s2] = splitTwo(rng, 14 - weakCount);
    const counts = { W: 0, B: 0, T: 0 } as Record<Suit, number>;
    counts[weakSuit] = weakCount;
    counts[others[0]] = s1;
    counts[others[1]] = s2;
    return {
        id: `EX_CLR_${String(idx).padStart(3, '0')}`,
        category: 'clear_que',
        phase: 'EXCHANGE',
        hand: makeHand(rng, counts),
        tags: [`weak_${weakSuit}`, `weak_count_${weakCount}`],
    };
}

/**
 * 类别2: moderate (20例)
 * 最弱花色 3-4 张，标准决策场景
 */
function genModerate(rng: SeededRNG, idx: number): AITestCase {
    const weakSuit = rng.pick(SUITS);
    const weakCount = rng.int(3, 4);
    const others = SUITS.filter(s => s !== weakSuit);
    const [s1, s2] = splitTwo(rng, 14 - weakCount);
    const counts = { W: 0, B: 0, T: 0 } as Record<Suit, number>;
    counts[weakSuit] = weakCount;
    counts[others[0]] = s1;
    counts[others[1]] = s2;
    return {
        id: `EX_MOD_${String(idx).padStart(3, '0')}`,
        category: 'moderate',
        phase: 'EXCHANGE',
        hand: makeHand(rng, counts),
        tags: [`weak_${weakSuit}`],
    };
}

/**
 * 类别3: balanced (20例)
 * 三门均衡 (4-5-5)，最难决策的场景
 */
function genBalanced(rng: SeededRNG, idx: number): AITestCase {
    const dist = rng.shuffle([4, 5, 5] as number[]);
    const counts: Record<Suit, number> = { W: dist[0], B: dist[1], T: dist[2] };
    return {
        id: `EX_BAL_${String(idx).padStart(3, '0')}`,
        category: 'balanced',
        phase: 'EXCHANGE',
        hand: makeHand(rng, counts),
    };
}

/**
 * 类别4: pair_trap (20例)
 * 最弱花色有对子 — 专门测试 AI 是否会犯"保留缺门对子做碰/将"的错误
 */
function genPairTrap(rng: SeededRNG, idx: number): AITestCase {
    const weakSuit = rng.pick(SUITS);
    const weakCount = rng.int(4, 5); // 4-5张含对子，换3张后剩1-2张
    const others = SUITS.filter(s => s !== weakSuit);
    const [s1, s2] = splitTwo(rng, 14 - weakCount);
    const counts = { W: 0, B: 0, T: 0 } as Record<Suit, number>;
    counts[weakSuit] = weakCount;
    counts[others[0]] = s1;
    counts[others[1]] = s2;
    let hand = makeHand(rng, counts);
    hand = ensurePairInSuit(rng, hand, weakSuit);
    return {
        id: `EX_PAIR_${String(idx).padStart(3, '0')}`,
        category: 'pair_trap',
        phase: 'EXCHANGE',
        hand,
        tags: [`pair_in_${weakSuit}`, 'trap'],
    };
}

/**
 * 类别5: high_fan (20例)
 * 某花色 7+ 张，测试清一色判断能力
 */
function genHighFan(rng: SeededRNG, idx: number): AITestCase {
    const strongSuit = rng.pick(SUITS);
    const strongCount = rng.int(7, 9);
    const others = SUITS.filter(s => s !== strongSuit);
    const remaining = 14 - strongCount;
    // 弱门可以是 0 张
    const [s1, s2] = splitTwo(rng, remaining, 0);
    const counts = { W: 0, B: 0, T: 0 } as Record<Suit, number>;
    counts[strongSuit] = strongCount;
    counts[others[0]] = Math.max(0, s1);
    counts[others[1]] = Math.max(0, s2);
    // 确保总数为 14
    const total = counts.W + counts.B + counts.T;
    if (total !== 14) counts[strongSuit] += 14 - total;
    return {
        id: `EX_FAN_${String(idx).padStart(3, '0')}`,
        category: 'high_fan',
        phase: 'EXCHANGE',
        hand: makeHand(rng, counts),
        tags: [`strong_${strongSuit}`, 'qingyise_candidate'],
    };
}

// ── 公开 API ────────────────────────────────────────────

const EXCHANGE_GENERATORS = [genClearQue, genModerate, genBalanced, genPairTrap, genHighFan];

export function generateExchangeTestCases(seed: number = 42, count: number = 100): AITestCase[] {
    const rng = new SeededRNG(seed);
    const cases: AITestCase[] = [];
    const perCategory = Math.floor(count / EXCHANGE_GENERATORS.length);
    const extra = count - perCategory * EXCHANGE_GENERATORS.length;

    for (let g = 0; g < EXCHANGE_GENERATORS.length; g++) {
        const n = perCategory + (g < extra ? 1 : 0);
        for (let i = 0; i < n; i++) {
            cases.push(EXCHANGE_GENERATORS[g](rng, cases.length + 1));
        }
    }
    return cases;
}

/**
 * 生成指定阶段的测试用例（可扩展）
 * 新阶段: 在此函数中添加 case 分支
 */
export function generateTestCases(
    phase: TestPhase,
    seed: number = 42,
    count: number = 100,
): AITestCase[] {
    switch (phase) {
        case 'EXCHANGE':
            return generateExchangeTestCases(seed, count);
        // case 'DING_QUE':
        //   return generateDingQueTestCases(seed, count);
        // case 'PLAYING':
        //   return generatePlayingTestCases(seed, count);
        default:
            throw new Error(`阶段 ${phase} 的测试用例生成尚未实现。请在 generator.ts 中添加。`);
    }
}
