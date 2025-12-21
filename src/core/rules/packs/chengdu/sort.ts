import type { Tile } from '../../../model/tile';

/**
 * 麻将手牌排序函数
 * 排序规则：
 * 1. 按花色排序：万(W) < 条(B) < 筒(T)
 * 2. 同花色按点数排序：1 < 2 < ... < 9
 */
export function sortTiles(tiles: Tile[]): Tile[] {
  const suitOrder: Record<string, number> = { W: 0, B: 1, T: 2 };
  
  return tiles.slice().sort((a, b) => {
    // 先按花色排序
    if (a.suit !== b.suit) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    // 同花色按点数排序
    return a.rank - b.rank;
  });
}

/**
 * 对手牌进行分组排序
 * 返回按花色分组的手牌
 */
export function groupAndSortTiles(tiles: Tile[]): {
  wan: Tile[];
  tiao: Tile[];
  tong: Tile[];
} {
  const sorted = sortTiles(tiles);
  
  return {
    wan: sorted.filter(t => t.suit === 'W'),
    tiao: sorted.filter(t => t.suit === 'B'),
    tong: sorted.filter(t => t.suit === 'T'),
  };
}

/**
 * 获取排序后的扁平化手牌
 * 顺序：万 → 条 → 筒
 */
export function getSortedHand(tiles: Tile[]): Tile[] {
  const grouped = groupAndSortTiles(tiles);
  return [...grouped.wan, ...grouped.tiao, ...grouped.tong];
}

/**
 * 带定缺的手牌排序
 * 定缺的花色牌放到最右边
 */
export function sortTilesWithMissingSuit(tiles: Tile[], missingSuit?: 'W' | 'B' | 'T'): Tile[] {
  if (!missingSuit) {
    return sortTiles(tiles);
  }
  
  // 将牌分为非定缺牌和定缺牌
  const nonMissing = tiles.filter(t => t.suit !== missingSuit);
  const missing = tiles.filter(t => t.suit === missingSuit);
  
  // 分别排序
  const sortedNonMissing = sortTiles(nonMissing);
  const sortedMissing = sortTiles(missing);
  
  // 非定缺牌在左，定缺牌在右
  return [...sortedNonMissing, ...sortedMissing];
}
