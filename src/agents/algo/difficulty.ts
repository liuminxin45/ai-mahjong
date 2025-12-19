import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { AgentDecisionContext } from '../PlayerAgent';
import { decideHigh } from './policy_high';

export type AlgoDifficulty = 'high';

export type AlgoPolicy = (state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext) => Action;

export function policyForDifficulty(_d: AlgoDifficulty): AlgoPolicy {
  return decideHigh;
}
