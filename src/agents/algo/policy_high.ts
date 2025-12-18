import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { AgentDecisionContext } from '../PlayerAgent';
import { countTiles } from './feature';
import { evaluateTileDanger } from './danger';
import { handToCounts, shantenWithMelds, ukeireTilesWithMelds } from './shanten';
import { findMostDangerousOpponent } from './opponentModel';

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

function pairKinds(hand13: GameState['hands'][PlayerId]): number {
  const c = handToCounts(hand13);
  let n = 0;
  for (const x of c) if (x >= 2) n++;
  return n;
}

export function decideHigh(state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext): Action {
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
        if (s1 <= s0) return gang;
      }
    }

    const peng = legal.find((a) => a.type === 'PENG');
    if (peng && peng.type === 'PENG') {
      const after = removeNTiles(hand, peng.tile, 2);
      if (after) {
        const s1 = shantenWithMelds(after, meldCount + 1);
        if (s1 <= s0) return peng;
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
    pairKinds: number;
    singleton: boolean;
    dangerScore: number;
    dangerLevel: string;
    efficiencyScore: number;
    totalScore: number;
  };
  const cands: Cand[] = [];

  const style = ctx?.style.style ?? 'BALANCED';
  
  const baseWeights = ctx?.style.styleWeights ?? (() => {
    const wallN = state.wall.length;
    return { efficiencyWeight: 1.0, dangerWeight: wallN <= 8 ? 2.4 : wallN <= 16 ? 1.8 : wallN <= 24 ? 1.3 : 0.8 };
  })();

  const metaParams = ctx?.metaParams ?? { efficiencyWeight: 1.0, dangerWeight: 1.0, threatWeight: 1.0 };
  
  const efficiencyWeight = baseWeights.efficiencyWeight * metaParams.efficiencyWeight;
  const dangerWeight = baseWeights.dangerWeight * metaParams.dangerWeight;

  const topThreat = ctx?.opponentSnapshot ? findMostDangerousOpponent(ctx.opponentSnapshot, playerId) : null;
  const baseThreatWeight = topThreat && topThreat.threatLevel === 'HIGH' ? 3.0 : topThreat && topThreat.threatLevel === 'MEDIUM' ? 1.2 : 0.3;
  const threatWeight = baseThreatWeight * metaParams.threatWeight;

  for (const d of discards) {
    if (d.type !== 'DISCARD') continue;
    const i = hand.findIndex((x) => x.suit === d.tile.suit && x.rank === d.tile.rank);
    if (i < 0) continue;

    const hand13 = removeOne(hand, i);
    const sAfter = shantenWithMelds(hand13, meldCount);
    const ukeireTotal = ukeireTilesWithMelds(hand13, meldCount).total;
    const pk = pairKinds(hand13);
    const t = hand[i];
    const singleton = (baseCounts.get(`${t.suit}${t.rank}`) ?? 0) === 1;

    const danger = evaluateTileDanger(state, playerId, t);

    const threatPenalty = topThreat ? danger.score * topThreat.threatScore * threatWeight : 0;

    const shantenGain = shantenBefore - sAfter;
    const efficiencyScore = shantenGain * 60 + ukeireTotal;
    const totalScore = efficiencyWeight * efficiencyScore - dangerWeight * danger.score - threatPenalty;

    cands.push({
      idx: i,
      tile: t,
      sAfter,
      ukeireTotal,
      pairKinds: pk,
      singleton,
      dangerScore: danger.score,
      dangerLevel: danger.level,
      efficiencyScore,
      totalScore,
    });
  }

  if (cands.length === 0) return { type: 'PASS' };

  cands.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    if (a.sAfter !== b.sAfter) return a.sAfter - b.sAfter;
    if (a.ukeireTotal !== b.ukeireTotal) return b.ukeireTotal - a.ukeireTotal;
    if (a.dangerScore !== b.dangerScore) return a.dangerScore - b.dangerScore;
    if (a.pairKinds !== b.pairKinds) return b.pairKinds - a.pairKinds;
    if (a.singleton !== b.singleton) return a.singleton ? -1 : 1;
    return a.idx - b.idx;
  });

  let pool = cands;
  if ((style === 'DEFENSIVE' || style === 'STALLING') && pool.some((x) => x.dangerLevel !== 'HIGH')) {
    pool = pool.filter((x) => x.dangerLevel !== 'HIGH');
  }

  pool.sort((a, b) => {
    if (style === 'DEFENSIVE' || style === 'STALLING') {
      if (a.dangerScore !== b.dangerScore) return a.dangerScore - b.dangerScore;
    }
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    if (a.sAfter !== b.sAfter) return a.sAfter - b.sAfter;
    if (a.ukeireTotal !== b.ukeireTotal) return b.ukeireTotal - a.ukeireTotal;
    if (a.dangerScore !== b.dangerScore) return a.dangerScore - b.dangerScore;
    if (a.pairKinds !== b.pairKinds) return b.pairKinds - a.pairKinds;
    if (a.singleton !== b.singleton) return a.singleton ? -1 : 1;
    return a.idx - b.idx;
  });

  let best = pool[0];
  if ((style === 'AGGRESSIVE' || style === 'BALANCED') && best.dangerLevel === 'HIGH') {
    const safest = pool.reduce((acc, cur) => (cur.dangerScore < acc.dangerScore ? cur : acc), best);
    const effGap = best.efficiencyScore - safest.efficiencyScore;
    if (safest.dangerLevel !== 'HIGH' && effGap <= 12) {
      best = safest;
    }
  }

  const tile = best.tile;
  return { type: 'DISCARD', tile };
}
