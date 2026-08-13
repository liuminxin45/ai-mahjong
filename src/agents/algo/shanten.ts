import type { Tile } from '../../core/model/tile';

export type Suit = 'W' | 'B' | 'T';

/**
 * ── 性能说明（Phase 6 打磨）────────────────────────────────────────────
 *
 * 向听（shanten）/ 进张（ukeire）是整个 AI 决策的最内层热路径：
 * 单次 decideHigh 会触发数百次向听计算，单次 detectGameStyle 更多。
 * 因此本模块的三层缓存与 key 编码方式直接决定全局性能。
 *
 * 1) key 编码：27 个计数（每个 0..4）用 String.fromCharCode 打包成 27 字符串，
 *    取代原先的 `counts.join(',')`（约 54 字符 + 数组 join 开销）。
 *    向听 DFS 每个节点都要建 key，这里的常数因子被放大数百倍。
 *
 * 2) 全局缓存：SHANTEN_CACHE / UKEIRE_CACHE 跨调用复用。
 *    缓存满时**淘汰最旧的一半**（Map 保持插入序），而不是停止写入——
 *    后者会让长对局在缓存打满后永久退化为无缓存。
 *
 * 3) UKEIRE_CACHE 只缓存「哪些牌能降低向听」的索引集合（与剩余牌数无关），
 *    调用时再套用 remainingCounts 算出 count/total。
 *    这样既能跨 remainingCounts 复用，又不会把可变数组暴露给调用方。
 */

const SHANTEN_CACHE = new Map<string, number>();
/** key → 能降低向听的牌索引集合（与 remainingCounts 无关，故可跨调用复用） */
const UKEIRE_CACHE = new Map<string, number[]>();
const MAX_CACHE_SIZE = 100000;

/** 缓存满时淘汰最旧的一半（Map 迭代序 = 插入序），保留近期热点局面 */
function evictHalf<K, V>(cache: Map<K, V>): void {
  const drop = cache.size >> 1;
  let i = 0;
  for (const k of cache.keys()) {
    cache.delete(k);
    if (++i >= drop) break;
  }
}

function cacheSet<K, V>(cache: Map<K, V>, key: K, value: V): void {
  if (cache.size >= MAX_CACHE_SIZE) evictHalf(cache);
  cache.set(key, value);
}

/**
 * 清空向听缓存
 */
export function clearShantenCache(): void {
  SHANTEN_CACHE.clear();
  UKEIRE_CACHE.clear();
}

/**
 * 获取缓存统计
 */
export function getShantenCacheStats(): { shantenSize: number; ukeireSize: number } {
  return {
    shantenSize: SHANTEN_CACHE.size,
    ukeireSize: UKEIRE_CACHE.size,
  };
}

function tileToIndex(tile: Tile): number {
  const suitOffset = tile.suit === 'W' ? 0 : tile.suit === 'B' ? 9 : 18;
  return suitOffset + (tile.rank - 1);
}

function indexToTile(idx: number): Tile {
  const suitIndex = Math.floor(idx / 9);
  const suit: Suit = suitIndex === 0 ? 'W' : suitIndex === 1 ? 'B' : 'T';
  const rank = ((idx % 9) + 1) as Tile['rank'];
  return { suit, rank };
}

export function handToCounts(hand: Tile[]): number[] {
  const counts = new Array<number>(27).fill(0);
  for (const t of hand) {
    counts[tileToIndex(t)]++;
  }

  return counts;
}

/**
 * 把 27 个计数打包成 27 字符的字符串。
 * 展开写死 27 个参数，避免 spread/arguments 的额外分配。
 */
function packCounts(c: number[]): string {
  return String.fromCharCode(
    c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8],
    c[9], c[10], c[11], c[12], c[13], c[14], c[15], c[16], c[17],
    c[18], c[19], c[20], c[21], c[22], c[23], c[24], c[25], c[26],
  );
}

function calcShanten(mentsu: number, taatsu: number, hasPair: boolean): number {
  const m = Math.min(mentsu, 4);
  const t = Math.min(taatsu, 4 - m);
  let s = 8 - 2 * m - t - (hasPair ? 1 : 0);
  if (!hasPair && m + t >= 4) s += 1;
  return s;
}

function calcShantenWithMelds(mentsu: number, taatsu: number, hasPair: boolean, meldCount: number): number {
  const totalM = Math.min(4, mentsu + Math.max(0, meldCount));
  const t = Math.min(taatsu, 4 - totalM);
  let s = 8 - 2 * totalM - t - (hasPair ? 1 : 0);
  if (!hasPair && totalM + t >= 4) s += 1;
  return s;
}

/**
 * 向听 DFS 核心。`c` 会在递归中被临时修改，但每个分支都会完整还原，
 * 因此调用方传入的数组在返回时与传入时一致。
 *
 * @param mc meldCount；`useMelds=false` 时走原 calcShanten 公式（与 shantenNormal 语义一致）
 */
function shantenDfs(c: number[], mc: number, useMelds: boolean): number {
  const memo = new Map<string, number>();

  const dfs = (mentsu: number, taatsu: number, hasPair: boolean): number => {
    // mentsu/taatsu ≤ 4、hasPair ∈ {0,1} → 压进一个字符，省一次字符串拼接
    const key = packCounts(c) + String.fromCharCode(mentsu * 18 + taatsu * 2 + (hasPair ? 1 : 0));
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best = useMelds
      ? calcShantenWithMelds(mentsu, taatsu, hasPair, mc)
      : calcShanten(mentsu, taatsu, hasPair);
    if (best === -1) {
      memo.set(key, best);
      return best;
    }

    let i = -1;
    for (let k = 0; k < 27; k++) {
      if (c[k] > 0) {
        i = k;
        break;
      }
    }

    if (i === -1) {
      memo.set(key, best);
      return best;
    }

    const rank = i % 9;

    if (c[i] >= 3) {
      c[i] -= 3;
      best = Math.min(best, dfs(mentsu + 1, taatsu, hasPair));
      c[i] += 3;
    }

    if (rank <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      best = Math.min(best, dfs(mentsu + 1, taatsu, hasPair));
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }

    if (!hasPair && c[i] >= 2) {
      c[i] -= 2;
      best = Math.min(best, dfs(mentsu, taatsu, true));
      c[i] += 2;
    }

    if (c[i] >= 2) {
      c[i] -= 2;
      best = Math.min(best, dfs(mentsu, taatsu + 1, hasPair));
      c[i] += 2;
    }

    if (rank <= 7 && c[i + 1] > 0) {
      c[i]--;
      c[i + 1]--;
      best = Math.min(best, dfs(mentsu, taatsu + 1, hasPair));
      c[i]++;
      c[i + 1]++;
    }

    if (rank <= 6 && c[i + 2] > 0) {
      c[i]--;
      c[i + 2]--;
      best = Math.min(best, dfs(mentsu, taatsu + 1, hasPair));
      c[i]++;
      c[i + 2]++;
    }

    c[i]--;
    best = Math.min(best, dfs(mentsu, taatsu, hasPair));
    c[i]++;

    memo.set(key, best);
    return best;
  };

  return dfs(0, 0, false);
}

/**
 * 基于 counts 数组直接计算「含副露」向听，带全局缓存。
 * 传入的 counts 不会被永久修改。
 */
function shantenFromCountsWithMelds(counts: number[], meldCount: number): number {
  const mc = Math.max(0, meldCount);

  if (mc >= 4) {
    for (let i = 0; i < 27; i++) {
      if (counts[i] >= 2) return -1;
    }
    return 0;
  }

  const key = packCounts(counts) + String.fromCharCode(mc);
  const cached = SHANTEN_CACHE.get(key);
  if (cached !== undefined) return cached;

  const result = shantenDfs(counts, mc, true);
  cacheSet(SHANTEN_CACHE, key, result);
  return result;
}

/** 基于 counts 的「不含副露」向听（shantenNormal 语义），带全局缓存 */
function shantenFromCountsNormal(counts: number[]): number {
  // meldCount 维度用 255 占位，与 shantenFromCountsWithMelds 的 key 空间隔离
  const key = packCounts(counts) + '\u00ff';
  const cached = SHANTEN_CACHE.get(key);
  if (cached !== undefined) return cached;

  const result = shantenDfs(counts, 0, false);
  cacheSet(SHANTEN_CACHE, key, result);
  return result;
}

export function shantenWithMelds(hand: Tile[], meldCount: number): number {
  return shantenFromCountsWithMelds(handToCounts(hand), meldCount);
}

export function shantenNormal(hand: Tile[] | number[]): number {
  let counts: number[];
  if (Array.isArray(hand) && typeof hand[0] === 'number') {
    // 归一化到定长 27，避免短数组让 packCounts 读到 undefined
    counts = new Array<number>(27).fill(0);
    const src = hand as number[];
    const n = Math.min(27, src.length);
    for (let i = 0; i < n; i++) counts[i] = src[i] | 0;
  } else {
    counts = handToCounts(hand as Tile[]);
  }

  return shantenFromCountsNormal(counts);
}

/**
 * 计算「加入哪张牌能降低向听」的索引集合。
 *
 * 与 remainingCounts 无关，因此可安全缓存并跨调用复用。
 * 为与原实现逐位等价，这里对 27 个索引**全部**求值（含手上已有 4 张的牌），
 * 由调用方用 left<=0 过滤，避免因剩余牌数不同而产生不同的候选集。
 */
function improvingIndices(counts: number[], meldCount: number, useMelds: boolean): number[] {
  const key = packCounts(counts) + String.fromCharCode(useMelds ? Math.max(0, meldCount) : 0xff);
  const cached = UKEIRE_CACHE.get(key);
  if (cached !== undefined) return cached;

  const s0 = useMelds ? shantenFromCountsWithMelds(counts, meldCount) : shantenFromCountsNormal(counts);

  const out: number[] = [];
  for (let idx = 0; idx < 27; idx++) {
    counts[idx]++;
    const s1 = useMelds
      ? shantenFromCountsWithMelds(counts, meldCount)
      : shantenFromCountsNormal(counts);
    counts[idx]--;
    if (s1 < s0) out.push(idx);
  }

  cacheSet(UKEIRE_CACHE, key, out);
  return out;
}

export type UkeireResult = {
  tiles: Tile[];
  total: number;
  byTile: Array<{ tile: Tile; count: number }>;
};

/**
 * 由缓存的候选索引集合装配最终结果。
 * 每次都新建数组/对象，保证缓存内容不会被调用方意外修改。
 */
function assembleUkeire(
  improving: number[],
  baseCounts: number[],
  remainingCounts?: number[],
): UkeireResult {
  const byTile: Array<{ tile: Tile; count: number }> = [];
  let total = 0;

  for (const idx of improving) {
    const left = remainingCounts
      ? Math.max(0, remainingCounts[idx] ?? 0)
      : Math.max(0, 4 - baseCounts[idx]);
    if (left <= 0) continue;

    byTile.push({ tile: indexToTile(idx), count: left });
    total += left;
  }

  // 与原实现一致：先按剩余张数降序，再按牌序升序
  byTile.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return tileToIndex(a.tile) - tileToIndex(b.tile);
  });

  return {
    tiles: byTile.map((x) => x.tile),
    total,
    byTile,
  };
}

export function ukeireTiles(hand13: Tile[], remainingCounts?: number[]): UkeireResult {
  const baseCounts = handToCounts(hand13);
  return assembleUkeire(improvingIndices(baseCounts, 0, false), baseCounts, remainingCounts);
}

export function ukeireTilesWithMelds(
  hand: Tile[],
  meldCount: number,
  remainingCounts?: number[],
): UkeireResult {
  const baseCounts = handToCounts(hand);
  return assembleUkeire(improvingIndices(baseCounts, meldCount, true), baseCounts, remainingCounts);
}
