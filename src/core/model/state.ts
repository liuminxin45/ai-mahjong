import type { Tile } from './tile';
import type { PlayerId } from './types';

export type Phase = 'INIT' | 'PLAYING' | 'END' | string; // 允许规则包自定义阶段

export type MeldType = 'PENG' | 'GANG';

export type Meld = {
  type: MeldType;
  tile: Tile;
  from: PlayerId;
};

export type GameState = {
  wall: Tile[];
  hands: Record<PlayerId, Tile[]>;
  discards: Record<PlayerId, Tile[]>;
  melds: Record<PlayerId, Meld[]>;
  lastDiscard: { tile: Tile; from: PlayerId } | null;
  declaredHu: Record<PlayerId, boolean>;
  currentPlayer: PlayerId;
  phase: Phase;
  turn: number;
};
