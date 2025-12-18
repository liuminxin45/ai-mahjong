import type { Action } from '../model/action';
import type { GameEvent } from '../model/event';
import type { GameState } from '../model/state';
import type { Tile } from '../model/tile';
import type { PlayerId } from '../model/types';

export interface RulePack {
  id: string;
  version: string;

  getTileSet(): Tile[];
  buildInitialState(): GameState;

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
  settleRound(state: GameState): unknown;
}
