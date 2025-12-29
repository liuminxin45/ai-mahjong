import type { Tile } from '../../../model/tile';

const winPatternCache = new Map<string, WinPattern[]>();
const CACHE_MAX_SIZE = 1000;

function tileArrayToKey(tiles: Tile[]): string {
  return tiles
    .slice()
    .sort((a, b) => {
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      return a.rank - b.rank;
    })
    .map(t => `${t.suit}${t.rank}`)
    .join(',');
}

export type TileGroup = {
  type: 'SHUN' | 'KE' | 'JIANG';
  tiles: Tile[];
};

export type WinPattern = {
  groups: TileGroup[];
  isValid: boolean;
};

export type YakuType =
  | 'PING_HU'           // 平胡（基础胡牌）
  | 'DUI_DUI_HU'        // 对对胡（全刻子）
  | 'QING_YI_SE'        // 清一色（单一花色）
  | 'HUN_YI_SE'         // 混一色（单一花色+字牌）
  | 'QUAN_DAI_YAO'      // 全带幺（每组都有幺九）
  | 'QI_DUI_ZI'         // 七对子
  | 'LONG_QI_DUI'       // 龙七对（七对中含四张同牌）
  | 'GANG_SHANG_KAI_HUA' // 杠上开花
  | 'QIANG_GANG_HU'     // 抢杠胡
  | 'HAI_DI_LAO_YUE'    // 海底捞月
  | 'TIAN_HU'           // 天胡（头家第一张胡牌）
  | 'DI_HU'             // 地胡（非头家第一巡点炮胡牌）
  | 'ZI_MO'             // 自摸
  | 'JIN_GOU_DIAO';     // 金钩钓（单钓将）

export type Yaku = {
  type: YakuType;
  fan: number;
  description: string;
};

function tileEq(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function sortTiles(tiles: Tile[]): Tile[] {
  return tiles.slice().sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.rank - b.rank;
  });
}

function isYaoJiu(tile: Tile): boolean {
  return tile.rank === 1 || tile.rank === 9;
}

function countTiles(tiles: Tile[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tiles) {
    const key = `${t.suit}-${t.rank}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

export function findWinPatterns(hand: Tile[]): WinPattern[] {
  // 验证手牌数量：必须是 n * 3 + 2 (n >= 0)
  // 例如: 2张(0*3+2), 5张(1*3+2), 8张(2*3+2), 11张(3*3+2), 14张(4*3+2)
  if (hand.length < 2 || (hand.length - 2) % 3 !== 0) {
    return [{ groups: [], isValid: false }];
  }

  const cacheKey = tileArrayToKey(hand);
  const cached = winPatternCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const sorted = sortTiles(hand);
  const patterns: WinPattern[] = [];

  const counts = countTiles(sorted);
  
  for (const [key, count] of counts.entries()) {
    if (count >= 2) {
      const [suit, rank] = key.split('-');
      const jiangTile: Tile = { suit: suit as Tile['suit'], rank: parseInt(rank) as Tile['rank'] };
      
      let remainingCount = count;
      const remaining = sorted.filter(t => {
        if (tileEq(t, jiangTile)) {
          if (remainingCount === 2) return false;
          remainingCount--;
          return remainingCount > 0;
        }
        return true;
      });

      const groups = tryFormGroups(remaining);
      if (groups) {
        patterns.push({
          groups: [{ type: 'JIANG', tiles: [jiangTile, jiangTile] }, ...groups],
          isValid: true,
        });
      }
    }
  }

  // 七对子和龙七对只能在14张牌时检测
  if (hand.length === 14) {
    const qiDui = checkQiDuiZi(sorted);
    if (qiDui) patterns.push(qiDui);
  }

  const result = patterns.length > 0 ? patterns : [{ groups: [], isValid: false }];

  if (winPatternCache.size >= CACHE_MAX_SIZE) {
    const firstKey = winPatternCache.keys().next().value;
    if (firstKey) winPatternCache.delete(firstKey);
  }
  winPatternCache.set(cacheKey, result);

  return result;
}

function tryFormGroups(tiles: Tile[]): TileGroup[] | null {
  if (tiles.length === 0) return [];
  if (tiles.length % 3 !== 0) return null;

  const sorted = sortTiles(tiles);
  
  const first = sorted[0];
  const sameCount = sorted.filter(t => tileEq(t, first)).length;

  if (sameCount >= 3) {
    const ke: TileGroup = { type: 'KE', tiles: [first, first, first] };
    const remaining = sorted.slice(3);
    const rest = tryFormGroups(remaining);
    if (rest !== null) return [ke, ...rest];
  }

  if (first.rank <= 7) {
    const second: Tile = { suit: first.suit, rank: (first.rank + 1) as Tile['rank'] };
    const third: Tile = { suit: first.suit, rank: (first.rank + 2) as Tile['rank'] };
    
    const hasSecond = sorted.some(t => tileEq(t, second));
    const hasThird = sorted.some(t => tileEq(t, third));

    if (hasSecond && hasThird) {
      const shun: TileGroup = { type: 'SHUN', tiles: [first, second, third] };
      const remaining = sorted.slice(1).filter(t => !tileEq(t, second)).filter(t => !tileEq(t, third));
      const rest = tryFormGroups(remaining);
      if (rest !== null) return [shun, ...rest];
    }
  }

  return null;
}

function checkQiDuiZi(tiles: Tile[]): WinPattern | null {
  if (tiles.length !== 14) return null;
  
  const counts = countTiles(tiles);
  // 七对：7 种牌各 2 张
  // 龙七对：6 种牌，其中 1 种 4 张（算两对）+ 5 种 2 张
  let quadKey: string | null = null;
  if (counts.size === 7) {
    for (const count of counts.values()) {
      if (count !== 2) return null;
    }
  } else if (counts.size === 6) {
    for (const [key, count] of counts.entries()) {
      if (count === 4) {
        if (quadKey) return null;
        quadKey = key;
      } else if (count !== 2) {
        return null;
      }
    }
    if (!quadKey) return null;
  } else {
    return null;
  }

  const groups: TileGroup[] = [];
  const processed = new Set<string>();
  
  for (const tile of tiles) {
    const key = `${tile.suit}-${tile.rank}`;
    if (processed.has(key)) continue;
    const c = counts.get(key) || 0;
    if (c === 4) {
      // 四张算两对
      groups.push({ type: 'JIANG', tiles: [tile, tile] });
      groups.push({ type: 'JIANG', tiles: [tile, tile] });
    } else {
      groups.push({ type: 'JIANG', tiles: [tile, tile] });
    }
    processed.add(key);
  }

  if (groups.length !== 7) return null;

  return { groups, isValid: true };
}

export function detectYaku(
  pattern: WinPattern,
  hand: Tile[],
  winTile: Tile,
  isSelfDraw: boolean,
  _meldCount: number,
  isGangShangKaiHua: boolean,
  isQiangGang: boolean,
  isHaiDi: boolean,
  isTianHu: boolean,
  isDiHu: boolean
): Yaku[] {
  const yakuList: Yaku[] = [];

  if (!pattern.isValid) return yakuList;

  if (isTianHu) {
    yakuList.push({ type: 'TIAN_HU', fan: 4, description: '天胡' });
  }

  if (isDiHu) {
    yakuList.push({ type: 'DI_HU', fan: 4, description: '地胡' });
  }

  if (pattern.groups.length === 7 && pattern.groups.every(g => g.type === 'JIANG')) {
    const counts = countTiles(hand);
    const hasQuad = Array.from(counts.values()).some((c) => c === 4);
    if (hasQuad) {
      yakuList.push({ type: 'LONG_QI_DUI', fan: 3, description: '龙七对' });
    } else {
      yakuList.push({ type: 'QI_DUI_ZI', fan: 2, description: '七对子' });
    }
    if (isSelfDraw) yakuList.push({ type: 'ZI_MO', fan: 1, description: '自摸' });
    if (isGangShangKaiHua) yakuList.push({ type: 'GANG_SHANG_KAI_HUA', fan: 2, description: '杠上开花' });
    if (isQiangGang) yakuList.push({ type: 'QIANG_GANG_HU', fan: 2, description: '抢杠胡' });
    if (isHaiDi) yakuList.push({ type: 'HAI_DI_LAO_YUE', fan: 2, description: '海底捞月' });
    return yakuList;
  }

  const suits = new Set(hand.map(t => t.suit));
  if (suits.size === 1) {
    yakuList.push({ type: 'QING_YI_SE', fan: 2, description: '清一色' });
  }

  const allKe = pattern.groups.filter(g => g.type !== 'JIANG').every(g => g.type === 'KE');
  if (allKe) {
    yakuList.push({ type: 'DUI_DUI_HU', fan: 2, description: '对对胡' });
  }

  if (isGangShangKaiHua) {
    yakuList.push({ type: 'GANG_SHANG_KAI_HUA', fan: 2, description: '杠上开花' });
  }

  if (isQiangGang) {
    yakuList.push({ type: 'QIANG_GANG_HU', fan: 2, description: '抢杠胡' });
  }

  if (isHaiDi) {
    yakuList.push({ type: 'HAI_DI_LAO_YUE', fan: 2, description: '海底捞月' });
  }

  const allWithYaoJiu = pattern.groups.every(g => g.tiles.some(t => isYaoJiu(t)));
  if (allWithYaoJiu && !allKe) {
    yakuList.push({ type: 'QUAN_DAI_YAO', fan: 2, description: '全带幺' });
  }

  if (isSelfDraw) {
    yakuList.push({ type: 'ZI_MO', fan: 1, description: '自摸' });
  }

  // 金钩钓（单钓将）
  const jiangGroup = pattern.groups.find(g => g.type === 'JIANG');
  if (jiangGroup && jiangGroup.tiles.some(t => tileEq(t, winTile))) {
    yakuList.push({ type: 'JIN_GOU_DIAO', fan: 2, description: '金钩钓' });
  }

  if (yakuList.length === 0) {
    yakuList.push({ type: 'PING_HU', fan: 1, description: '平胡' });
  }

  return yakuList;
}

/**
 * 检查是否满足"缺一门"规则
 * @param hand 手牌
 * @param melds 副露（碰、杠）
 * @param missingSuit 玩家定缺的花色（成都规则）
 * @returns true表示满足缺一门，false表示不满足
 */
export function hasQueYiMen(hand: Tile[], melds?: Array<{ type: string; tile: Tile }>, missingSuit?: 'W' | 'B' | 'T'): boolean {
  const allTiles = [...hand];
  
  // 收集副露的牌
  if (melds) {
    for (const meld of melds) {
      if (meld.type === 'PENG' || meld.type === 'GANG') {
        allTiles.push(meld.tile, meld.tile, meld.tile);
      }
    }
  }
  
  // 成都规则：如果指定了定缺花色，必须完全没有该花色的牌
  if (missingSuit) {
    const hasMissingSuit = allTiles.some(t => t.suit === missingSuit);
    if (hasMissingSuit) {
      return false; // 手牌中还有定缺的花色，不满足
    }
    return true; // 手牌中没有定缺的花色，满足
  }
  
  // 通用规则：统计花色
  const suits = new Set(allTiles.map(t => t.suit));
  
  // 只统计万条筒三种花色
  const numSuits = ['W', 'B', 'T'].filter(s => suits.has(s as Tile['suit'])).length;
  
  // 必须缺少至少一种花色（最多只有2种花色）
  return numSuits <= 2;
}

export function calculateScore(yakuList: Yaku[], genCount: number = 0): number {
  const yakuFan = yakuList.reduce((sum, y) => sum + y.fan, 0);
  // 成都规则包优化：底分 5 分；每个杠算 1 番（genCount 参数沿用，但语义调整为“杠番”）
  const totalFan = yakuFan + genCount;
  if (totalFan <= 0) return 0;
  return 5 * Math.pow(2, totalFan - 1);
}
