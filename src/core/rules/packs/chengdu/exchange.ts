import type { Tile } from '../../../model/tile';
import type { PlayerId } from '../../../model/types';

/**
 * 验证换三张的牌是否有效
 * @param tiles 要换的3张牌
 * @returns true表示有效（同花色），false表示无效
 */
export function validateExchangeTiles(tiles: Tile[]): boolean {
  if (tiles.length !== 3) {
    return false;
  }
  
  // 检查是否同花色
  const firstSuit = tiles[0].suit;
  return tiles.every(t => t.suit === firstSuit);
}

/**
 * 执行换三张
 * @param selections 每个玩家选择的牌
 * @param direction 传递方向
 * @returns 换牌后每个玩家获得的牌
 */
export function performExchange(
  selections: Record<PlayerId, Tile[]>,
  direction: 'CLOCKWISE' | 'COUNTER_CLOCKWISE' | 'OPPOSITE'
): Record<PlayerId, Tile[]> {
  const players: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
  const result: Record<PlayerId, Tile[]> = {
    P0: [],
    P1: [],
    P2: [],
    P3: [],
  };
  
  for (let i = 0; i < players.length; i++) {
    const from = players[i];
    let toIndex: number;
    
    if (direction === 'CLOCKWISE') {
      toIndex = (i + 1) % 4;
    } else if (direction === 'COUNTER_CLOCKWISE') {
      toIndex = (i + 3) % 4;
    } else {
      // OPPOSITE
      toIndex = (i + 2) % 4;
    }
    
    const to = players[toIndex];
    result[to] = selections[from];
  }
  
  return result;
}

/**
 * 从手牌中移除指定的牌
 * @param hand 手牌
 * @param tilesToRemove 要移除的牌
 * @returns 移除后的手牌，如果无法移除则返回null
 */
export function removeTilesFromHand(hand: Tile[], tilesToRemove: Tile[]): Tile[] | null {
  const remaining = [...hand];
  
  for (const tileToRemove of tilesToRemove) {
    const index = remaining.findIndex(t => 
      t.suit === tileToRemove.suit && t.rank === tileToRemove.rank
    );
    
    if (index === -1) {
      return null; // 找不到要移除的牌
    }
    
    remaining.splice(index, 1);
  }
  
  return remaining;
}
