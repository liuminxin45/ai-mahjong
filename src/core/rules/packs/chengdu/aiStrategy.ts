import type { Tile } from '../../../model/tile';

/**
 * 评估一张牌的价值
 * 孤张 < 边张 < 中张 < 对子 < 顺子组成部分 < 刻子
 */
function evaluateTileValue(tile: Tile, hand: Tile[]): number {
  const sameTiles = hand.filter(t => t.suit === tile.suit && t.rank === tile.rank);
  const count = sameTiles.length;
  
  // 刻子（3张相同）= 最高价值
  if (count >= 3) return 100;
  
  // 对子（2张相同）= 高价值
  if (count >= 2) return 80;
  
  // 检查是否是顺子的一部分
  const suit = tile.suit;
  const rank = tile.rank;
  
  // 中张（3-7）更容易组成顺子
  if (rank >= 3 && rank <= 7) {
    const hasLeft = hand.some(t => t.suit === suit && t.rank === rank - 1);
    const hasRight = hand.some(t => t.suit === suit && t.rank === rank + 1);
    const hasLeft2 = hand.some(t => t.suit === suit && t.rank === rank - 2);
    const hasRight2 = hand.some(t => t.suit === suit && t.rank === rank + 2);
    
    // 已经形成顺子
    if (hasLeft && hasRight) return 90;
    
    // 两面搭子
    if ((hasLeft && hasRight2) || (hasRight && hasLeft2)) return 70;
    
    // 单面搭子
    if (hasLeft || hasRight) return 60;
    
    // 中张孤张
    return 40;
  }
  
  // 边张（1, 2, 8, 9）
  if (rank === 1 || rank === 9) {
    const hasNear = hand.some(t => t.suit === suit && (t.rank === rank + 1 || t.rank === rank - 1));
    if (hasNear) return 50;
    return 20; // 边张孤张
  }
  
  if (rank === 2 || rank === 8) {
    const hasNear = hand.some(t => t.suit === suit && Math.abs(t.rank - rank) <= 1);
    if (hasNear) return 55;
    return 25;
  }
  
  return 30; // 默认
}

/**
 * 智能选择换三张的牌
 * 策略：
 * 1. 优先换出孤张和边张
 * 2. 尽量保留对子、刻子、顺子
 * 3. 选择同一花色，且价值最低的3张
 */
export function selectExchangeTiles(hand: Tile[]): Tile[] {
  const suits = ['W', 'B', 'T'] as const;
  
  let bestExchange: { tiles: Tile[]; totalValue: number } | null = null;
  
  for (const suit of suits) {
    const sameSuitTiles = hand.filter(t => t.suit === suit);
    if (sameSuitTiles.length < 3) continue;
    
    // 评估每张牌的价值
    const tilesWithValue = sameSuitTiles.map(tile => ({
      tile,
      value: evaluateTileValue(tile, hand),
    }));
    
    // 按价值从低到高排序，选择价值最低的3张
    tilesWithValue.sort((a, b) => a.value - b.value);
    const selectedTiles = tilesWithValue.slice(0, 3).map(tv => tv.tile);
    const totalValue = tilesWithValue.slice(0, 3).reduce((sum, tv) => sum + tv.value, 0);
    
    if (!bestExchange || totalValue < bestExchange.totalValue) {
      bestExchange = { tiles: selectedTiles, totalValue };
    }
  }
  
  return bestExchange?.tiles || hand.slice(0, 3);
}

/**
 * 评估一个花色的"可缺性"
 * 分数越低，越适合作为缺门
 */
function evaluateSuitForDingQue(suit: 'W' | 'B' | 'T', hand: Tile[]): number {
  const sameSuitTiles = hand.filter(t => t.suit === suit);
  const count = sameSuitTiles.length;
  
  // 基础分数：牌数越多，分数越高（但权重降低，因为换三张后牌数变化大）
  let score = count * 8;
  
  // 如果只有1-2张，非常适合作为缺门
  if (count <= 2) {
    score = count * 5;
  }
  
  // 检查是否有对子或刻子
  const rankCounts = new Map<number, number>();
  for (const tile of sameSuitTiles) {
    rankCounts.set(tile.rank, (rankCounts.get(tile.rank) || 0) + 1);
  }
  
  for (const [_, cnt] of rankCounts) {
    if (cnt >= 3) score += 60; // 刻子（提高权重，绝对不能缺）
    else if (cnt >= 2) score += 35; // 对子（提高权重）
  }
  
  // 检查是否有顺子
  const ranks = Array.from(rankCounts.keys()).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length - 2; i++) {
    if (ranks[i + 1] === ranks[i] + 1 && ranks[i + 2] === ranks[i] + 2) {
      score += 45; // 顺子（提高权重）
    }
  }
  
  // 检查搭子（两张连续的牌）
  for (let i = 0; i < ranks.length - 1; i++) {
    if (ranks[i + 1] === ranks[i] + 1) {
      score += 25; // 搭子（提高权重）
    }
  }
  
  // 检查孤张（单独的牌，容易打出）
  let isolatedCount = 0;
  for (const [rank, cnt] of rankCounts) {
    if (cnt === 1) {
      // 检查是否是孤张（没有相邻的牌）
      const hasAdjacent = ranks.some(r => Math.abs(r - rank) === 1);
      if (!hasAdjacent) {
        isolatedCount++;
      }
    }
  }
  
  // 孤张多的花色更容易打完，降低分数
  score -= isolatedCount * 15;
  
  return score;
}

/**
 * 智能选择定缺花色
 * 策略：
 * 1. 选择牌数最少的花色
 * 2. 如果牌数相同，选择组合价值最低的（孤张多的）
 * 3. 避免选择已有刻子或顺子的花色
 */
export function selectDingQueSuit(hand: Tile[]): 'W' | 'B' | 'T' {
  const suits = ['W', 'B', 'T'] as const;
  
  const suitScores = suits.map(suit => ({
    suit,
    score: evaluateSuitForDingQue(suit, hand),
  }));
  
  // 按分数从低到高排序，选择分数最低的（最容易缺的）
  suitScores.sort((a, b) => a.score - b.score);
  
  return suitScores[0].suit;
}
