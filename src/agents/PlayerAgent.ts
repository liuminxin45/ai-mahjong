import type { Action } from '../core/model/action';
import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import type { AgentStyleContext } from './algo/style';
import type { OpponentModelSnapshot } from './algo/opponentModel';
import type { StrategyParams } from '../meta/metaStrategy';

export type AgentDecisionContext = {
  style: AgentStyleContext;
  opponentSnapshot?: OpponentModelSnapshot;
  metaParams?: StrategyParams;
};

export interface PlayerAgent {
  decide(state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext): Promise<Action>;
}
