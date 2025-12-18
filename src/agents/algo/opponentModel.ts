import type { GameEvent } from '../../core/model/event';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import { evaluateTileDanger } from './danger';
import { shantenWithMelds } from './shanten';

export type OpponentPersona = {
  playerId: PlayerId;
  aggression: number;
  defense: number;
  meldRate: number;
  efficiencyBias: number;
  riskTolerance: number;
};

export type OpponentThreat = {
  playerId: PlayerId;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  threatScore: number;
  reasons: string[];
};

export type OpponentModelSnapshot = {
  personas: Record<PlayerId, OpponentPersona>;
  threats: Record<PlayerId, OpponentThreat>;
};

type InternalPersona = {
  aggression: number;
  defense: number;
  meldRate: number;
  efficiencyBias: number;
  riskTolerance: number;
  meldCount: number;
  totalTurns: number;
  recentDiscards: Tile[];
};

const EMA_ALPHA = 0.1;

function ema(current: number, signal: number): number {
  return current * (1 - EMA_ALPHA) + signal * EMA_ALPHA;
}

function isFamiliarTile(tile: Tile, allDiscards: Tile[][]): boolean {
  for (const pile of allDiscards) {
    if (pile.some((t) => t.suit === tile.suit && t.rank === tile.rank)) {
      return true;
    }
  }
  return false;
}

function isEdgeTile(tile: Tile): boolean {
  return tile.rank === 1 || tile.rank === 9;
}

function isMiddleTile(tile: Tile): boolean {
  return tile.rank >= 4 && tile.rank <= 6;
}

export function createOpponentModel() {
  const personas: Record<PlayerId, InternalPersona> = {
    P0: { aggression: 0.5, defense: 0.5, meldRate: 0.5, efficiencyBias: 0.5, riskTolerance: 0.5, meldCount: 0, totalTurns: 0, recentDiscards: [] },
    P1: { aggression: 0.5, defense: 0.5, meldRate: 0.5, efficiencyBias: 0.5, riskTolerance: 0.5, meldCount: 0, totalTurns: 0, recentDiscards: [] },
    P2: { aggression: 0.5, defense: 0.5, meldRate: 0.5, efficiencyBias: 0.5, riskTolerance: 0.5, meldCount: 0, totalTurns: 0, recentDiscards: [] },
    P3: { aggression: 0.5, defense: 0.5, meldRate: 0.5, efficiencyBias: 0.5, riskTolerance: 0.5, meldCount: 0, totalTurns: 0, recentDiscards: [] },
  };

  function init(players: PlayerId[]): void {
    for (const pid of players) {
      personas[pid] = {
        aggression: 0.5,
        defense: 0.5,
        meldRate: 0.5,
        efficiencyBias: 0.5,
        riskTolerance: 0.5,
        meldCount: 0,
        totalTurns: 0,
        recentDiscards: [],
      };
    }
  }

  function onEvent(state: GameState, ev: GameEvent): void {
    if (ev.type === 'DISCARD' && ev.playerId && ev.tile) {
      const pid = ev.playerId;
      const p = personas[pid];
      p.totalTurns++;
      p.recentDiscards.push(ev.tile);
      if (p.recentDiscards.length > 5) p.recentDiscards.shift();

      const allDiscards = Object.values(state.discards);
      const isFamiliar = isFamiliarTile(ev.tile, allDiscards);
      const isEdge = isEdgeTile(ev.tile);
      const isMiddle = isMiddleTile(ev.tile);
      const lateGame = state.wall.length <= 28;

      if (lateGame && isFamiliar) {
        p.defense = ema(p.defense, 1.0);
      }

      if (lateGame && isEdge) {
        p.defense = ema(p.defense, 0.8);
      }

      if (!lateGame && !isFamiliar) {
        p.aggression = ema(p.aggression, 0.7);
      }

      if (isEdge) {
        p.efficiencyBias = ema(p.efficiencyBias, 0.6);
      } else if (isMiddle) {
        p.efficiencyBias = ema(p.efficiencyBias, 0.4);
      }

      const dangerResult = evaluateTileDanger(state, pid, ev.tile);
      if (dangerResult.level === 'HIGH' && lateGame) {
        p.riskTolerance = ema(p.riskTolerance, 0.8);
        p.aggression = ema(p.aggression, 0.7);
      } else if (dangerResult.level === 'LOW') {
        p.riskTolerance = ema(p.riskTolerance, 0.3);
      }
    }

    if ((ev.type === 'PENG' || ev.type === 'GANG') && ev.playerId) {
      const pid = ev.playerId;
      const p = personas[pid];
      p.meldCount++;
      p.totalTurns++;

      const meldSignal = Math.min(1.0, p.meldCount / 3);
      p.meldRate = ema(p.meldRate, meldSignal);
      p.aggression = ema(p.aggression, 0.7 + meldSignal * 0.2);
    }

    if (ev.type === 'HU' && ev.playerId) {
      const pid = ev.playerId;
      const p = personas[pid];
      p.totalTurns++;
    }
  }

  function computeThreat(state: GameState, pid: PlayerId, selfId: PlayerId): OpponentThreat {
    if (pid === selfId) {
      return { playerId: pid, threatLevel: 'LOW', threatScore: 0, reasons: [] };
    }

    const p = personas[pid];
    const reasons: string[] = [];
    let score = 0;

    const meldCount = state.melds[pid].length;
    if (meldCount >= 2) {
      score += 0.3;
      reasons.push(`已副露 ${meldCount} 次`);
    } else if (meldCount >= 1) {
      score += 0.15;
      reasons.push(`已副露 ${meldCount} 次`);
    }

    const wallN = state.wall.length;
    const lateGame = wallN <= 16;
    const midGame = wallN <= 28 && wallN > 16;
    if (lateGame) {
      score += 0.25;
      reasons.push('后巡阶段');
    } else if (midGame) {
      score += 0.1;
    }

    if (state.declaredHu[pid]) {
      score = 0.05;
      reasons.length = 0;
      reasons.push('已胡牌（威胁解除）');
      return { playerId: pid, threatLevel: 'LOW', threatScore: score, reasons };
    }

    const hand = state.hands[pid];
    const shanten = shantenWithMelds(hand, meldCount);
    if (shanten <= 0) {
      score += 0.4;
      reasons.push('疑似听牌');
    } else if (shanten === 1) {
      score += 0.2;
      reasons.push('一向听');
    }

    if (p.recentDiscards.length >= 3) {
      const allDiscards = Object.values(state.discards);
      const familiarCount = p.recentDiscards.filter((t) => isFamiliarTile(t, allDiscards)).length;
      const familiarRatio = familiarCount / p.recentDiscards.length;
      if (familiarRatio >= 0.6 && lateGame) {
        score += 0.15;
        reasons.push('最近弃牌明显保守');
      }
    }

    if (p.aggression > 0.65) {
      score += 0.1;
      reasons.push('激进型玩家');
    }

    score = Math.min(1.0, score);

    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (score >= 0.55) level = 'HIGH';
    else if (score >= 0.3) level = 'MEDIUM';

    return { playerId: pid, threatLevel: level, threatScore: score, reasons };
  }

  function getSnapshot(state: GameState, selfId: PlayerId): OpponentModelSnapshot {
    const outPersonas: Record<PlayerId, OpponentPersona> = {} as any;
    const outThreats: Record<PlayerId, OpponentThreat> = {} as any;

    for (const pid of ['P0', 'P1', 'P2', 'P3'] as PlayerId[]) {
      const p = personas[pid];
      outPersonas[pid] = {
        playerId: pid,
        aggression: p.aggression,
        defense: p.defense,
        meldRate: p.meldRate,
        efficiencyBias: p.efficiencyBias,
        riskTolerance: p.riskTolerance,
      };
      outThreats[pid] = computeThreat(state, pid, selfId);
    }

    return { personas: outPersonas, threats: outThreats };
  }

  return { init, onEvent, getSnapshot };
}

export function findMostDangerousOpponent(snapshot: OpponentModelSnapshot, selfId: PlayerId): OpponentThreat | null {
  let best: OpponentThreat | null = null;
  for (const pid of ['P0', 'P1', 'P2', 'P3'] as PlayerId[]) {
    if (pid === selfId) continue;
    const t = snapshot.threats[pid];
    if (!best || t.threatScore > best.threatScore) {
      best = t;
    }
  }
  return best;
}
