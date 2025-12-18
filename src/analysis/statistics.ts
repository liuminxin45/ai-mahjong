import type { DangerLevel } from '../agents/algo/danger';
import type { GameStyle } from '../agents/algo/style';
import type { PlayerId } from '../core/model/types';

export type DecisionStat = {
  turn: number;
  style: GameStyle;
  discard: string;
  shantenBefore: number;
  shantenAfter: number;
  dangerLevel: DangerLevel;
  topThreat?: {
    playerId: PlayerId;
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  opponentPersonas?: {
    playerId: PlayerId;
    aggression: number;
    defense: number;
  }[];
};

export type MatchStat = {
  decisions: DecisionStat[];
  result?: 'HU' | 'LOSE' | 'DRAW';
};

let current: MatchStat | null = null;
let latest: MatchStat | null = null;

export function startMatchStat(): void {
  current = { decisions: [] };
}

export function recordDecisionStat(s: DecisionStat): void {
  if (!current) startMatchStat();
  current!.decisions.push(s);
}

export function finishMatchStat(result: MatchStat['result']): MatchStat {
  if (!current) startMatchStat();
  current!.result = result;
  const out = current!;
  latest = out;
  current = null;
  return out;
}

export function getLatestMatchStat(): MatchStat | null {
  return latest;
}
