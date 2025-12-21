import type { Action } from '../model/action';
import type { GameEvent } from '../model/event';
import type { GameState } from '../model/state';
import type { Tile } from '../model/tile';
import type { PlayerId } from '../model/types';
import type { DiscardValidator } from './validation/types';

export interface RoundResult {
  scores: Record<PlayerId, number>;
  dealIns: Record<PlayerId, {
    count: number;
    stageB: number;
    stageC: number;
  }>;
}

export interface RulePack {
  id: string;
  version: string;

  getTileSet(): Tile[];
  buildInitialState(): GameState;
  
  /**
   * 获取出牌校验器（可选）
   * 如果规则包需要特殊的出牌校验规则，可以返回校验器
   */
  getDiscardValidator?(): DiscardValidator | null;

  getCurrentActor(state: GameState): PlayerId;
  getLegalActions(state: GameState, player: PlayerId): Action[];
  applyAction(state: GameState, action: Action): GameState;

  collectReactions(
    state: GameState,
    discardAction: Action,
  ): Array<{ playerId: PlayerId; action: Action }>;

  resolveReactions(
    state: GameState,
    reactions: Array<{ playerId: PlayerId; action: Action }>,
  ): { state: GameState; events: GameEvent[] };

  isRoundEnd(state: GameState): boolean;
  settleRound(state: GameState): RoundResult;
}
