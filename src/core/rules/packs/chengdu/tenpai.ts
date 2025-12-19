import type { Tile } from '../../../model/tile';
import { findWinPatterns } from './patterns';
import { tileEq } from './utils';

/**
 * 检查是否听牌（一张牌即可胡牌）
 * @param hand 手牌（13张）
 * @returns 听牌的牌列表
 */
export function getTenpaiTiles(hand: Tile[]): Tile[] {
  if (hand.length !== 13) {
    return [];
  }

  const tenpaiTiles: Tile[] = [];
  const allPossibleTiles: Tile[] = [];

  // 生成所有可能的牌（W/B/T 1-9）
  const suits: Tile['suit'][] = ['W', 'B', 'T'];
  const ranks: Tile['rank'][] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (const suit of suits) {
    for (const rank of ranks) {
      allPossibleTiles.push({ suit, rank });
    }
  }

  // 测试每张牌是否能胡
  for (const tile of allPossibleTiles) {
    const testHand = [...hand, tile];
    const patterns = findWinPatterns(testHand);
    
    if (patterns.some(p => p.isValid)) {
      // 避免重复
      if (!tenpaiTiles.some(t => tileEq(t, tile))) {
        tenpaiTiles.push(tile);
      }
    }
  }

  return tenpaiTiles;
}

/**
 * 检查是否听牌
 */
export function isTenpai(hand: Tile[]): boolean {
  return getTenpaiTiles(hand).length > 0;
}

/**
 * 计算有效牌数量（进张数）
 * @param hand 手牌（13张）
 * @param remainingTiles 剩余牌堆中的牌
 * @returns 有效牌数量
 */
export function countUkeire(hand: Tile[], remainingTiles: Tile[]): number {
  const tenpaiTiles = getTenpaiTiles(hand);
  let count = 0;

  for (const tenpaiTile of tenpaiTiles) {
    count += remainingTiles.filter(t => tileEq(t, tenpaiTile)).length;
  }

  return count;
}
