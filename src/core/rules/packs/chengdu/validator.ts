/**
 * 成都麻将出牌校验规则
 */

import type { GameState } from '../../../model/state';
import type { Tile } from '../../../model/tile';
import type { PlayerId } from '../../../model/types';
import type { DiscardValidator, ValidationResult } from '../../validation/types';

interface ChengduState extends GameState {
  dingQueSelection?: Record<PlayerId, 'W' | 'B' | 'T' | undefined>;
}

/**
 * 成都麻将出牌校验器
 * 
 * 核心规则：
 * 1. 定缺后，必须先打完缺门的牌
 * 2. 手中有缺门牌时，不能打其他花色
 * 3. 缺门牌打完后，才能打其他花色
 */
export class ChengduDiscardValidator implements DiscardValidator {
  validateDiscard(state: GameState, playerId: PlayerId, tile: Tile): ValidationResult {
    const chengduState = state as ChengduState;
    
    // 如果还没有定缺，任何牌都可以打
    if (!chengduState.dingQueSelection?.[playerId]) {
      return { valid: true };
    }

    const missingSuit = chengduState.dingQueSelection[playerId];
    const hand = state.hands[playerId];

    // 检查手中是否还有缺门的牌
    const hasMissingSuitTiles = hand.some(t => t.suit === missingSuit);

    if (hasMissingSuitTiles) {
      // 如果手中还有缺门牌，必须打缺门牌
      if (tile.suit !== missingSuit) {
        const missingSuitName = this.getSuitName(missingSuit);
        return {
          valid: false,
          reason: `Must discard ${missingSuitName} tiles first (missing suit rule)`,
          suggestedTiles: hand.filter(t => t.suit === missingSuit),
        };
      }
    }

    // 其他情况都是合法的
    return { valid: true };
  }

  getLegalDiscards(state: GameState, playerId: PlayerId): Tile[] {
    const chengduState = state as ChengduState;
    const hand = state.hands[playerId];

    // 如果还没有定缺，所有手牌都可以打
    if (!chengduState.dingQueSelection?.[playerId]) {
      return [...hand];
    }

    const missingSuit = chengduState.dingQueSelection[playerId];

    // 检查手中是否还有缺门的牌
    const missingSuitTiles = hand.filter(t => t.suit === missingSuit);

    if (missingSuitTiles.length > 0) {
      // 如果有缺门牌，只能打缺门牌
      return missingSuitTiles;
    }

    // 缺门牌已打完，所有手牌都可以打
    return [...hand];
  }

  getDescription(): string {
    return 'Chengdu Mahjong Discard Rules: Must discard missing suit tiles first';
  }

  private getSuitName(suit: 'W' | 'B' | 'T' | undefined): string {
    switch (suit) {
      case 'W':
        return 'Wan (万)';
      case 'B':
        return 'Bamboo (条)';
      case 'T':
        return 'Dot (筒)';
      default:
        return 'Unknown';
    }
  }
}

/**
 * 创建成都麻将校验器实例
 */
export function createChengduValidator(): DiscardValidator {
  return new ChengduDiscardValidator();
}
