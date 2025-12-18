import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { AgentDecisionContext } from '../PlayerAgent';

export function decideLow(_state: GameState, _playerId: PlayerId, legal: Action[], _ctx?: AgentDecisionContext): Action {
  if (legal.length === 0) return { type: 'PASS' };
  const discards = legal.filter((a) => a.type === 'DISCARD');
  const pool = discards.length > 0 ? discards : legal;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
