import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { AgentDecisionContext } from '../PlayerAgent';
import { decideLow } from './policy_low';
import { decideMid } from './policy_mid';
import { decideHigh } from './policy_high';

export type AlgoDifficulty = 'low' | 'mid' | 'high';

export type AlgoPolicy = (state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext) => Action;

export function policyForDifficulty(d: AlgoDifficulty): AlgoPolicy {
  if (d === 'low') return decideLow;
  if (d === 'high') return decideHigh;
  return decideMid;
}
