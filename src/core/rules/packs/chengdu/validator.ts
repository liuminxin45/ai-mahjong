/**
 * 成都麻将出牌校验规则
 */

import type { GameState } from '../../../model/state';
import type { Tile } from '../../../model/tile';
import type { PlayerId } from '../../../model/types';
import type { DiscardValidator, ValidationResult } from '../../validation/types';

type Suit = 'W' | 'B' | 'T';

interface ChengduState extends GameState {
  // 定缺：W=万 B=条 T=筒
  dingQueSelection?: Partial<Record<PlayerId, Suit | undefined>>;
}

/**
 * 成都麻将出牌校验器
 *
 * 核心规则：
 * 1. 定缺后，必须先打完缺门的牌
 * 2. 手中有缺门牌时，不能打其他花色（含“非三门花色”的牌，也视为“其他”）
 * 3. 缺门牌打完后，才能打其他花色
 *
 * 额外健壮性：
 * - 校验要打出的牌必须在手牌里
 * - 对“未定缺/定缺值非法”做容错：按未定缺处理（不限制出牌）
 */
export class ChengduDiscardValidator implements DiscardValidator {
  validateDiscard(state: GameState, playerId: PlayerId, tile: Tile): ValidationResult {
    const chengduState = state as ChengduState;

    const hand = this.getHand(state, playerId);
    if (!hand) {
      return { valid: false, reason: 'Invalid state: hand not found' };
    }

    // 牌必须在手牌中
    if (!this.handContainsTile(hand, tile)) {
      return {
        valid: false,
        reason: 'Invalid discard: tile is not in player hand',
        suggestedTiles: this.uniqueTiles([...hand]),
      };
    }

    const missingSuit = this.getMissingSuit(chengduState, playerId);
    // 未定缺：不限制
    if (!missingSuit) return { valid: true };

    const missingSuitTiles = hand.filter(t => this.getTileSuit(t) === missingSuit);
    const hasMissingSuitTiles = missingSuitTiles.length > 0;

    if (hasMissingSuitTiles) {
      // 有缺门牌：必须打缺门
      if (this.getTileSuit(tile) !== missingSuit) {
        const missingSuitName = this.getSuitName(missingSuit);
        return {
          valid: false,
          reason: `定缺规则：手中仍有${missingSuitName}，必须先打完缺门牌`,
          suggestedTiles: this.uniqueTiles(missingSuitTiles),
        };
      }
    }

    return { valid: true };
  }

  getLegalDiscards(state: GameState, playerId: PlayerId): Tile[] {
    const chengduState = state as ChengduState;
    const hand = this.getHand(state, playerId);
    if (!hand) return [];

    const missingSuit = this.getMissingSuit(chengduState, playerId);
    if (!missingSuit) return this.uniqueTiles([...hand]);

    const missingSuitTiles = hand.filter(t => this.getTileSuit(t) === missingSuit);
    if (missingSuitTiles.length > 0) {
      return this.uniqueTiles(missingSuitTiles);
    }

    return this.uniqueTiles([...hand]);
  }

  getDescription(): string {
    return '成都麻将出牌规则：定缺后必须优先打缺门牌（有缺门则不可打其他花色）';
  }

  // ---------- helpers ----------

  private getHand(state: GameState, playerId: PlayerId): Tile[] | null {
    const handsAny = (state as any)?.hands;
    const hand = handsAny?.[playerId];
    return Array.isArray(hand) ? (hand as Tile[]) : null;
  }

  private getMissingSuit(state: ChengduState, playerId: PlayerId): Suit | undefined {
    const sel = state.dingQueSelection?.[playerId];
    return this.isSuit(sel) ? sel : undefined;
  }

  private isSuit(s: unknown): s is Suit {
    return s === 'W' || s === 'B' || s === 'T';
  }

  /**
   * 兼容 Tile.suit 不是严格 Suit 的情况（比如未来引入字牌/花牌等）
   * - 若为 W/B/T 则返回对应 Suit
   * - 否则返回 undefined（视为“非三门花色”）
   */
  private getTileSuit(tile: Tile): Suit | undefined {
    const suit = (tile as any)?.suit;
    return this.isSuit(suit) ? suit : undefined;
  }

  private getSuitName(suit: Suit): string {
    switch (suit) {
      case 'W':
        return '万 (Wan)';
      case 'B':
        return '条 (Bamboo)';
      case 'T':
        return '筒 (Dot)';
    }
  }

  /**
   * 尽量稳定地判断“同一张牌”：
   * - 优先使用 tile.id
   * - 否则用 suit + (rank/value/num) + 兜底 JSON
   */
  private tileKey(tile: Tile): string {
    const anyTile = tile as any;

    if (anyTile && (typeof anyTile.id === 'string' || typeof anyTile.id === 'number')) {
      return `id:${String(anyTile.id)}`;
    }

    const suit = String(anyTile?.suit ?? '');
    const rank =
      anyTile?.rank ??
      anyTile?.value ??
      anyTile?.num ??
      anyTile?.number ??
      anyTile?.point ??
      '';
    const type = anyTile?.type ?? anyTile?.kind ?? '';

    // 常见麻将牌：suit + rank 已足够；type 作为辅助区分
    const base = `s:${suit}|r:${String(rank)}|t:${String(type)}`;

    // 兜底：尽量提供可区分性（避免全空）
    if (base !== 's:|r:|t:') return base;

    try {
      return `json:${JSON.stringify(anyTile)}`;
    } catch {
      // 最后兜底：引用地址不可得，只能退回到固定字符串
      return 'unknown';
    }
  }

  private handContainsTile(hand: Tile[], tile: Tile): boolean {
    // 先走引用相等（最便宜）
    if (hand.includes(tile)) return true;

    // 再走 key 相等（兼容 tile 不是同一引用）
    const targetKey = this.tileKey(tile);
    return hand.some(t => this.tileKey(t) === targetKey);
  }

  private uniqueTiles(tiles: Tile[]): Tile[] {
    const seen = new Set<string>();
    const out: Tile[] = [];
    for (const t of tiles) {
      const k = this.tileKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }
}

/**
 * 创建成都麻将校验器实例
 */
export function createChengduValidator(): DiscardValidator {
  return new ChengduDiscardValidator();
}
