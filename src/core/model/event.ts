import type { PlayerId } from './types';
import type { Tile } from './tile';

export type GameEvent = {
  type: 'INIT' | 'DRAW' | 'DISCARD' | 'PENG' | 'GANG' | 'HU' | 'TURN' | 'END';
  playerId?: PlayerId;
  tile?: Tile;
  from?: PlayerId;
  gangType?: 'MING' | 'AN' | 'JIA' | 'BU';
  turn: number;
  ts: number;
  meta?: Record<string, unknown>;
  reason?: string;
};
