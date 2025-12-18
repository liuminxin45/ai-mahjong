import type { Action } from '../../../model/action';
import type { GameEvent } from '../../../model/event';
import type { GameState } from '../../../model/state';
import { makeStandardTileSet, type Tile } from '../../../model/tile';
import { nextPlayerId, PLAYER_ORDER, type PlayerId } from '../../../model/types';
import type { RulePack } from '../../RulePack';
import { ruleConfig } from './rule.config';

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    wall: state.wall.slice(),
    hands: {
      P0: state.hands.P0.slice(),
      P1: state.hands.P1.slice(),
      P2: state.hands.P2.slice(),
      P3: state.hands.P3.slice(),
    },
    discards: {
      P0: state.discards.P0.slice(),
      P1: state.discards.P1.slice(),
      P2: state.discards.P2.slice(),
      P3: state.discards.P3.slice(),
    },
    melds: {
      P0: state.melds.P0.slice(),
      P1: state.melds.P1.slice(),
      P2: state.melds.P2.slice(),
      P3: state.melds.P3.slice(),
    },
    lastDiscard: state.lastDiscard ? { ...state.lastDiscard } : null,
    declaredHu: { ...state.declaredHu },
  };
}

export const placeholderRulePack: RulePack = {
  id: ruleConfig.id,
  version: ruleConfig.version,

  getTileSet(): Tile[] {
    return makeStandardTileSet();
  },

  buildInitialState(): GameState {
    const tiles = shuffle(this.getTileSet());

    const hands: Record<PlayerId, Tile[]> = {
      P0: [],
      P1: [],
      P2: [],
      P3: [],
    };

    let wall = tiles;
    for (let i = 0; i < 13; i++) {
      for (const pid of PLAYER_ORDER) {
        const t = wall[0];
        if (!t) {
          break;
        }
        hands[pid] = hands[pid].concat([t]);
        wall = wall.slice(1);
      }
    }

    return {
      wall,
      hands,
      discards: {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      },
      melds: {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      },
      lastDiscard: null,
      declaredHu: {
        P0: false,
        P1: false,
        P2: false,
        P3: false,
      },
      currentPlayer: 'P0',
      phase: 'PLAYING',
      turn: 0,
    };
  },

  getCurrentActor(state: GameState): PlayerId {
    return state.currentPlayer;
  },

  getLegalActions(state: GameState, player: PlayerId): Action[] {
    if (state.phase !== 'PLAYING') return [];
    if (state.declaredHu[player]) return [{ type: 'PASS' }];

    if (state.lastDiscard) {
      if (player === state.lastDiscard.from) return [{ type: 'PASS' }];
      return [{ type: 'PASS' }];
    }

    if (player !== state.currentPlayer) return [{ type: 'PASS' }];

    const hand = state.hands[player];
    const meldCount = state.melds[player].length;
    const base = 13 - meldCount * 3;

    if (hand.length === base) return [{ type: 'DRAW' }];
    if (hand.length === base + 1) {
      return hand.map((tile) => ({ type: 'DISCARD', tile }));
    }
    return [];
  },

  applyAction(state: GameState, action: Action): GameState {
    const s = cloneState(state);
    if (s.phase === 'END') return s;

    if (s.lastDiscard) {
      if (action.type === 'PASS') return s;
      return s;
    }

    const player = s.currentPlayer;
    const hand = s.hands[player];
    const meldCount = s.melds[player].length;
    const base = 13 - meldCount * 3;

    if (action.type === 'DRAW') {
      if (hand.length !== base) return s;
      const top = s.wall[0];
      if (!top) {
        return { ...s, phase: 'END' };
      }
      const nextHand = hand.concat([top]);
      return {
        ...s,
        wall: s.wall.slice(1),
        hands: {
          ...s.hands,
          [player]: nextHand,
        },
        phase: 'PLAYING',
      };
    }

    if (action.type === 'DISCARD') {
      if (hand.length !== base + 1) return s;

      const idx = hand.findIndex(
        (t) => t.suit === action.tile.suit && t.rank === action.tile.rank,
      );
      if (idx < 0) return s;

      const nextHand = hand.slice(0, idx).concat(hand.slice(idx + 1));
      const nextDiscards = s.discards[player].concat([action.tile]);

      return {
        ...s,
        hands: {
          ...s.hands,
          [player]: nextHand,
        },
        discards: {
          ...s.discards,
          [player]: nextDiscards,
        },
        lastDiscard: { tile: action.tile, from: player },
        turn: s.turn + 1,
        phase: 'PLAYING',
      };
    }

    if (action.type === 'PASS') {
      return s;
    }

    return s;
  },

  collectReactions(_state: GameState, _discardAction: Action): Array<{ playerId: PlayerId; action: Action }> {
    return [];
  },

  resolveReactions(
    state: GameState,
    _reactions: Array<{ playerId: PlayerId; action: Action }>,
  ): { state: GameState; events: GameEvent[] } {
    if (!state.lastDiscard) return { state, events: [] };
    const from = state.lastDiscard.from;
    const nextPlayer = nextPlayerId(from);
    const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextPlayer };
    return {
      state: next,
      events: [{ type: 'TURN', playerId: nextPlayer, turn: next.turn, ts: Date.now() }],
    };
  },

  isRoundEnd(state: GameState): boolean {
    return state.wall.length === 0 || state.phase === 'END';
  },

  settleRound(_state: GameState): unknown {
    return { placeholder: true };
  },
};
