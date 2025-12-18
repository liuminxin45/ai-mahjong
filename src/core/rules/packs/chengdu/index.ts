import type { Action } from '../../../model/action';
import type { GameEvent } from '../../../model/event';
import type { GameState, Meld } from '../../../model/state';
import type { Tile } from '../../../model/tile';
import { nextPlayerId, type PlayerId } from '../../../model/types';
import type { RulePack } from '../../RulePack';
import { placeholderRulePack } from '../placeholder';
import { ruleConfig } from './rule.config';
import { shantenWithMelds } from '../../../../agents/algo/shanten';

function tileEq(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function removeNTiles(hand: Tile[], tile: Tile, n: number): Tile[] | null {
  let remaining = n;
  const out: Tile[] = [];
  for (const t of hand) {
    if (remaining > 0 && tileEq(t, tile)) {
      remaining--;
    } else {
      out.push(t);
    }
  }
  return remaining === 0 ? out : null;
}

function nextActivePlayer(state: GameState, from: PlayerId): PlayerId {
  let p = nextPlayerId(from);
  for (let i = 0; i < 4; i++) {
    if (!state.declaredHu[p]) return p;
    p = nextPlayerId(p);
  }
  return nextPlayerId(from);
}

function now(): number {
  return Date.now();
}

export const chengduRulePack: RulePack = {
  ...placeholderRulePack,
  id: ruleConfig.id,
  version: ruleConfig.version,

  getLegalActions(state: GameState, player: PlayerId): Action[] {
    if (state.phase !== 'PLAYING') return [];
    if (state.declaredHu[player]) return [{ type: 'PASS' }];

    if (state.lastDiscard) {
      const { tile, from } = state.lastDiscard;
      if (player === from) return [{ type: 'PASS' }];

      const legal: Action[] = [{ type: 'PASS' }];

      const meldCount = state.melds[player].length;
      const win = shantenWithMelds(state.hands[player].concat([tile]), meldCount) === -1;
      if (win) legal.push({ type: 'HU', tile, from });

      const inHand = state.hands[player].filter((t) => tileEq(t, tile)).length;
      if (inHand >= 3) {
        legal.push({ type: 'GANG', tile, from, gangType: 'MING' });
      }
      if (inHand >= 2) {
        legal.push({ type: 'PENG', tile, from });
      }

      return legal;
    }

    return placeholderRulePack.getLegalActions(state, player);
  },

  applyAction(state: GameState, action: Action): GameState {
    if (!state.lastDiscard) {
      return placeholderRulePack.applyAction(state, action);
    }

    if (action.type === 'PASS') return placeholderRulePack.applyAction(state, action);
    if (action.type === 'PENG' || action.type === 'GANG' || action.type === 'HU') return state;
    return state;
  },

  collectReactions(_state: GameState, _discardAction: Action): Array<{ playerId: PlayerId; action: Action }> {
    return [];
  },

  resolveReactions(
    state: GameState,
    reactions: Array<{ playerId: PlayerId; action: Action }>,
  ): { state: GameState; events: GameEvent[] } {
    if (!state.lastDiscard) return { state, events: [] };

    const discard = state.lastDiscard;
    const baseTurn = state.turn;
    const baseTs = now();

    const valid = reactions
      .filter((r) => r.playerId !== discard.from)
      .filter((r) => !state.declaredHu[r.playerId])
      .filter((r) => {
        const legal = this.getLegalActions(state, r.playerId);
        return legal.some((a) => JSON.stringify(a) === JSON.stringify(r.action));
      });

    const hu = valid.filter((r) => r.action.type === 'HU');
    if (hu.length > 0) {
      const declaredHu = { ...state.declaredHu };
      const events: GameEvent[] = [];
      for (const r of hu) {
        declaredHu[r.playerId] = true;
        events.push({ type: 'HU', playerId: r.playerId, tile: discard.tile, from: discard.from, turn: baseTurn, ts: baseTs });
      }

      const nextP = nextActivePlayer({ ...state, declaredHu }, discard.from);
      const next: GameState = {
        ...state,
        declaredHu,
        lastDiscard: null,
        currentPlayer: nextP,
      };

      events.push({ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs });
      return { state: next, events };
    }

    const gang = valid.find((r) => r.action.type === 'GANG');
    if (gang && gang.action.type === 'GANG') {
      const pid = gang.playerId;
      const tile = gang.action.tile;
      const from = gang.action.from;

      const nextHand = removeNTiles(state.hands[pid], tile, 3);
      if (!nextHand) {
        const nextP = nextActivePlayer({ ...state }, discard.from);
        const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
        return { state: next, events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }] };
      }

      const meld: Meld = { type: 'GANG', tile, from };
      const next: GameState = {
        ...state,
        hands: { ...state.hands, [pid]: nextHand },
        melds: { ...state.melds, [pid]: state.melds[pid].concat([meld]) },
        lastDiscard: null,
        currentPlayer: pid,
      };

      return {
        state: next,
        events: [
          { type: 'GANG', playerId: pid, tile, from, gangType: gang.action.gangType, turn: baseTurn, ts: baseTs },
          { type: 'TURN', playerId: pid, turn: next.turn, ts: baseTs },
        ],
      };
    }

    const peng = valid.find((r) => r.action.type === 'PENG');
    if (peng && peng.action.type === 'PENG') {
      const pid = peng.playerId;
      const tile = peng.action.tile;
      const from = peng.action.from;

      const nextHand = removeNTiles(state.hands[pid], tile, 2);
      if (!nextHand) {
        const nextP = nextActivePlayer({ ...state }, discard.from);
        const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
        return { state: next, events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }] };
      }

      const meld: Meld = { type: 'PENG', tile, from };
      const next: GameState = {
        ...state,
        hands: { ...state.hands, [pid]: nextHand },
        melds: { ...state.melds, [pid]: state.melds[pid].concat([meld]) },
        lastDiscard: null,
        currentPlayer: pid,
      };

      return {
        state: next,
        events: [
          { type: 'PENG', playerId: pid, tile, from, turn: baseTurn, ts: baseTs },
          { type: 'TURN', playerId: pid, turn: next.turn, ts: baseTs },
        ],
      };
    }

    const nextP = nextActivePlayer(state, discard.from);
    const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
    return {
      state: next,
      events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }],
    };
  },
};
