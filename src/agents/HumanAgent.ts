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
      // 如果 timeoutMs 是 Infinity，不设置超时
      let timer: number | undefined;
      if (isFinite(timeoutMs)) {
        timer = globalThis.setTimeout(() => {
          if (!this.pending) return;
          this.pending = null;
          resolve(null);
        }, timeoutMs) as unknown as number;
      }

      this.pending = {
        legal,
        resolve: (a) => {
          if (timer !== undefined) {
            globalThis.clearTimeout(timer as unknown as number);
          }
          resolve(a);
        },
      };
    });
  }

  dispatch(action: Action): void {
    const p = this.pending;
    console.log('[HumanAgent.dispatch] Called with action:', action);
    console.log('[HumanAgent.dispatch] Pending:', p ? 'yes' : 'no');
    if (!p) {
      console.warn('[HumanAgent.dispatch] No pending action, ignoring');
      return;
    }
    console.log('[HumanAgent.dispatch] Legal actions:', p.legal);
    
    // 检查动作类型是否匹配
    const isLegal = p.legal.some((a) => {
      // 对于 EXCHANGE_SELECT，只检查类型，不检查具体的 tiles
      if (action.type === 'EXCHANGE_SELECT' && a.type === 'EXCHANGE_SELECT') {
        return true;
      }
      // 对于其他动作，使用 JSON 比较
      return JSON.stringify(a) === JSON.stringify(action);
    });
    
    console.log('[HumanAgent.dispatch] Is legal?', isLegal);
    if (!isLegal) {
      console.warn('[HumanAgent.dispatch] Action not in legal actions, ignoring');
      return;
    }
    this.pending = null;
    p.resolve(action);
    console.log('[HumanAgent.dispatch] Action dispatched successfully');
  }
}
