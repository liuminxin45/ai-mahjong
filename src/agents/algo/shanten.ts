import type { Tile } from '../../core/model/tile';

export type Suit = 'W' | 'B' | 'T';

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

export function shantenWithMelds(hand: Tile[], meldCount: number): number {
  const mc = Math.max(0, meldCount);
  const counts = handToCounts(hand);

  if (mc >= 4) {
    for (const x of counts) {
      if (x >= 2) return -1;
    }
    return 0;
  }

  const memo = new Map<string, number>();

  const dfs = (c: number[], mentsu: number, taatsu: number, hasPair: boolean): number => {
    const key = `${c.join(',')}|${mentsu}|${taatsu}|${hasPair ? 1 : 0}|${mc}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best = calcShantenWithMelds(mentsu, taatsu, hasPair, mc);
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
      best = Math.min(best, dfs(c, mentsu + 1, taatsu, hasPair));
      c[i] += 3;
    }

    if (rank <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      best = Math.min(best, dfs(c, mentsu + 1, taatsu, hasPair));
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }

    if (!hasPair && c[i] >= 2) {
      c[i] -= 2;
      best = Math.min(best, dfs(c, mentsu, taatsu, true));
      c[i] += 2;
    }

    if (c[i] >= 2) {
      c[i] -= 2;
      best = Math.min(best, dfs(c, mentsu, taatsu + 1, hasPair));
      c[i] += 2;
    }

    if (rank <= 7 && c[i + 1] > 0) {
      c[i]--;
      c[i + 1]--;
      best = Math.min(best, dfs(c, mentsu, taatsu + 1, hasPair));
      c[i]++;
      c[i + 1]++;
    }

    if (rank <= 6 && c[i + 2] > 0) {
      c[i]--;
      c[i + 2]--;
      best = Math.min(best, dfs(c, mentsu, taatsu + 1, hasPair));
      c[i]++;
      c[i + 2]++;
    }

    c[i]--;
    best = Math.min(best, dfs(c, mentsu, taatsu, hasPair));
    c[i]++;

    memo.set(key, best);
    return best;
  };

  return dfs(counts, 0, 0, false);
}

export function shantenNormal(hand: Tile[] | number[]): number {
  const counts = Array.isArray(hand) && typeof hand[0] === 'number'
    ? (hand as number[]).slice(0, 27)
    : handToCounts(hand as Tile[]);

  const memo = new Map<string, number>();

  const dfs = (c: number[], mentsu: number, taatsu: number, hasPair: boolean): number => {
    const key = `${c.join(',')}|${mentsu}|${taatsu}|${hasPair ? 1 : 0}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best = calcShanten(mentsu, taatsu, hasPair);
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
      best = Math.min(best, dfs(c, mentsu + 1, taatsu, hasPair));
      c[i] += 3;
    }

    if (rank <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      best = Math.min(best, dfs(c, mentsu + 1, taatsu, hasPair));
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }

    if (!hasPair && c[i] >= 2) {
      c[i] -= 2;
      best = Math.min(best, dfs(c, mentsu, taatsu, true));
      c[i] += 2;
    }

    if (c[i] >= 2) {
      c[i] -= 2;
      best = Math.min(best, dfs(c, mentsu, taatsu + 1, hasPair));
      c[i] += 2;
    }

    if (rank <= 7 && c[i + 1] > 0) {
      c[i]--;
      c[i + 1]--;
      best = Math.min(best, dfs(c, mentsu, taatsu + 1, hasPair));
      c[i]++;
      c[i + 1]++;
    }

    if (rank <= 6 && c[i + 2] > 0) {
      c[i]--;
      c[i + 2]--;
      best = Math.min(best, dfs(c, mentsu, taatsu + 1, hasPair));
      c[i]++;
      c[i + 2]++;
    }

    c[i]--;
    best = Math.min(best, dfs(c, mentsu, taatsu, hasPair));
    c[i]++;

    memo.set(key, best);
    return best;
  };

  return dfs(counts, 0, 0, false);
}

export function ukeireTiles(
  hand13: Tile[],
  remainingCounts?: number[],
): {
  tiles: Tile[];
  total: number;
  byTile: Array<{ tile: Tile; count: number }>;
} {
  const baseCounts = handToCounts(hand13);
  const s0 = shantenNormal(baseCounts);

  const byTile: Array<{ tile: Tile; count: number }> = [];
  let total = 0;

  for (let idx = 0; idx < 27; idx++) {
    const left = remainingCounts
      ? Math.max(0, remainingCounts[idx] ?? 0)
      : Math.max(0, 4 - baseCounts[idx]);

    if (left <= 0) continue;

    const tile = indexToTile(idx);
    const s1 = shantenNormal(hand13.concat([tile]));
    if (s1 < s0) {
      byTile.push({ tile, count: left });
      total += left;
    }
  }

  byTile.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const sa = tileToIndex(a.tile);
    const sb = tileToIndex(b.tile);
    return sa - sb;
  });

  return {
    tiles: byTile.map((x) => x.tile),
    total,
    byTile,
  };
}

export function ukeireTilesWithMelds(
  hand: Tile[],
  meldCount: number,
  remainingCounts?: number[],
): {
  tiles: Tile[];
  total: number;
  byTile: Array<{ tile: Tile; count: number }>;
} {
  const baseCounts = handToCounts(hand);
  const s0 = shantenWithMelds(hand, meldCount);

  const byTile: Array<{ tile: Tile; count: number }> = [];
  let total = 0;

  for (let idx = 0; idx < 27; idx++) {
    const left = remainingCounts
      ? Math.max(0, remainingCounts[idx] ?? 0)
      : Math.max(0, 4 - baseCounts[idx]);

    if (left <= 0) continue;

    const tile = indexToTile(idx);
    const s1 = shantenWithMelds(hand.concat([tile]), meldCount);
    if (s1 < s0) {
      byTile.push({ tile, count: left });
      total += left;
    }
  }

  byTile.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const sa = tileToIndex(a.tile);
    const sb = tileToIndex(b.tile);
    return sa - sb;
  });

  return {
    tiles: byTile.map((x) => x.tile),
    total,
    byTile,
  };
}
