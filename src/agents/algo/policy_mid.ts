import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { AgentDecisionContext } from '../PlayerAgent';
import { countTiles } from './feature';
import { evaluateTileDanger } from './danger';
import { shantenWithMelds, ukeireTilesWithMelds } from './shanten';

function removeOne(hand: GameState['hands'][PlayerId], idx: number): GameState['hands'][PlayerId] {
  return hand.slice(0, idx).concat(hand.slice(idx + 1));
}

function removeNTiles(hand: GameState['hands'][PlayerId], tile: GameState['hands'][PlayerId][number], n: number): GameState['hands'][PlayerId] | null {
  let remaining = n;
  const out: GameState['hands'][PlayerId] = [];
  for (const t of hand) {
    if (remaining > 0 && t.suit === tile.suit && t.rank === tile.rank) {
      remaining--;
    } else {
      out.push(t);
    }
  }
  return remaining === 0 ? out : null;
}

export function decideMid(state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext): Action {
  if (legal.length === 0) return { type: 'PASS' };

  const hu = legal.find((a) => a.type === 'HU');
  if (hu) return hu;

  const hasReaction = legal.some((a) => a.type === 'PENG' || a.type === 'GANG');
  if (hasReaction) {
    const hand = state.hands[playerId];
    const meldCount = state.melds[playerId].length;
    const s0 = shantenWithMelds(hand, meldCount);

    const gang = legal.find((a) => a.type === 'GANG');
    if (gang && gang.type === 'GANG') {
      const after = removeNTiles(hand, gang.tile, 3);
      if (after) {
        const s1 = shantenWithMelds(after, meldCount + 1);
        if (s1 < s0) return gang;
      }
    }

    const peng = legal.find((a) => a.type === 'PENG');
    if (peng && peng.type === 'PENG') {
      const after = removeNTiles(hand, peng.tile, 2);
      if (after) {
        const s1 = shantenWithMelds(after, meldCount + 1);
        if (s1 < s0) return peng;
      }
    }

    return { type: 'PASS' };
  }

  const discards = legal.filter((a) => a.type === 'DISCARD');
  if (discards.length === 0) return legal[0];

  const hand = state.hands[playerId];
  const meldCount = state.melds[playerId].length;
  const base = 13 - meldCount * 3;
  if (hand.length !== base + 1) return { type: 'PASS' };

  const shantenBefore = shantenWithMelds(hand, meldCount);

  const baseCounts = countTiles(hand);
  type Cand = {
    idx: number;
    tile: GameState['hands'][PlayerId][number];
    sAfter: number;
    ukeireTotal: number;
    singleton: boolean;
    dangerScore: number;
    dangerLevel: string;
    totalScore: number;
  };
  const cands: Cand[] = [];

  const style = ctx?.style.style ?? 'BALANCED';
  const baseWeights = ctx?.style.styleWeights ?? { efficiencyWeight: 1.0, dangerWeight: 1.2 };
  const metaParams = ctx?.metaParams ?? { efficiencyWeight: 1.0, dangerWeight: 1.0, threatWeight: 1.0 };
  
  const efficiencyWeight = baseWeights.efficiencyWeight * metaParams.efficiencyWeight;
  const dangerWeight = baseWeights.dangerWeight * metaParams.dangerWeight;

  for (const d of discards) {
    if (d.type !== 'DISCARD') continue;
    const i = hand.findIndex((x) => x.suit === d.tile.suit && x.rank === d.tile.rank);
    if (i < 0) continue;

    const hand13 = removeOne(hand, i);
    const sAfter = shantenWithMelds(hand13, meldCount);
    const ukeireTotal = ukeireTilesWithMelds(hand13, meldCount).total;
    const t = hand[i];
    const singleton = (baseCounts.get(`${t.suit}${t.rank}`) ?? 0) === 1;

    const danger = evaluateTileDanger(state, playerId, t);

    const shantenGain = shantenBefore - sAfter;
    const efficiencyScore = shantenGain * 60 + ukeireTotal;
    const totalScore = efficiencyWeight * efficiencyScore - dangerWeight * danger.score;

    cands.push({
      idx: i,
      tile: t,
      sAfter,
      ukeireTotal,
      singleton,
      dangerScore: danger.score,
      dangerLevel: danger.level,
      totalScore,
    });
  }

  if (cands.length === 0) return { type: 'PASS' };

  let pool = cands;
  if ((style === 'DEFENSIVE' || style === 'STALLING') && pool.some((x) => x.dangerLevel !== 'HIGH')) {
    pool = pool.filter((x) => x.dangerLevel !== 'HIGH');
  }

  cands.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    if (a.sAfter !== b.sAfter) return a.sAfter - b.sAfter;
    if (a.ukeireTotal !== b.ukeireTotal) return b.ukeireTotal - a.ukeireTotal;
    if (a.dangerScore !== b.dangerScore) return a.dangerScore - b.dangerScore;
    if (a.singleton !== b.singleton) return a.singleton ? -1 : 1;
    return a.idx - b.idx;
  });

  pool.sort((a, b) => {
    if (style === 'DEFENSIVE' || style === 'STALLING') {
      if (a.dangerScore !== b.dangerScore) return a.dangerScore - b.dangerScore;
    }
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    if (a.sAfter !== b.sAfter) return a.sAfter - b.sAfter;
    if (a.ukeireTotal !== b.ukeireTotal) return b.ukeireTotal - a.ukeireTotal;
    if (a.dangerScore !== b.dangerScore) return a.dangerScore - b.dangerScore;
    if (a.singleton !== b.singleton) return a.singleton ? -1 : 1;
    return a.idx - b.idx;
  });

  const tile = pool[0].tile;
  return { type: 'DISCARD', tile };
}
