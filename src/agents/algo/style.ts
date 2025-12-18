import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import { shantenWithMelds, ukeireTilesWithMelds } from './shanten';
import { evaluateTileDanger } from './danger';

export type GameStyle = 'AGGRESSIVE' | 'BALANCED' | 'DEFENSIVE' | 'STALLING';

export type StyleReason = string;

export type StyleResult = {
  style: GameStyle;
  reasons: StyleReason[];
};

function styleWeights(style: GameStyle): { efficiencyWeight: number; dangerWeight: number } {
  if (style === 'AGGRESSIVE') return { efficiencyWeight: 1.3, dangerWeight: 0.5 };
  if (style === 'DEFENSIVE') return { efficiencyWeight: 0.7, dangerWeight: 6.0 };
  if (style === 'STALLING') return { efficiencyWeight: 0.45, dangerWeight: 8.0 };
  return { efficiencyWeight: 1.0, dangerWeight: 1.6 };
}

function computeBestUkeireAndShanten(state: GameState, playerId: PlayerId): { shanten: number; ukeireTotal: number } {
  const hand = state.hands[playerId];
  const meldCount = state.melds[playerId].length;
  const base = 13 - meldCount * 3;

  if (hand.length === base + 1) {
    let bestS = 99;
    let bestU = 0;
    for (let i = 0; i < hand.length; i++) {
      const hand13 = hand.slice(0, i).concat(hand.slice(i + 1));
      const sAfter = shantenWithMelds(hand13, meldCount);
      const u = ukeireTilesWithMelds(hand13, meldCount).total;
      if (sAfter < bestS) {
        bestS = sAfter;
        bestU = u;
      } else if (sAfter === bestS && u > bestU) {
        bestU = u;
      }
    }
    return { shanten: bestS === 99 ? shantenWithMelds(hand, meldCount) : bestS, ukeireTotal: bestU };
  }

  return {
    shanten: shantenWithMelds(hand, meldCount),
    ukeireTotal: ukeireTilesWithMelds(hand, meldCount).total,
  };
}

function dangerHighRatio(state: GameState, playerId: PlayerId): { ratio: number; safeCount: number; total: number } {
  const hand = state.hands[playerId];
  if (hand.length === 0) return { ratio: 0, safeCount: 0, total: 0 };

  let high = 0;
  let safe = 0;
  for (const t of hand) {
    const d = evaluateTileDanger(state, playerId, t);
    if (d.level === 'HIGH') high++;
    if (d.level !== 'HIGH') safe++;
  }
  return { ratio: high / hand.length, safeCount: safe, total: hand.length };
}

function opponentsThreatCount(state: GameState, self: PlayerId): number {
  let n = 0;
  for (const pid of ['P0', 'P1', 'P2', 'P3'] as PlayerId[]) {
    if (pid === self) continue;
    if (state.declaredHu[pid]) {
      n++;
      continue;
    }

    const hand = state.hands[pid];
    const meldCount = state.melds[pid].length;
    const s = shantenWithMelds(hand, meldCount);
    if (s <= 1 || meldCount >= 1) n++;
  }
  return n;
}

export function detectGameStyle(state: GameState, playerId: PlayerId): StyleResult {
  const reasons: string[] = [];
  const wallN = state.wall.length;
  const lateGame = wallN <= 16;

  const { shanten, ukeireTotal } = computeBestUkeireAndShanten(state, playerId);
  const selfMeldCount = state.melds[playerId].length;
  const highRatio = dangerHighRatio(state, playerId);

  const hasOpponentHu = (['P0', 'P1', 'P2', 'P3'] as PlayerId[]).some(
    (pid) => pid !== playerId && state.declaredHu[pid],
  );

  const threatOpponents = opponentsThreatCount(state, playerId);

  const riskSignalActive = hasOpponentHu || threatOpponents >= 2 || wallN <= 28;

  if (hasOpponentHu) {
    reasons.push('对手已胡（血战占坑），需要更谨慎');
  }
  if (lateGame) {
    reasons.push(`后巡（wall=${wallN}）整体风险更高`);
  }
  if (riskSignalActive && highRatio.ratio > 0.4) {
    reasons.push(`高风险张占比偏高（${Math.round(highRatio.ratio * 100)}%）`);
  }

  if (hasOpponentHu || lateGame || (riskSignalActive && highRatio.ratio > 0.4)) {
    return { style: 'DEFENSIVE', reasons };
  }

  if (shanten <= 2) {
    reasons.push(`向听较低（${shanten}）`);
  }
  if (ukeireTotal >= 12) {
    reasons.push(`有效牌较多（${ukeireTotal}）`);
  } else if (ukeireTotal >= 8) {
    reasons.push(`有效牌尚可（${ukeireTotal}）`);
  }
  if (selfMeldCount >= 1) {
    reasons.push(`自身已有副露 ${selfMeldCount} 组（偏进攻）`);
  }
  if (shanten <= 2 && (ukeireTotal >= 8 || selfMeldCount >= 1)) {
    return { style: 'AGGRESSIVE', reasons };
  }

  if (shanten >= 3) {
    reasons.push(`向听较高（${shanten}）`);
  }
  if (threatOpponents >= 2) {
    reasons.push(`对手威胁较大（${threatOpponents} 家接近听牌/已副露）`);
  }
  const manySafeTiles = highRatio.total > 0 && highRatio.safeCount >= Math.ceil(highRatio.total * 0.4);
  if (manySafeTiles) {
    reasons.push('可弃的安全张较多');
  }

  if (shanten >= 3 && threatOpponents >= 2 && manySafeTiles) {
    return { style: 'STALLING', reasons };
  }

  return { style: 'BALANCED', reasons: ['局面没有明显进攻/防守信号，默认均衡'] };
}

export function getStyleWeights(style: GameStyle): { efficiencyWeight: number; dangerWeight: number } {
  return styleWeights(style);
}

export function styleBadgeText(style: GameStyle): string {
  if (style === 'AGGRESSIVE') return '进攻态';
  if (style === 'DEFENSIVE') return '防守态';
  if (style === 'STALLING') return '拖局态';
  return '均衡态';
}

export function isLateGame(state: GameState): boolean {
  return state.wall.length <= 16;
}

export function normalizeStyle(style: GameStyle | undefined | null): GameStyle {
  return style ?? 'BALANCED';
}

export type AgentStyleContext = {
  style: GameStyle;
  styleReasons: string[];
  styleWeights: { efficiencyWeight: number; dangerWeight: number };
};

export function makeAgentStyleContext(state: GameState, playerId: PlayerId): AgentStyleContext {
  const res = detectGameStyle(state, playerId);
  return {
    style: res.style,
    styleReasons: res.reasons,
    styleWeights: getStyleWeights(res.style),
  };
}
