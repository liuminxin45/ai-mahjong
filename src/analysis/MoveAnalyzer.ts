import type { Action } from '../core/model/action';
import type { GameState } from '../core/model/state';

export class MoveAnalyzer {
  analyze(_state: GameState, _action: Action): unknown {
    return null;
  }
}
