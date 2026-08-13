import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { AgentDecisionContext } from '../PlayerAgent';
import { decideHigh, decideMid, decideLow } from './policy_high';

export type AlgoDifficulty = 'high' | 'mid' | 'low';

export type AlgoPolicy = (state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext) => Action;

export function policyForDifficulty(d: AlgoDifficulty): AlgoPolicy {
  switch (d) {
    case 'mid':
      return decideMid;
    case 'low':
      return decideLow;
    case 'high':
    default:
      return decideHigh;
  }
}
