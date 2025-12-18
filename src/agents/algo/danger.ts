import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';

export type DangerLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TileDanger = {
  tile: Tile;
  score: number;
  level: DangerLevel;
  reasons: string[];
};

function tileKey(t: Tile): string {
  return `${t.suit}${t.rank}`;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function seenCounts(state: GameState): Map<string, number> {
  const m = new Map<string, number>();

  for (const pid of Object.keys(state.discards) as PlayerId[]) {
    for (const t of state.discards[pid]) {
      const k = tileKey(t);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }

  return m;
}

function suitSeenCounts(state: GameState): Record<Tile['suit'], number> {
  const out: Record<Tile['suit'], number> = { W: 0, B: 0, T: 0 };
  for (const pid of Object.keys(state.discards) as PlayerId[]) {
    for (const t of state.discards[pid]) {
      out[t.suit] += 1;
    }
  }
  return out;
}

function suitHasOpponentMeld(state: GameState, self: PlayerId, suit: Tile['suit']): boolean {
  for (const pid of Object.keys(state.melds) as PlayerId[]) {
    if (pid === self) continue;
    for (const m of state.melds[pid]) {
      if (m.tile.suit === suit) return true;
    }
  }
  return false;
}

function dangerLevel(score: number): DangerLevel {
  if (score >= 6.0) return 'HIGH';
  if (score >= 3.0) return 'MEDIUM';
  return 'LOW';
}

function adjRanks(rank: Tile['rank']): Array<Tile['rank']> {
  const rs: number[] = [rank - 2, rank - 1, rank + 1, rank + 2];
  return rs.filter((x) => x >= 1 && x <= 9) as Array<Tile['rank']>;
}

export function evaluateTileDanger(state: GameState, playerId: PlayerId, tile: Tile): TileDanger {
  const reasons: string[] = [];
  let score = 0;

  const seen = seenCounts(state);
  const k = tileKey(tile);
  const nSeen = seen.get(k) ?? 0;

  // 1) 生熟张：越没出现越危险
  if (nSeen === 0) {
    score += 3.0;
    reasons.push('该牌未在场上出现过（生张）');
  } else if (nSeen === 1) {
    score += 1.5;
    reasons.push('该牌仅出现过 1 张（偏生）');
  } else {
    score -= 1.0;
    reasons.push('该牌在场上出现过多张（偏熟）');
  }

  // 2) 临近张危险：相邻张越“未见”，越危险（更像对手的等待/延伸）
  const adj = adjRanks(tile.rank);
  let unseenAdj = 0;
  for (const r of adj) {
    const ak = `${tile.suit}${r}`;
    if ((seen.get(ak) ?? 0) === 0) unseenAdj++;
  }
  if (unseenAdj >= 3) {
    score += 2.0;
    reasons.push(`相邻牌（±1/±2）大量未现（${unseenAdj}/${adj.length}）`);
  } else if (unseenAdj === 2) {
    score += 1.0;
    reasons.push('相邻牌（±1/±2）有一半未现');
  }

  // 3) 对手副露：某花色被对手碰/杠过，说明对该花色有倾向
  if (suitHasOpponentMeld(state, playerId, tile.suit)) {
    score += 1.5;
    reasons.push('对手有该花色的副露（碰/杠），该花色整体偏危险');
  }

  // 4) 局况阶段：wall 越少，全局风险越高（简单线性/分段系数）
  // 108 张 - 起手 52 张 = 56 张。这里不依赖常数，直接用 wall 的相对大小。
  const wallN = state.wall.length;
  let lateCoef = 1.0;
  if (wallN <= 8) lateCoef = 1.35;
  else if (wallN <= 16) lateCoef = 1.2;
  else if (wallN <= 24) lateCoef = 1.1;

  if (lateCoef > 1.0) {
    reasons.push(`局面偏后（wall=${wallN}），整体风险上调 x${lateCoef.toFixed(2)}`);
  }

  // 5) 自身副露：越副露越进攻，允许承担更多风险（扣一点分）
  const selfMeldCount = state.melds[playerId].length;
  const selfAttackBonus = clamp(selfMeldCount * 0.6, 0, 1.8);
  if (selfAttackBonus > 0) {
    score -= selfAttackBonus;
    reasons.push(`自身已有副露 ${selfMeldCount} 组（偏进攻），风险容忍度提升`);
  }

  // 额外稳定性：如果场上该花色整体很“干净”（弃牌少），也稍微上调
  const suitSeen = suitSeenCounts(state);
  if (suitSeen[tile.suit] <= 2) {
    score += 0.5;
    reasons.push('该花色整体弃牌很少（场面信息不足）');
  }

  const finalScore = score * lateCoef;
  return {
    tile,
    score: Number(finalScore.toFixed(3)),
    level: dangerLevel(finalScore),
    reasons,
  };
}
