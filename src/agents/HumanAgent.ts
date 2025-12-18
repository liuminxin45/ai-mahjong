import type { Action } from '../core/model/action';
import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import type { AgentDecisionContext, PlayerAgent } from './PlayerAgent';

export class HumanAgent implements PlayerAgent {
  private pending: { resolve: (a: Action | null) => void; legal: Action[] } | null = null;

  async decide(_state: GameState, _playerId: PlayerId, legal: Action[], _ctx?: AgentDecisionContext): Promise<Action> {
    const res = await this.awaitAction(legal, 30_000);
    return res ?? legal[0];
  }

  awaitAction(legal: Action[], timeoutMs: number): Promise<Action | null> {
    if (this.pending) {
      return Promise.reject(new Error('HumanAgent already waiting for action'));
    }

    return new Promise<Action | null>((resolve) => {
      const timer = globalThis.setTimeout(() => {
        if (!this.pending) return;
        this.pending = null;
        resolve(null);
      }, timeoutMs) as unknown as number;

      this.pending = {
        legal,
        resolve: (a) => {
          globalThis.clearTimeout(timer as unknown as number);
          resolve(a);
        },
      };
    });
  }

  dispatch(action: Action): void {
    const p = this.pending;
    if (!p) return;
    if (!p.legal.some((a) => JSON.stringify(a) === JSON.stringify(action))) return;
    this.pending = null;
    p.resolve(action);
  }
}
