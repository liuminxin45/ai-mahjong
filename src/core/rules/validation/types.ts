/**
 * 出牌校验模块
 * 每个规则包可以定义自己的出牌校验规则
 */

import type { GameState } from '../../model/state';
import type { Tile } from '../../model/tile';
import type { PlayerId } from '../../model/types';

/**
 * 校验结果
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  suggestedTiles?: Tile[];
}

/**
 * 出牌校验器接口
 */
export interface DiscardValidator {
  /**
   * 校验是否可以打出指定的牌
   * @param state 当前游戏状态
   * @param playerId 玩家ID
   * @param tile 要打出的牌
   * @returns 校验结果
   */
  validateDiscard(state: GameState, playerId: PlayerId, tile: Tile): ValidationResult;

  /**
   * 获取所有合法的出牌选项
   * @param state 当前游戏状态
   * @param playerId 玩家ID
   * @returns 合法的牌列表
   */
  getLegalDiscards(state: GameState, playerId: PlayerId): Tile[];

  /**
   * 获取校验规则的描述
   */
  getDescription(): string;
}
